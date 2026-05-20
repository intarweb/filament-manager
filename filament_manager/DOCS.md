# Filament Manager

Track 3D printer filament inventory, print history, and material costs. Connects directly to Bambu Lab printers via **Bambu Lab Cloud (MQTT)** — no third-party HA integration required.

## Prerequisites

- A Bambu Lab account (email + password)
- Home Assistant with Supervisor

## First-time Setup

1. Open the add-on and go to **Settings → Cloud Config**.
2. Under **Bambu Lab Cloud**, enter your account email and password and click **Connect** (complete 2FA if prompted).
3. Go to **Settings → Printers → Add Printer**, select your device from the dropdown, and save.
4. Add your filament spools under **Spools**.

## Features

- **Automatic print tracking** — detects print start/end via Bambu Cloud MQTT; creates print records automatically
- **AMS filament tracking** — snapshots filament levels at print start/end; calculates grams used per spool per tray
- **Suggested filament usage** — on print completion the app pre-fills grams used per tray for review; an optional per-printer *auto-deduct* flag applies the deduction immediately without confirmation
- **Multi-spool print support** — spool swaps and AMS auto-switches are detected; the Log Usage modal shows split rows with pre-calculated estimates
- **Live print status** — active print jobs show real-time stage, progress, remaining time, and active tray
- **Spool inventory** — full CRUD for filament spools with brand, material, color, weight, cost, and more
- **Cost analytics** — per-print cost, price per kg, inventory value, and spend by purchase location
- **Energy tracking** — configure a cumulative kWh HA sensor per printer; energy and cost are recorded per print
- **Print Projects** — group prints into named projects with aggregated stats
- **Dashboard** — overview charts, low-stock alerts, and recent print history
- **Data export / import** — full JSON backup/restore, spool CSV, Bambu Cloud history import, Spoolman export

## Home Assistant Sensors

Three sensors are pushed automatically via the HA States API (no configuration required):

| Entity | Description |
|---|---|
| `sensor.filament_manager_pending_usages` | Prints awaiting filament usage confirmation |
| `sensor.filament_manager_low_stock` | Spools below the low-stock threshold |
| `sensor.filament_manager_unmatched_trays` | AMS trays with no matching spool in inventory |

## Data

All data is stored in `/data/filament.db`. This file is never modified by app updates — your inventory and print history are safe across upgrades.

## Support

Report issues at [github.com/cgradl/filament-manager](https://github.com/cgradl/filament-manager/issues).
