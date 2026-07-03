"""
Smart auto-bind of tracked spools to AMS trays via RFID ``tag_uid``.

When a genuine Bambu spool is physically loaded into an AMS tray, the printer
reads its RFID ``tag_uid`` — a 16-hex string that is unique per physical spool.
This module uses that tag to deterministically bind the tracked :class:`Spool`
to the tray by setting the spool's ``ams_slot`` column, so the *existing*
auto-deduct logic (see ``print_monitor``) fires against the correct physical
spool even when the user owns many spools of the same material + colour.

``ams_slot`` is stored in the ``"{printer_name}:{slot_key}"`` form (see
``routers/printers.py``) — this module writes that same full-key form.

SAFETY — never auto-bind ambiguously
------------------------------------
The only auto-actions taken here are:

  (a) deterministic re-bind: a tag_uid we've already bound to a spool re-appears
      in a tray → move that spool's ams_slot to the current tray, and
  (b) single-unambiguous first bind: a never-seen tag_uid whose material+colour
      (or bambu_spool_id+colour) matches EXACTLY ONE not-yet-tag-bound spool.

Zero or multiple candidates → we do nothing and leave the tray for a one-time
manual "Assign spool" confirm in the UI (which then stores the tag_uid via the
assign endpoint, upgrading it to case (a) for all future loads).

This guarantees auto-deduct can never deduct from the wrong physical spool even
if this feature ships before review.
"""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import PrinterConfig, Spool

log = logging.getLogger(__name__)


def _is_real_tag_uid(tag_uid) -> bool:
    """True only for a usable RFID tag.

    Genuine Bambu spools report a 16-hex, non-zero value (e.g.
    ``"4767E20300000100"``). Third-party/generic spools report empty or
    all-zeros (``"0000000000000000"``) — those have no usable RFID and are
    skipped entirely (manual assignment only).
    """
    if not tag_uid:
        return False
    s = str(tag_uid).strip()
    if not s:
        return False
    # All-zeros (any length) = no tag present.
    if set(s) <= {"0"}:
        return False
    return True


def _find_first_bind_candidate(db: Session, slot_info: dict) -> Spool | None:
    """Find the single unambiguous spool to first-bind to a tray.

    Match among spools that are NOT already tag_uid-bound, by:
      1. (bambu_spool_id AND colour) when the tray carries a bambu_spool_id, else
      2. (material AND colour).

    Colour comes from the AMS tray cache as ``"#RRGGBB"``; we compare
    case-insensitively against the spool's ``color_hex``. Returns the spool only
    when EXACTLY ONE candidate matches; ``None`` for zero or multiple.
    """
    material = (slot_info.get("material") or "").strip()
    color = (slot_info.get("color") or "").strip()
    bambu_spool_id = slot_info.get("bambu_spool_id")

    if not color:
        return None  # colour is required for a safe first bind

    # Only consider spools that have some stock left and are not archived — a
    # physically loaded spool is an active one.
    base = (
        db.query(Spool)
        .filter(Spool.tag_uid.is_(None))
        .filter(Spool.archived == False)  # noqa: E712
        .filter(Spool.current_weight_g > 0)
    )

    def _by_color(q):
        # Case-insensitive hex compare (SQLite LIKE is case-insensitive for ASCII).
        return q.filter(Spool.color_hex.ilike(color))

    candidates: list[Spool] = []
    if bambu_spool_id:
        candidates = _by_color(
            base.filter(Spool.bambu_spool_id == str(bambu_spool_id))
        ).all()
    if not candidates and material:
        candidates = _by_color(base.filter(Spool.material == material)).all()

    if len(candidates) == 1:
        return candidates[0]
    return None


