"""
Integration tests for /api/printers endpoints.

HA client calls (get_all_entities, get_entity_value, is_ha_available) are
mocked so tests run without a real Home Assistant instance.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from tests.conftest import make_spool_payload


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PRINTER_PAYLOAD = {
    "name": "My Printer",
    "ams_unit_count": 1,
    "is_active": True,
}


def _create_printer(client, **overrides):
    payload = dict(PRINTER_PAYLOAD)
    payload.update(overrides)
    r = client.post("/api/printers", json=payload)
    assert r.status_code == 201
    return r.json()


def _create_spool(client, **kw):
    r = client.post("/api/spools", json=make_spool_payload(**kw))
    assert r.status_code == 201
    return r.json()


# ---------------------------------------------------------------------------
# GET /api/printers
# ---------------------------------------------------------------------------

class TestListPrinters:
    def test_empty_returns_list(self, client):
        r = client.get("/api/printers")
        assert r.status_code == 200
        assert r.json() == []

    def test_returns_created_printers(self, client):
        _create_printer(client)
        r = client.get("/api/printers")
        assert len(r.json()) == 1


# ---------------------------------------------------------------------------
# POST /api/printers
# ---------------------------------------------------------------------------

class TestCreatePrinter:
    def test_returns_201(self, client):
        r = client.post("/api/printers", json=PRINTER_PAYLOAD)
        assert r.status_code == 201

    def test_stores_fields(self, client):
        data = _create_printer(client)
        assert data["name"] == "My Printer"
        assert data["ams_unit_count"] == 1
        assert data["is_active"] is True
        assert data["bambu_serial"] is None
        assert data["id"] > 0

    def test_stores_bambu_serial(self, client):
        data = _create_printer(client, bambu_serial="ABC123")
        assert data["bambu_serial"] == "ABC123"

    def test_missing_name_returns_422(self, client):
        r = client.post("/api/printers", json={})
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/printers/{id}
# ---------------------------------------------------------------------------

class TestGetPrinter:
    def test_get_existing(self, client):
        printer_id = _create_printer(client)["id"]
        r = client.get(f"/api/printers/{printer_id}")
        assert r.status_code == 200
        assert r.json()["id"] == printer_id

    def test_get_nonexistent_returns_404(self, client):
        assert client.get("/api/printers/9999").status_code == 404


# ---------------------------------------------------------------------------
# PATCH /api/printers/{id}
# ---------------------------------------------------------------------------

class TestUpdatePrinter:
    def test_update_name(self, client):
        printer_id = _create_printer(client)["id"]
        r = client.patch(f"/api/printers/{printer_id}", json={"name": "New Name"})
        assert r.status_code == 200
        assert r.json()["name"] == "New Name"

    def test_update_ams_unit_count(self, client):
        printer_id = _create_printer(client)["id"]
        r = client.patch(f"/api/printers/{printer_id}", json={
            "name": "My Printer",
            "ams_unit_count": 2,
        })
        assert r.json()["ams_unit_count"] == 2

    def test_update_nonexistent_returns_404(self, client):
        r = client.patch("/api/printers/9999", json=PRINTER_PAYLOAD)
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/printers/{id}
# ---------------------------------------------------------------------------

class TestDeletePrinter:
    def test_delete_returns_204(self, client):
        printer_id = _create_printer(client)["id"]
        assert client.delete(f"/api/printers/{printer_id}").status_code == 204

    def test_delete_removes_printer(self, client):
        printer_id = _create_printer(client)["id"]
        client.delete(f"/api/printers/{printer_id}")
        assert client.get(f"/api/printers/{printer_id}").status_code == 404

    def test_delete_nonexistent_returns_404(self, client):
        assert client.delete("/api/printers/9999").status_code == 404


# ---------------------------------------------------------------------------
# GET /api/printers/{id}/status  (mocked HA)
# ---------------------------------------------------------------------------

class TestPrinterStatus:
    def test_returns_status_dict_no_serial(self, client):
        # Printer with no bambu_serial → all fields None (no MQTT data)
        printer_id = _create_printer(client)["id"]
        r = client.get(f"/api/printers/{printer_id}/status")
        assert r.status_code == 200
        data = r.json()
        assert "print_stage" in data
        assert data["print_stage"] is None

    def test_returns_status_dict_with_serial(self, client):
        printer_id = _create_printer(client, bambu_serial="ABC123")["id"]
        fake_status = {"gcode_state": "IDLE", "mc_percent": 0, "mc_remaining_time": 0,
                       "nozzle_temper": 25, "bed_temper": 20, "subtask_name": None,
                       "gcode_file_weight": None, "tray_now": None}
        with patch("app.bambu_cloud_client.get_printer_cloud_status", return_value=fake_status):
            with patch("app.bambu_cloud_client.get_ams_unit_tray_counts", return_value={}):
                r = client.get(f"/api/printers/{printer_id}/status")
        assert r.status_code == 200
        assert r.json()["print_stage"] == "IDLE"

    def test_status_nonexistent_printer_returns_404(self, client):
        r = client.get("/api/printers/9999/status")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/printers/{id}/ams/{slot_key}/assign
# ---------------------------------------------------------------------------

class TestAssignAMSTray:
    def test_assign_spool_to_tray(self, client):
        printer = _create_printer(client)
        spool = _create_spool(client)

        r = client.post(
            f"/api/printers/{printer['id']}/ams/ams1_tray1/assign",
            json={"spool_id": spool["id"]},
        )
        assert r.status_code == 200
        assert r.json()["ok"] is True

        spool_data = client.get(f"/api/spools/{spool['id']}").json()
        assert spool_data["ams_slot"] == "My Printer:ams1_tray1"

    def test_unassign_spool_from_tray(self, client):
        printer = _create_printer(client)
        spool = _create_spool(client)

        # Assign first
        client.post(
            f"/api/printers/{printer['id']}/ams/ams1_tray1/assign",
            json={"spool_id": spool["id"]},
        )
        # Then unassign
        r = client.post(
            f"/api/printers/{printer['id']}/ams/ams1_tray1/assign",
            json={"spool_id": None},
        )
        assert r.status_code == 200
        spool_data = client.get(f"/api/spools/{spool['id']}").json()
        assert spool_data["ams_slot"] is None

    def test_reassign_clears_previous_spool(self, client):
        printer = _create_printer(client)
        spool1 = _create_spool(client, color_name="Red")
        spool2 = _create_spool(client, color_name="Blue")

        client.post(f"/api/printers/{printer['id']}/ams/ams1_tray1/assign",
                    json={"spool_id": spool1["id"]})
        client.post(f"/api/printers/{printer['id']}/ams/ams1_tray1/assign",
                    json={"spool_id": spool2["id"]})

        # spool1 should be unassigned
        assert client.get(f"/api/spools/{spool1['id']}").json()["ams_slot"] is None
        # spool2 should be assigned
        assert client.get(f"/api/spools/{spool2['id']}").json()["ams_slot"] == "My Printer:ams1_tray1"

    def test_assign_invalid_printer_returns_404(self, client):
        spool = _create_spool(client)
        r = client.post(
            "/api/printers/9999/ams/ams1_tray1/assign",
            json={"spool_id": spool["id"]},
        )
        assert r.status_code == 404

    def test_assign_invalid_spool_returns_404(self, client):
        printer = _create_printer(client)
        r = client.post(
            f"/api/printers/{printer['id']}/ams/ams1_tray1/assign",
            json={"spool_id": 9999},
        )
        assert r.status_code == 404
