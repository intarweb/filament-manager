"""
Tests for new spool inventory/consumed sensors in ha_publisher._compute().

The existing sensors (pending_usages, low_stock, ams_unmatched, last_print) are
not tested here. The AMS-unmatched section iterates PrinterConfig rows; since
tests use an empty DB with no PrinterConfig records, bambu_cloud_client is never
called and no mock is needed.
"""
import pytest
from app.ha_publisher import _compute
from app.models import Spool


def _make_spool(session, *, material: str, weight_g: float, archived: bool = False) -> Spool:
    s = Spool(
        brand="Test",
        material=material,
        color_name="White",
        color_hex="#FFFFFF",
        initial_weight_g=weight_g,
        current_weight_g=weight_g,
        archived=archived,
    )
    session.add(s)
    session.commit()
    return s


class TestSpoolInventorySensor:
    def test_total_counts_only_non_archived(self, session):
        _make_spool(session, material="PLA",  weight_g=1000)
        _make_spool(session, material="PLA",  weight_g=200)
        _make_spool(session, material="PETG", weight_g=800, archived=True)  # archived — excluded

        state, attrs = _compute(session)["sensor.filament_manager_total_spools"]

        assert state == 2
        assert attrs["by_material"] == {"PLA": 2}

    def test_total_by_material_sorted(self, session):
        _make_spool(session, material="PETG", weight_g=500)
        _make_spool(session, material="ABS",  weight_g=500)
        _make_spool(session, material="PLA",  weight_g=500)

        state, attrs = _compute(session)["sensor.filament_manager_total_spools"]

        assert state == 3
        assert list(attrs["by_material"].keys()) == ["ABS", "PETG", "PLA"]

    def test_total_empty_inventory(self, session):
        state, attrs = _compute(session)["sensor.filament_manager_total_spools"]

        assert state == 0
        assert attrs["by_material"] == {}


class TestSpoolConsumedSensor:
    def test_consumed_counts_zero_weight_spools(self, session):
        _make_spool(session, material="PLA",  weight_g=0)     # empty, active
        _make_spool(session, material="PLA",  weight_g=0, archived=True)  # empty, archived
        _make_spool(session, material="PETG", weight_g=500)   # still has filament

        state, attrs = _compute(session)["sensor.filament_manager_consumed_spools"]

        assert state == 2
        assert attrs["by_material"] == {"PLA": 2}

    def test_consumed_excludes_spools_with_remaining_weight(self, session):
        _make_spool(session, material="PLA", weight_g=50)   # low but not empty
        _make_spool(session, material="PLA", weight_g=1000)

        state, _ = _compute(session)["sensor.filament_manager_consumed_spools"]

        assert state == 0

    def test_consumed_empty_inventory(self, session):
        state, attrs = _compute(session)["sensor.filament_manager_consumed_spools"]

        assert state == 0
        assert attrs["by_material"] == {}