def _clear_slot_from_others(db: Session, full_key: str, slot_key: str, keep_spool_id: int | None) -> None:
    """Ensure no OTHER spool claims this AMS slot (a tray holds one spool).

    Clears ``ams_slot`` from every spool currently pointing at this slot
    (either full ``"{printer}:{slot}"`` or bare ``slot`` form) except the one we
    are binding. Guards against duplicate binds / races.
    """
    q = db.query(Spool).filter(
        (Spool.ams_slot == full_key) | (Spool.ams_slot == slot_key)
    )
    if keep_spool_id is not None:
        q = q.filter(Spool.id != keep_spool_id)
    q.update({"ams_slot": None}, synchronize_session=False)


def _autobind_for_printer(db: Session, printer: PrinterConfig, detail: dict[str, dict]) -> int:
    """Run the auto-bind pass for one printer's current AMS tray detail.

    ``detail`` is ``{slot_key: {material, color, remain, tag_uid, ...}}`` from
    ``bambu_cloud_client.get_ams_detail_for_serial``. Returns the number of
    spools whose ams_slot was set/updated.
    """
    changed = 0
    for slot_key, slot_info in detail.items():
        tag_uid = slot_info.get("tag_uid")
        if not _is_real_tag_uid(tag_uid):
            continue  # empty / all-zeros / third-party → manual only
        tag_uid = str(tag_uid).strip()
        full_key = f"{printer.name}:{slot_key}"

        # (a) Deterministic re-bind: this physical spool is already known.
        bound = db.query(Spool).filter(Spool.tag_uid == tag_uid).first()
        if bound is not None:
            if bound.ams_slot != full_key:
                _clear_slot_from_others(db, full_key, slot_key, keep_spool_id=bound.id)
                log.info(
                    "AMS auto-bind: tag_uid %s → spool #%d re-bound %s → %s",
                    tag_uid, bound.id, bound.ams_slot, full_key,
                )
                bound.ams_slot = full_key
                changed += 1
            continue

        # (b) First bind: never-seen tag_uid → single unambiguous candidate only.
        candidate = _find_first_bind_candidate(db, slot_info)
        if candidate is None:
            continue  # zero or multiple → leave for manual assignment
        _clear_slot_from_others(db, full_key, slot_key, keep_spool_id=candidate.id)
        candidate.tag_uid = tag_uid
        candidate.ams_slot = full_key
        changed += 1
        log.info(
            "AMS auto-bind: first bind tag_uid %s → spool #%d (%s %s %s) at %s",
            tag_uid, candidate.id, candidate.brand, candidate.material,
            candidate.color_name, full_key,
        )

    return changed


def autobind_from_ams_cache(serial: str) -> int:
    """Entry point: reconcile spool↔tray binding from the live AMS cache.

    Called from the MQTT message path whenever AMS tray data is refreshed. Opens
    its own DB session (this runs on the paho MQTT thread, not the async loop).
    Returns the number of spools re-bound/bound (0 if nothing to do).
    Never raises — logs and returns 0 on any error.
    """
    try:
        from . import bambu_cloud_client
    except Exception:  # pragma: no cover — import guard
        return 0

    detail = bambu_cloud_client.get_ams_detail_for_serial(serial)
    if not detail:
        return 0
    # Cheap pre-check: skip the DB session entirely if no tray has a real tag.
    if not any(_is_real_tag_uid(s.get("tag_uid")) for s in detail.values()):
        return 0

    db = SessionLocal()
    try:
        printers = (
            db.query(PrinterConfig)
            .filter(PrinterConfig.bambu_serial == serial)
            .filter(PrinterConfig.is_active == True)  # noqa: E712
            .all()
        )
        total = 0
        for printer in printers:
            total += _autobind_for_printer(db, printer, detail)
        if total:
            db.commit()
            try:
                from . import ha_publisher
                ha_publisher.trigger()
            except Exception as exc:  # pragma: no cover
                log.debug("AMS auto-bind: ha_publisher.trigger failed: %s", exc)
        return total
    except Exception as exc:
        log.warning("AMS auto-bind failed for serial %s: %s", serial, exc, exc_info=True)
        try:
            db.rollback()
        except Exception:
            pass
        return 0
    finally:
        db.close()
