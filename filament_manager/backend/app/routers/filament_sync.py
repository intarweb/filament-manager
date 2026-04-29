"""
Bambu Lab Filament Sync router.

Keeps the local spool inventory in sync with the Bambu Cloud filament library.

Endpoints:
  GET  /api/filament-sync/status    — sync settings + stats
  PATCH /api/filament-sync/settings — update enabled / direction
  POST /api/filament-sync/pull      — pull Bambu → local (cloud wins)
  POST /api/filament-sync/push      — push local → Bambu (local wins)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Spool, UserPreferences
from .. import bambu_cloud_client

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/filament-sync", tags=["filament-sync"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _get_or_create_prefs(db: Session) -> UserPreferences:
    prefs = db.query(UserPreferences).filter(UserPreferences.id == 1).first()
    if not prefs:
        prefs = UserPreferences(id=1)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs


def _cloud_to_local(cloud: dict) -> dict:
    """Map a Bambu cloud filament JSON to local Spool field dict."""
    color_raw = str(cloud.get("color") or "").strip()
    color_hex = f"#{color_raw[:6]}" if len(color_raw) >= 6 else "#888888"

    # totalNetWeight = label weight (initial), netWeight = remaining weight
    initial = cloud.get("totalNetWeight") or cloud.get("total_weight") or 0
    current = cloud.get("netWeight") or cloud.get("net_weight") or initial

    return {
        "bambu_spool_id": str(cloud["id"]),
        "brand":          cloud.get("filamentVendor") or cloud.get("brand") or "",
        "material":       cloud.get("filamentType") or cloud.get("material_type") or "",
        "color_name":     cloud.get("filamentName") or cloud.get("color_name") or "",
        "color_hex":      color_hex,
        "initial_weight_g": float(initial),
        "current_weight_g": float(current),
        "notes":          cloud.get("note") or "",
    }


def _local_to_cloud(spool: Spool) -> dict:
    """Map a local Spool to a Bambu cloud filament create/update body."""
    color_hex = (spool.color_hex or "#888888").lstrip("#")
    return {
        "filamentVendor":  spool.brand or "",
        "filamentType":    spool.material or "",
        "filamentName":    spool.color_name or "",
        "color":           color_hex.upper()[:6] if color_hex else "888888",
        "totalNetWeight":  int(spool.initial_weight_g or 0),
        "netWeight":       int(spool.current_weight_g or 0),
        "note":            spool.notes or "",
    }


# ── Schemas ───────────────────────────────────────────────────────────────────

class SyncSettings(BaseModel):
    enabled:   bool
    direction: str   # 'pull' | 'push' | 'bidirectional'


class SyncStatus(BaseModel):
    enabled:        bool
    direction:      str
    last_sync_at:   str | None
    total_spools:   int
    linked_spools:  int


class SyncResult(BaseModel):
    created:   int
    updated:   int
    unchanged: int
    errors:    int


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/status", response_model=SyncStatus)
def get_sync_status(db: Session = Depends(get_db)):
    prefs = _get_or_create_prefs(db)
    total = db.query(Spool).filter(Spool.archived == False).count()  # noqa: E712
    linked = db.query(Spool).filter(
        Spool.bambu_spool_id != None,  # noqa: E711
        Spool.archived == False,        # noqa: E712
    ).count()
    return SyncStatus(
        enabled=bool(prefs.bambu_filament_sync_enabled),
        direction=prefs.bambu_filament_sync_direction or "pull",
        last_sync_at=prefs.bambu_filament_last_sync_at.isoformat() if prefs.bambu_filament_last_sync_at else None,
        total_spools=total,
        linked_spools=linked,
    )


@router.patch("/settings", response_model=SyncStatus)
def patch_sync_settings(body: SyncSettings, db: Session = Depends(get_db)):
    if body.direction not in ("pull", "push", "bidirectional"):
        raise HTTPException(400, "direction must be 'pull', 'push', or 'bidirectional'")
    prefs = _get_or_create_prefs(db)
    prefs.bambu_filament_sync_enabled   = body.enabled
    prefs.bambu_filament_sync_direction = body.direction
    db.commit()
    db.refresh(prefs)
    total = db.query(Spool).filter(Spool.archived == False).count()  # noqa: E712
    linked = db.query(Spool).filter(
        Spool.bambu_spool_id != None,  # noqa: E711
        Spool.archived == False,        # noqa: E712
    ).count()
    return SyncStatus(
        enabled=bool(prefs.bambu_filament_sync_enabled),
        direction=prefs.bambu_filament_sync_direction,
        last_sync_at=prefs.bambu_filament_last_sync_at.isoformat() if prefs.bambu_filament_last_sync_at else None,
        total_spools=total,
        linked_spools=linked,
    )


@router.post("/pull", response_model=SyncResult)
async def pull_from_cloud(db: Session = Depends(get_db)):
    """Pull filament data from Bambu Cloud → create / update local spools.

    Matching strategy (in order):
    1. bambu_spool_id match — existing linked spool
    2. No match — create new spool
    """
    cloud_status = bambu_cloud_client.get_status()
    if cloud_status["status"] != "connected":
        raise HTTPException(503, "Not connected to Bambu Cloud")

    cloud_spools = await bambu_cloud_client.list_all_filaments()
    log.info("Filament sync pull: %d cloud spools fetched", len(cloud_spools))

    created = updated = unchanged = errors = 0
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Build lookup of local spools by bambu_spool_id
    linked: dict[str, Spool] = {}
    for s in db.query(Spool).filter(Spool.bambu_spool_id != None).all():  # noqa: E711
        linked[s.bambu_spool_id] = s

    for cloud in cloud_spools:
        try:
            cloud_id = str(cloud.get("id", ""))
            if not cloud_id:
                continue
            fields = _cloud_to_local(cloud)

            if cloud_id in linked:
                spool = linked[cloud_id]
                changed = False
                for key, val in fields.items():
                    if key == "bambu_spool_id":
                        continue
                    if getattr(spool, key, None) != val:
                        setattr(spool, key, val)
                        changed = True
                if changed:
                    spool.updated_at   = now
                    spool.bambu_synced_at = now
                    updated += 1
                else:
                    spool.bambu_synced_at = now
                    unchanged += 1
            else:
                # New spool from cloud
                new_spool = Spool(
                    bambu_spool_id=fields["bambu_spool_id"],
                    brand=fields["brand"],
                    material=fields["material"] or "PLA",
                    color_name=fields["color_name"] or "Unknown",
                    color_hex=fields["color_hex"],
                    initial_weight_g=max(fields["initial_weight_g"], 1.0),
                    current_weight_g=max(fields["current_weight_g"], 0.0),
                    notes=fields["notes"],
                    bambu_synced_at=now,
                    created_at=now,
                    updated_at=now,
                )
                db.add(new_spool)
                created += 1
        except Exception as exc:
            log.warning("Filament sync pull: error processing cloud spool %s: %s", cloud.get("id"), exc)
            errors += 1

    # Update last sync timestamp
    prefs = _get_or_create_prefs(db)
    prefs.bambu_filament_last_sync_at = now
    db.commit()

    log.info("Filament sync pull done — created=%d updated=%d unchanged=%d errors=%d",
             created, updated, unchanged, errors)
    return SyncResult(created=created, updated=updated, unchanged=unchanged, errors=errors)


@router.post("/push", response_model=SyncResult)
async def push_to_cloud(db: Session = Depends(get_db)):
    """Push local spools to Bambu Cloud.

    - Spools with bambu_spool_id: update cloud record
    - Spools without bambu_spool_id: create in cloud, save returned ID
    Only non-archived spools are pushed.
    """
    cloud_status = bambu_cloud_client.get_status()
    if cloud_status["status"] != "connected":
        raise HTTPException(503, "Not connected to Bambu Cloud")

    local_spools = db.query(Spool).filter(Spool.archived == False).all()  # noqa: E712
    log.info("Filament sync push: %d local spools to push", len(local_spools))

    created = updated = unchanged = errors = 0
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    for spool in local_spools:
        try:
            body = _local_to_cloud(spool)
            if spool.bambu_spool_id:
                # Update existing cloud record
                await bambu_cloud_client.update_filament(spool.bambu_spool_id, body)
                spool.bambu_synced_at = now
                updated += 1
            else:
                # Create new cloud record
                result = await bambu_cloud_client.create_filament(body)
                cloud_id = result.get("id") or (result.get("data") or {}).get("id")
                if cloud_id:
                    spool.bambu_spool_id = str(cloud_id)
                spool.bambu_synced_at = now
                created += 1
        except HTTPException:
            errors += 1
            log.warning("Filament sync push: HTTP error for spool %d", spool.id)
        except Exception as exc:
            log.warning("Filament sync push: error for spool %d: %s", spool.id, exc)
            errors += 1

    prefs = _get_or_create_prefs(db)
    prefs.bambu_filament_last_sync_at = now
    db.commit()

    log.info("Filament sync push done — created=%d updated=%d unchanged=%d errors=%d",
             created, updated, unchanged, errors)
    return SyncResult(created=created, updated=updated, unchanged=unchanged, errors=errors)
