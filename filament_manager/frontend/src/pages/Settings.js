import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { Plus, Trash2, X, RefreshCw, CheckCircle, AlertCircle, Pencil, ChevronDown, ChevronUp, ChevronsUpDown, Download, Upload, Wifi, WifiOff, Sparkles } from 'lucide-react';
import Modal from '../components/Modal';
import BambuCloudSection from '../components/BambuCloudSection';
import FilamentSyncSection from '../components/FilamentSyncSection';
import { findBestSpoolMatch } from '../utils/amsMatch';
// ── Cloud Printer Form ────────────────────────────────────────────────────────
function CloudPrinterFormContent({ initial, onSave, onCancel, cloudStatus, existingPrinters, }) {
    const { t } = useTranslation();
    const [selectedSerial, setSelectedSerial] = useState(initial?.bambu_serial ?? '');
    const [name, setName] = useState(initial?.name ?? '');
    const [isActive, setIsActive] = useState(initial?.is_active ?? true);
    const [autoDeduct, setAutoDeduct] = useState(initial?.auto_deduct ?? false);
    const [energySensorEntityId, setEnergySensorEntityId] = useState(initial?.energy_sensor_entity_id ?? '');
    const [priceSensorEntityId, setPriceSensorEntityId] = useState(initial?.price_sensor_entity_id ?? '');
    const [energySensorPreview, setEnergySensorPreview] = useState(undefined);
    const [priceSensorPreview, setPriceSensorPreview] = useState(undefined);
    const [activeAmsUnit, setActiveAmsUnit] = useState(1);
    const fetchSensorPreview = async (entityId, setter) => {
        if (!entityId.trim()) {
            setter(undefined);
            return;
        }
        setter(undefined); // reset to loading
        try {
            const res = await api.getHASensorValue(entityId.trim());
            setter(res.value);
        }
        catch {
            setter(null);
        }
    };
    const isConnected = cloudStatus?.status === 'connected';
    // Serials already configured as cloud printers (excluding the one being edited)
    const configuredSerials = new Set(existingPrinters
        .filter(p => p.bambu_source === 'cloud' && p.bambu_serial && p.id !== initial?.id)
        .map(p => p.bambu_serial));
    const { data: devices = [] } = useQuery({
        queryKey: ['bambu-cloud-devices'],
        queryFn: api.getBambuCloudDevices,
        enabled: isConnected,
    });
    // Devices not yet configured as a cloud printer
    const availableDevices = devices.filter(d => !configuredSerials.has(d.serial));
    const { data: liveStatus } = useQuery({
        queryKey: ['cloud-status', selectedSerial],
        queryFn: () => api.getBambuCloudPrinterStatus(selectedSerial),
        enabled: !!selectedSerial,
        refetchInterval: 10000,
    });
    const { data: amsTrays } = useQuery({
        queryKey: ['cloud-ams', selectedSerial],
        queryFn: () => api.getBambuCloudPrinterAMS(selectedSerial),
        enabled: !!selectedSerial,
        refetchInterval: 10000,
    });
    const handleSelectDevice = (serial, deviceName) => {
        setSelectedSerial(serial);
        if (!initial && !name)
            setName(deviceName);
    };
    // Detect AMS units from tray slot_keys
    const amsUnits = amsTrays
        ? Array.from(new Set(amsTrays.map(tr => {
            const m = tr.slot_key.match(/^ams(\d+)_/);
            return m ? parseInt(m[1]) : 1;
        }))).sort()
        : [];
    const visibleAmsUnit = amsUnits.includes(activeAmsUnit) ? activeAmsUnit : (amsUnits[0] ?? 1);
    const STATUS_LABELS = {
        print_stage: t('settings.bambuCloud.statusStage'), print_progress: t('settings.bambuCloud.statusProgress'),
        remaining_time: t('settings.bambuCloud.statusRemaining'), nozzle_temp: t('settings.bambuCloud.statusNozzle'),
        bed_temp: t('settings.bambuCloud.statusBed'), current_file: t('settings.bambuCloud.statusFile'),
    };
    const STATUS_UNITS = {
        nozzle_temp: '°C', bed_temp: '°C', print_progress: '%', remaining_time: ' min',
    };
    const statusEntries = liveStatus
        ? Object.entries(liveStatus).filter(([, v]) => v != null && v !== '')
        : [];
    const canSave = isConnected && !!selectedSerial && !!name.trim();
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "p-5 space-y-4", children: !isConnected ? (_jsxs("div", { className: "flex items-start gap-2 text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded px-3 py-3", children: [_jsx(AlertCircle, { size: 13, className: "mt-0.5 shrink-0" }), _jsx("span", { children: t('settings.bambuCloud.notConnectedHint') })] })) : (_jsxs(_Fragment, { children: [!initial ? (_jsxs("div", { children: [_jsx("label", { className: "label", children: t('settings.bambuCloud.selectDevice') }), availableDevices.length === 0 && devices.length > 0 ? (_jsx("p", { className: "text-xs text-gray-500", children: "All cloud printers are already configured." })) : availableDevices.length === 0 ? (_jsx("p", { className: "text-xs text-gray-500", children: t('settings.bambuCloud.noDevices') })) : (_jsxs("select", { className: "input w-full", value: selectedSerial, onChange: e => {
                                        const serial = e.target.value;
                                        const device = availableDevices.find(d => d.serial === serial);
                                        if (device)
                                            handleSelectDevice(serial, device.name);
                                        else
                                            setSelectedSerial('');
                                    }, children: [_jsxs("option", { value: "", children: [t('settings.bambuCloud.selectDevice'), "\u2026"] }), availableDevices.map(d => (_jsxs("option", { value: d.serial, children: [d.name, "  ", d.model] }, d.serial)))] }))] })) : (_jsxs("div", { className: "flex items-center gap-2 text-xs bg-surface-3/40 rounded-lg px-3 py-2", children: [_jsxs("span", { className: "text-gray-400", children: [t('settings.bambuCloud.serial'), ":"] }), _jsxs("span", { className: "font-mono text-gray-300", children: ['•'.repeat(8), initial.bambu_serial?.slice(-4)] }), _jsx("span", { className: "text-gray-600 text-[10px] ml-1", children: "(locked)" })] })), _jsxs("div", { children: [_jsxs("label", { className: "label", children: [t('settings.printers.name'), " *"] }), _jsx("input", { className: "input", value: name, onChange: e => setName(e.target.value), placeholder: "My Printer" })] }), _jsxs("label", { className: "flex items-center gap-2 text-sm cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: isActive, onChange: e => setIsActive(e.target.checked) }), t('settings.printers.monitorPrinter')] }), _jsxs("label", { className: "flex items-center gap-2 text-sm cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: autoDeduct, onChange: e => setAutoDeduct(e.target.checked) }), _jsx("span", { children: t('settings.printers.autoDeduct') }), _jsx("span", { className: "text-[10px] text-amber-400 border border-amber-400/50 rounded px-1 py-0.5 leading-none", children: t('common.experimental') })] }), _jsxs("div", { className: "border-t border-surface-3 pt-3 space-y-3", children: [_jsx("p", { className: "text-xs font-medium text-gray-400", children: t('settings.printers.energyTracking') }), _jsxs("div", { children: [_jsx("label", { className: "label", children: t('settings.printers.energySensor') }), _jsx("input", { className: "input", value: energySensorEntityId, onChange: e => { setEnergySensorEntityId(e.target.value); setEnergySensorPreview(undefined); }, onBlur: () => fetchSensorPreview(energySensorEntityId, setEnergySensorPreview), placeholder: "sensor.shelly_energy_total" }), energySensorEntityId && energySensorPreview !== undefined && (_jsx("p", { className: `text-[11px] mt-1 font-mono ${energySensorPreview === null ? 'text-red-400' : 'text-green-400'}`, children: energySensorPreview === null ? '✗ entity not found or not numeric' : `✓ ${energySensorPreview} kWh` })), _jsx("p", { className: "text-[11px] text-gray-500 mt-1", children: t('settings.printers.energySensorHint') })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: t('settings.printers.priceSensor') }), _jsx("input", { className: "input", value: priceSensorEntityId, onChange: e => { setPriceSensorEntityId(e.target.value); setPriceSensorPreview(undefined); }, onBlur: () => fetchSensorPreview(priceSensorEntityId, setPriceSensorPreview), placeholder: "input_number.electricity_price" }), priceSensorEntityId && priceSensorPreview !== undefined && (_jsx("p", { className: `text-[11px] mt-1 font-mono ${priceSensorPreview === null ? 'text-red-400' : 'text-green-400'}`, children: priceSensorPreview === null ? '✗ entity not found or not numeric' : `✓ ${priceSensorPreview} €/kWh` })), _jsx("p", { className: "text-[11px] text-gray-500 mt-1", children: t('settings.printers.priceSensorHint') })] })] }), selectedSerial && (_jsxs("div", { className: "bg-surface-3/40 rounded-xl p-3 space-y-3", children: [statusEntries.length > 0 ? (_jsx("div", { className: "grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-400", children: statusEntries.map(([key, val]) => (_jsxs("span", { children: [STATUS_LABELS[key] ?? key, ": ", _jsxs("span", { className: "text-white", children: [val, STATUS_UNITS[key] ?? ''] })] }, key))) })) : (_jsx("p", { className: "text-xs text-gray-500", children: t('settings.bambuCloud.noStatusData') })), amsTrays && amsTrays.length > 0 && (_jsxs("div", { className: "border-t border-surface-3 pt-2", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("p", { className: "text-xs font-medium text-gray-400", children: t('settings.printers.amsAssignment') }), amsUnits.length > 1 && (_jsx("div", { className: "flex rounded overflow-hidden border border-surface-3 text-xs", children: amsUnits.map(u => (_jsxs("button", { onClick: () => setActiveAmsUnit(u), className: `px-2.5 py-0.5 transition-colors ${visibleAmsUnit === u ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-gray-200'}`, children: ["AMS ", u] }, u))) }))] }), _jsx("div", { className: "space-y-1", children: amsTrays
                                                .filter(tr => {
                                                const m = tr.slot_key.match(/^ams(\d+)_/);
                                                return m ? parseInt(m[1]) === visibleAmsUnit : true;
                                            })
                                                .map(tr => (_jsxs("div", { className: "flex items-center gap-2 bg-surface-3/40 rounded px-2 py-1 text-xs", children: [_jsx("span", { className: "font-mono text-gray-400 w-20 shrink-0", children: tr.slot_key }), tr.ha_color_hex ? (_jsx("span", { className: "w-3 h-3 rounded-full border border-white/20 shrink-0", style: { background: tr.ha_color_hex } })) : (_jsx("span", { className: "w-3 h-3 rounded-full bg-surface-3 border border-white/10 shrink-0" })), _jsx("span", { className: "text-gray-300 flex-1", children: tr.ha_material ?? '—' }), _jsx("span", { className: "text-gray-400", children: tr.ha_remaining != null ? `${tr.ha_remaining}%` : '—' })] }, tr.slot_key))) })] }))] }))] })) }), _jsxs("div", { className: "flex justify-end gap-2 px-5 py-4 border-t border-surface-3", children: [_jsx("button", { className: "btn-ghost", onClick: onCancel, children: t('common.cancel') }), _jsx("button", { className: "btn-primary", onClick: () => onSave({
                            name: name.trim(),
                            bambu_serial: selectedSerial,
                            bambu_source: 'cloud',
                            is_active: isActive,
                            auto_deduct: autoDeduct,
                            energy_sensor_entity_id: energySensorEntityId.trim() || null,
                            price_sensor_entity_id: priceSensorEntityId.trim() || null,
                        }), disabled: !canSave, children: t('common.save') })] })] }));
}
// ── Printer Form Modal ────────────────────────────────────────────────────────
function PrinterFormModal({ initial, onSave, onCancel, cloudStatus, existingPrinters, }) {
    const { t } = useTranslation();
    const title = initial ? t('settings.printers.editPrinter') : t('settings.printers.addPrinter');
    return (_jsx("div", { className: "fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4", children: _jsxs("div", { className: "bg-surface-2 border border-surface-3 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-surface-3", children: [_jsx("h2", { className: "font-semibold", children: title }), _jsx("button", { onClick: onCancel, className: "btn-ghost p-1", children: _jsx(X, { size: 16 }) })] }), _jsx(CloudPrinterFormContent, { initial: initial, onSave: onSave, onCancel: onCancel, cloudStatus: cloudStatus, existingPrinters: existingPrinters })] }) }));
}
// ── AMS Tray Panel ────────────────────────────────────────────────────────────
function AMSTrayPanel({ printer }) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const [activeUnit, setActiveUnit] = useState(1);
    const { data: trays, isLoading, refetch } = useQuery({
        queryKey: ['printer-ams', printer.id],
        queryFn: () => api.getPrinterAMS(printer.id),
        refetchInterval: 30000,
    });
    const { data: spools = [] } = useQuery({
        queryKey: ['spools'],
        queryFn: () => api.getSpools(),
    });
    const assignMut = useMutation({
        mutationFn: ({ slot, spoolId }) => api.assignAMSTray(printer.id, slot, spoolId),
        onSuccess: (result) => {
            qc.invalidateQueries({ queryKey: ['printer-ams'] }); // all printers — spool may have moved
            qc.invalidateQueries({ queryKey: ['spools'] });
            if (result.previous_slot) {
                const parts = result.previous_slot.split(':');
                const [prevPrinter, prevSlot] = parts.length === 2 ? parts : ['', parts[0]];
                const slotLabel = prevSlot.replace(/ams(\d+)_tray(\d+)/, 'AMS $1 Tray $2');
                const location = prevPrinter ? `${prevPrinter} / ${slotLabel}` : slotLabel;
                alert(`Spool was already assigned to ${location} — it has been moved here.`);
            }
        },
    });
    const [syncingSlot, setSyncingSlot] = useState(null);
    const syncSlotMut = useMutation({
        mutationFn: (slotKey) => api.syncAMSTrayWeight(printer.id, slotKey),
        onMutate: (slotKey) => setSyncingSlot(slotKey),
        onSettled: () => setSyncingSlot(null),
        onSuccess: (result) => {
            qc.invalidateQueries({ queryKey: ['spools'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            alert(`Updated ${result.spool_name}: ${result.remaining_pct}% → ${result.new_weight_g} g`);
        },
        onError: (err) => {
            alert(err instanceof Error ? err.message : 'Sync failed — no valid HA data for this tray');
        },
    });
    const syncAllMut = useMutation({
        mutationFn: () => api.syncAMSWeights(printer.id),
        onSuccess: (result) => {
            qc.invalidateQueries({ queryKey: ['spools'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            const n = result.updated.length;
            alert(n > 0 ? `Synced ${n} Bambu Lab spool${n > 1 ? 's' : ''}` : 'No Bambu Lab spools to sync');
        },
        onError: (err) => {
            alert(err instanceof Error ? err.message : 'Sync all failed');
        },
    });
    const autoMatchAllMut = useMutation({
        mutationFn: async () => {
            const visibleTrays = (trays ?? []).filter(t => t.ams_id === visibleUnit);
            let matched = 0;
            // seed with spools already assigned to other AMS units on this printer
            const assignedIds = new Set((trays ?? [])
                .filter(t => t.ams_id !== visibleUnit && t.spool?.id != null)
                .map(t => t.spool.id));
            for (const tray of visibleTrays) {
                const best = findBestSpoolMatch(tray, spools, assignedIds);
                if (best && best.id !== tray.spool?.id) {
                    await api.assignAMSTray(printer.id, tray.slot_key, best.id);
                    matched++;
                }
                if (best)
                    assignedIds.add(best.id);
            }
            return matched;
        },
        onSuccess: (matched) => {
            qc.invalidateQueries({ queryKey: ['printer-ams'] });
            qc.invalidateQueries({ queryKey: ['spools'] });
            alert(matched > 0
                ? `${t('settings.printers.autoMatchResult', { count: matched })}`
                : t('settings.printers.autoMatchNone'));
        },
        onError: (err) => {
            alert(err instanceof Error ? err.message : 'Auto-match failed');
        },
    });
    if (isLoading)
        return _jsx("p", { className: "text-xs text-gray-500 py-2", children: t('settings.printers.loadingAMS') });
    if (!trays?.length)
        return _jsx("p", { className: "text-xs text-gray-500 py-2", children: t('settings.printers.noAMSData') });
    const units = Array.from(new Set(trays.map(t => t.ams_id))).sort();
    const visibleUnit = units.includes(activeUnit) ? activeUnit : units[0];
    return (_jsxs("div", { className: "mt-3", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("p", { className: "text-xs font-medium text-gray-400", children: t('settings.printers.amsAssignment') }), units.length > 1 && (_jsx("div", { className: "flex rounded overflow-hidden border border-surface-3 text-xs", children: units.map(u => (_jsxs("button", { onClick: () => setActiveUnit(u), className: `px-2.5 py-0.5 transition-colors ${visibleUnit === u ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-gray-200'}`, children: ["AMS ", u] }, u))) }))] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsxs("button", { className: "btn-ghost px-2 py-0.5 text-xs flex items-center gap-1", onClick: () => autoMatchAllMut.mutate(), disabled: autoMatchAllMut.isPending, title: t('settings.printers.autoMatchAll'), children: [_jsx(Sparkles, { size: 10 }), t('settings.printers.autoMatchAll')] }), _jsx("button", { className: "btn-ghost px-2 py-0.5 text-xs", onClick: () => syncAllMut.mutate(), disabled: syncAllMut.isPending, title: "Sync remaining % for all Bambu Lab spools", children: syncAllMut.isPending ? _jsx(RefreshCw, { size: 10, className: "animate-spin" }) : t('settings.printers.syncAll') }), _jsx("button", { className: "btn-ghost p-1", onClick: () => refetch(), title: "Refresh display", children: _jsx(RefreshCw, { size: 11 }) })] })] }), _jsx("div", { className: "space-y-1.5", children: trays.filter(t => t.ams_id === visibleUnit).map(tray => {
                    const otherAssigned = new Set(trays
                        .filter(t => t.slot_key !== tray.slot_key && t.spool?.id != null)
                        .map(t => t.spool.id));
                    return (_jsx(AMSTrayRow, { tray: tray, spools: spools, onAssign: (spoolId) => assignMut.mutate({ slot: tray.slot_key, spoolId }), saving: assignMut.isPending, onSyncWeight: () => syncSlotMut.mutate(tray.slot_key), syncingWeight: syncingSlot === tray.slot_key, canSync: tray.ha_remaining != null && parseFloat(tray.ha_remaining) >= 0, excludeIds: otherAssigned }, tray.slot_key));
                }) })] }));
}
function AMSTrayRow({ tray, spools, onAssign, saving, onSyncWeight, syncingWeight, canSync, excludeIds, }) {
    const { t } = useTranslation();
    const selectedId = tray.spool?.id ?? null;
    return (_jsxs("div", { className: "flex items-center gap-2 bg-surface-3/40 rounded-lg px-3 py-2", children: [_jsxs("span", { className: "text-xs font-mono text-gray-400 w-6 shrink-0", children: ["T", tray.tray] }), _jsxs("div", { className: "flex items-center gap-1.5 min-w-0 w-28 shrink-0", children: [tray.ha_color_hex ? (_jsx("span", { className: "w-3 h-3 rounded-full border border-white/20 shrink-0", style: { background: tray.ha_color_hex } })) : (_jsx("span", { className: "w-3 h-3 rounded-full bg-surface-3 border border-white/10 shrink-0" })), _jsx("span", { className: "text-xs text-gray-500 truncate", children: tray.ha_material ?? '—' })] }), _jsx("span", { className: "text-xs text-gray-500 w-10 shrink-0 text-right", children: tray.ha_remaining != null ? `${Math.round(parseFloat(tray.ha_remaining))}%` : '—' }), _jsxs("select", { className: "input text-xs flex-1 py-1 min-w-0", value: selectedId ?? '', disabled: saving, onChange: e => onAssign(e.target.value ? Number(e.target.value) : null), children: [_jsx("option", { value: "", children: t('settings.printers.unassigned') }), spools
                        .filter(s => Math.round(s.remaining_pct) > 0)
                        .sort((a, b) => {
                        const bc = a.brand.localeCompare(b.brand);
                        if (bc !== 0)
                            return bc;
                        const mc = a.material.localeCompare(b.material);
                        if (mc !== 0)
                            return mc;
                        return a.color_name.localeCompare(b.color_name);
                    })
                        .map(s => (_jsxs("option", { value: s.id, children: [s.custom_id != null ? `#${s.custom_id} ` : '', s.brand, " ", s.material, s.subtype ? ` ${s.subtype}` : '', " \u00B7 ", s.color_name, " (", Math.round(s.remaining_pct), "%)"] }, s.id)))] }), tray.ha_material && tray.ha_color_hex && (() => {
                const match = findBestSpoolMatch(tray, spools, excludeIds);
                const alreadyOptimal = match != null && tray.spool?.id === match.id;
                return (_jsx("button", { onClick: () => match && onAssign(match.id), disabled: !match || saving, title: match
                        ? `${t('settings.printers.autoMatchTray')}: ${match.custom_id != null ? `#${match.custom_id} ` : ''}${match.brand} ${match.material} · ${match.color_name} (${Math.round(match.remaining_pct)}%)`
                        : t('settings.printers.autoMatchNone'), className: `btn-ghost p-1 shrink-0 ${alreadyOptimal ? 'text-green-400 cursor-default' :
                        match ? 'text-amber-400 hover:text-amber-300' :
                            'text-gray-600 cursor-not-allowed'}`, children: _jsx(Sparkles, { size: 10 }) }));
            })(), tray.spool ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "w-3 h-3 rounded-full border border-white/20 shrink-0", style: { background: tray.spool.color_hex }, title: tray.spool.color_name }), canSync ? (_jsx("button", { className: "btn-ghost p-1 shrink-0 text-gray-400 hover:text-white", onClick: onSyncWeight, disabled: syncingWeight, title: "Sync weight from AMS", children: _jsx(RefreshCw, { size: 10, className: syncingWeight ? 'animate-spin' : '' }) })) : (_jsx("span", { className: "w-6 h-6 shrink-0" }))] })) : (_jsx("span", { className: "w-3 h-3 shrink-0" }))] }));
}
// ── Standby Section (inside PrinterCard) ─────────────────────────────────────
function StandbySection({ printer }) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const resetMut = useMutation({
        mutationFn: () => api.resetPrinterStandby(printer.id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['printers'] }),
    });
    return (_jsx("div", { className: "mt-3 border-t border-surface-3 pt-2", children: _jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5", children: t('settings.printers.standbyKwh') }), _jsx("p", { className: "text-sm text-gray-200", children: printer.standby_kwh != null ? `${printer.standby_kwh.toFixed(3)} kWh` : '—' }), _jsx("p", { className: "text-[10px] text-gray-500 mt-0.5", children: t('settings.printers.standbyHint') })] }), _jsx("button", { className: "btn-ghost text-xs px-3 py-1.5 shrink-0", onClick: () => resetMut.mutate(), disabled: resetMut.isPending, title: t('settings.printers.resetStandby'), children: t('settings.printers.resetStandby') })] }) }));
}
// ── Printer Card ──────────────────────────────────────────────────────────────
function PrinterCard({ printer, onEdit, onDelete }) {
    const { t } = useTranslation();
    const { data: status, refetch, isFetching } = useQuery({
        queryKey: ['printer-status', printer.id],
        queryFn: () => api.getPrinterStatus(printer.id),
        refetchInterval: 30000,
        enabled: printer.is_active,
    });
    const stage = status?.print_stage?.toLowerCase() ?? 'unknown';
    const isPrinting = ['printing', 'auto_bed_leveling', 'heatbed_preheating'].includes(stage);
    const LABELS = {
        print_progress: t('settings.bambuCloud.statusProgress'), remaining_time: t('settings.bambuCloud.statusRemaining'),
        nozzle_temp: t('settings.bambuCloud.statusNozzle'), bed_temp: t('settings.bambuCloud.statusBed'), current_file: t('settings.bambuCloud.statusFile'),
    };
    const UNITS = {
        nozzle_temp: '°C', bed_temp: '°C', print_progress: '%', remaining_time: ' min',
    };
    return (_jsxs("div", { className: "bg-surface-2 border border-surface-3 rounded-xl p-4", children: [_jsxs("div", { className: "flex items-start justify-between mb-3", children: [_jsxs("div", { children: [_jsx("div", { className: "flex items-center gap-2", children: _jsx("p", { className: "font-semibold text-white", children: printer.name }) }), _jsx("div", { className: "flex items-center gap-2 mt-0.5 flex-wrap", children: _jsx("span", { className: `text-xs px-2 py-0.5 rounded-full ${isPrinting ? 'bg-blue-900 text-blue-300' :
                                        stage === 'finish' ? 'bg-green-900 text-green-300' :
                                            'bg-surface-3 text-gray-400'}`, children: stage }) })] }), _jsxs("div", { className: "flex gap-1 shrink-0", children: [_jsx("button", { className: "btn-ghost p-1", onClick: () => refetch(), title: "Refresh", children: _jsx(RefreshCw, { size: 12, className: isFetching ? 'animate-spin' : '' }) }), _jsx("button", { className: "btn-ghost p-1", onClick: onEdit, children: _jsx(Pencil, { size: 12 }) }), _jsx("button", { className: "btn-ghost p-1 text-red-400", onClick: onDelete, children: _jsx(Trash2, { size: 12 }) })] })] }), status && (_jsx("div", { className: "grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-400 mb-3", children: Object.entries(status).map(([key, val]) => (val && key !== 'print_stage' ? (key === 'current_file' ? (_jsxs("span", { className: "col-span-3 flex gap-1 min-w-0", children: [_jsxs("span", { className: "shrink-0", children: [LABELS[key], ":"] }), _jsx("span", { className: "text-white truncate", title: val, children: val })] }, key)) : (_jsxs("span", { children: [LABELS[key] ?? key, ": ", _jsxs("span", { className: "text-white", children: [val, UNITS[key] ?? ''] })] }, key))) : null)) })), _jsx(AMSTrayPanel, { printer: printer })] }));
}
// ── Brand Spool Weights ───────────────────────────────────────────────────────
function BrandWeightsSection({ actionsLast }) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const [newBrand, setNewBrand] = useState('');
    const [newWeight, setNewWeight] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editBrand, setEditBrand] = useState('');
    const [editWeight, setEditWeight] = useState('');
    const { data: entries = [] } = useQuery({
        queryKey: ['brand-weights'],
        queryFn: api.getBrandWeights,
    });
    const inv = () => qc.invalidateQueries({ queryKey: ['brand-weights'] });
    const createMut = useMutation({
        mutationFn: () => api.createBrandWeight({ brand: newBrand.trim(), spool_weight_g: parseFloat(newWeight) }),
        onSuccess: () => { inv(); setNewBrand(''); setNewWeight(''); },
    });
    const updateMut = useMutation({
        mutationFn: ({ id }) => api.updateBrandWeight(id, { brand: editBrand.trim(), spool_weight_g: parseFloat(editWeight) }),
        onSuccess: () => { inv(); setEditingId(null); },
    });
    const deleteMut = useMutation({ mutationFn: api.deleteBrandWeight, onSuccess: inv });
    const startEdit = (e) => {
        setEditingId(e.id);
        setEditBrand(e.brand);
        setEditWeight(e.spool_weight_g.toString());
    };
    return (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-gray-300 mb-1", children: t('settings.brandWeights.title') }), _jsx("p", { className: "text-xs text-gray-500 mb-3", children: t('settings.brandWeights.hint') }), _jsxs("div", { className: "card space-y-2", children: [_jsxs("div", { className: "flex items-center gap-2 pb-2 border-b border-surface-3", children: [_jsx("input", { className: "input flex-1 text-sm py-1", value: newBrand, onChange: e => setNewBrand(e.target.value), placeholder: t('settings.brandWeights.brandPlaceholder'), onKeyDown: e => e.key === 'Enter' && newBrand.trim() && newWeight && createMut.mutate() }), _jsx("input", { className: "input w-24 text-sm py-1 text-right", type: "number", min: "0", step: "1", value: newWeight, onChange: e => setNewWeight(e.target.value), placeholder: "250" }), _jsx("span", { className: "text-xs text-gray-500 shrink-0", children: "g" }), _jsxs("button", { className: "btn-primary text-xs px-2 py-1 flex items-center gap-1 shrink-0", onClick: () => createMut.mutate(), disabled: !newBrand.trim() || !newWeight || createMut.isPending, children: [_jsx(Plus, { size: 12 }), " ", t('common.add')] })] }), _jsxs("div", { className: "overflow-y-auto max-h-64 space-y-2", children: [entries.length === 0 && (_jsx("p", { className: "text-xs text-gray-500 py-1", children: t('settings.brandWeights.noEntries') })), entries.map(e => (_jsx("div", { className: "flex items-center gap-2", children: editingId === e.id ? (_jsxs(_Fragment, { children: [_jsx("input", { className: "input flex-1 text-sm py-1", value: editBrand, onChange: ev => setEditBrand(ev.target.value), placeholder: t('settings.brandWeights.brand'), autoFocus: true }), _jsx("input", { className: "input w-24 text-sm py-1 text-right", type: "number", min: "0", step: "1", value: editWeight, onChange: ev => setEditWeight(ev.target.value) }), _jsx("span", { className: "text-xs text-gray-500 shrink-0", children: "g" }), _jsx("button", { className: "btn-primary text-xs px-2 py-1", onClick: () => updateMut.mutate({ id: e.id }), disabled: !editBrand || !editWeight, children: t('common.save') }), _jsx("button", { className: "btn-ghost p-1", onClick: () => setEditingId(null), children: _jsx(X, { size: 12 }) })] })) : (_jsxs(_Fragment, { children: [!actionsLast && (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn-ghost p-1", onClick: () => startEdit(e), children: _jsx(Pencil, { size: 12 }) }), _jsx("button", { className: "btn-ghost p-1 text-red-400", onClick: () => deleteMut.mutate(e.id), children: _jsx(Trash2, { size: 12 }) })] })), _jsx("span", { className: "flex-1 text-sm text-white", children: e.brand }), _jsxs("span", { className: "text-sm text-gray-300 tabular-nums", children: [e.spool_weight_g.toFixed(0), " g"] }), actionsLast && (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn-ghost p-1", onClick: () => startEdit(e), children: _jsx(Pencil, { size: 12 }) }), _jsx("button", { className: "btn-ghost p-1 text-red-400", onClick: () => deleteMut.mutate(e.id), children: _jsx(Trash2, { size: 12 }) })] }))] })) }, e.id)))] })] })] }));
}
// ── Generic name-list section (subtypes / materials / brands) ─────────────────
function NameListSection({ title, hint, queryKey, fetchFn, createFn, updateFn, deleteFn, placeholder, noEntries, actionsLast, }) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const { data: entries = [] } = useQuery({
        queryKey: [queryKey],
        queryFn: fetchFn,
    });
    const inv = () => qc.invalidateQueries({ queryKey: [queryKey] });
    const createMut = useMutation({
        mutationFn: () => createFn(newName.trim()),
        onSuccess: () => { inv(); setNewName(''); },
    });
    const updateMut = useMutation({
        mutationFn: ({ id }) => updateFn(id, editName.trim()),
        onSuccess: () => { inv(); setEditingId(null); },
    });
    const deleteMut = useMutation({ mutationFn: deleteFn, onSuccess: inv });
    return (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-gray-300 mb-1", children: title }), hint && _jsx("p", { className: "text-xs text-gray-500 mb-3", children: hint }), _jsxs("div", { className: "card space-y-2", children: [_jsxs("div", { className: "flex items-center gap-2 pb-2 border-b border-surface-3", children: [_jsx("input", { className: "input flex-1 text-sm py-1", value: newName, onChange: e => setNewName(e.target.value), placeholder: placeholder, onKeyDown: e => e.key === 'Enter' && newName.trim() && createMut.mutate() }), _jsxs("button", { className: "btn-primary text-xs px-2 py-1 flex items-center gap-1 shrink-0", onClick: () => createMut.mutate(), disabled: !newName.trim() || createMut.isPending, children: [_jsx(Plus, { size: 12 }), " ", t('common.add')] })] }), _jsxs("div", { className: "overflow-y-auto max-h-64 space-y-2", children: [entries.length === 0 && (_jsx("p", { className: "text-xs text-gray-500 py-1", children: noEntries })), entries.map(e => (_jsx("div", { className: "flex items-center gap-2", children: editingId === e.id ? (_jsxs(_Fragment, { children: [_jsx("input", { className: "input flex-1 text-sm py-1", value: editName, onChange: ev => setEditName(ev.target.value), autoFocus: true, onKeyDown: ev => ev.key === 'Enter' && editName.trim() && updateMut.mutate({ id: e.id }) }), _jsx("button", { className: "btn-primary text-xs px-2 py-1", onClick: () => updateMut.mutate({ id: e.id }), disabled: !editName.trim(), children: t('common.save') }), _jsx("button", { className: "btn-ghost p-1", onClick: () => setEditingId(null), children: _jsx(X, { size: 12 }) })] })) : (_jsxs(_Fragment, { children: [!actionsLast && (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn-ghost p-1", onClick: () => { setEditingId(e.id); setEditName(e.name); }, children: _jsx(Pencil, { size: 12 }) }), _jsx("button", { className: "btn-ghost p-1 text-red-400", onClick: () => deleteMut.mutate(e.id), children: _jsx(Trash2, { size: 12 }) })] })), _jsx("span", { className: "flex-1 text-sm text-white", children: e.name }), actionsLast && (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn-ghost p-1", onClick: () => { setEditingId(e.id); setEditName(e.name); }, children: _jsx(Pencil, { size: 12 }) }), _jsx("button", { className: "btn-ghost p-1 text-red-400", onClick: () => deleteMut.mutate(e.id), children: _jsx(Trash2, { size: 12 }) })] }))] })) }, e.id)))] })] })] }));
}
// ── Data Transfer ─────────────────────────────────────────────────────────────
function DataTransferSection() {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const fileRef = useRef(null);
    const csvSpoolsRef = useRef(null);
    const spoolmanJsonRef = useRef(null);
    const [exporting, setExporting] = useState(false);
    const [exportingSpoolsCsv, setExportingSpoolsCsv] = useState(false);
    const [exportingSpoolman, setExportingSpoolman] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [importError, setImportError] = useState(null);
    const [importingSpoolsCsv, setImportingSpoolsCsv] = useState(false);
    const [importSpoolsCsvResult, setImportSpoolsCsvResult] = useState(null);
    const [importSpoolsCsvError, setImportSpoolsCsvError] = useState(null);
    const [importingCloud, setImportingCloud] = useState(false);
    const [cloudImportResult, setCloudImportResult] = useState(null);
    const [cloudImportError, setCloudImportError] = useState(null);
    const [importingSpoolman, setImportingSpoolman] = useState(false);
    const [importSpoolmanResult, setImportSpoolmanResult] = useState(null);
    const [importSpoolmanError, setImportSpoolmanError] = useState(null);
    const { data: cloudStatus } = useQuery({
        queryKey: ['bambu-cloud-status'],
        queryFn: api.getBambuCloudStatus,
    });
    const cloudConnected = cloudStatus?.status === 'connected';
    const handleExport = async () => {
        setExporting(true);
        try {
            const blob = await api.exportData();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `filament_manager_export_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
        catch (e) {
            alert('Export failed: ' + (e instanceof Error ? e.message : String(e)));
        }
        finally {
            setExporting(false);
        }
    };
    const handleExportSpoolsCsv = async () => {
        setExportingSpoolsCsv(true);
        try {
            const blob = await api.exportSpoolsCsv();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `spools_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        }
        catch (e) {
            alert('Export failed: ' + (e instanceof Error ? e.message : String(e)));
        }
        finally {
            setExportingSpoolsCsv(false);
        }
    };
    const handleImportSpoolsCsv = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setImportingSpoolsCsv(true);
        setImportSpoolsCsvResult(null);
        setImportSpoolsCsvError(null);
        try {
            const result = await api.importSpoolsCsv(file);
            setImportSpoolsCsvResult(result);
            qc.invalidateQueries({ queryKey: ['spools'] });
        }
        catch (err) {
            setImportSpoolsCsvError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setImportingSpoolsCsv(false);
            if (csvSpoolsRef.current)
                csvSpoolsRef.current.value = '';
        }
    };
    const handleExportSpoolman = async () => {
        setExportingSpoolman(true);
        try {
            const blob = await api.exportSpoolman();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `spoolman_export_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
        catch (e) {
            alert('Export failed: ' + (e instanceof Error ? e.message : String(e)));
        }
        finally {
            setExportingSpoolman(false);
        }
    };
    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setImporting(true);
        setImportResult(null);
        setImportError(null);
        try {
            const text = await file.text();
            const bundle = JSON.parse(text);
            const result = await api.importData(bundle);
            setImportResult(result.imported);
            qc.invalidateQueries();
        }
        catch (e) {
            setImportError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setImporting(false);
            if (fileRef.current)
                fileRef.current.value = '';
        }
    };
    const handleCloudImport = async () => {
        setImportingCloud(true);
        setCloudImportResult(null);
        setCloudImportError(null);
        try {
            const result = await api.bambuCloudImportPrints();
            setCloudImportResult({ imported: result.imported, skipped: result.skipped, total: result.total });
            qc.invalidateQueries({ queryKey: ['prints'] });
            qc.invalidateQueries({ queryKey: ['prints-count'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        }
        catch (e) {
            setCloudImportError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setImportingCloud(false);
        }
    };
    const handleImportSpoolmanJson = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setImportingSpoolman(true);
        setImportSpoolmanResult(null);
        setImportSpoolmanError(null);
        try {
            const result = await api.importSpoolmanJson(file);
            setImportSpoolmanResult(result);
            qc.invalidateQueries({ queryKey: ['spools'] });
        }
        catch (err) {
            setImportSpoolmanError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setImportingSpoolman(false);
            if (spoolmanJsonRef.current)
                spoolmanJsonRef.current.value = '';
        }
    };
    const [transferTab, setTransferTab] = useState('fm');
    const TRANSFER_TABS = [
        { id: 'fm', label: t('settings.dataTransfer.tabs.fm') },
        { id: 'spools', label: t('settings.dataTransfer.tabs.spools') },
        { id: 'bambu', label: t('settings.dataTransfer.tabs.bambu') },
        { id: 'experimental', label: t('settings.dataTransfer.tabs.experimental') },
    ];
    return (_jsxs("div", { className: "card", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-300 mb-3", children: t('settings.dataTransfer.title') }), _jsx("div", { className: "flex border-b border-surface-3 gap-0 mb-5", children: TRANSFER_TABS.map(tab => (_jsx("button", { onClick: () => setTransferTab(tab.id), className: `pb-2 pt-0.5 px-3 text-xs font-medium border-b-2 transition-colors -mb-px ${transferTab === tab.id
                        ? 'border-blue-500 text-white'
                        : 'border-transparent text-gray-400 hover:text-gray-200'}`, children: tab.label }, tab.id))) }), transferTab === 'fm' && (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-xs text-gray-400", children: t('settings.dataTransfer.fmDesc') }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsxs("button", { onClick: handleExport, disabled: exporting, className: "btn-primary flex items-center gap-2", children: [_jsx(Download, { size: 14 }), exporting ? t('settings.dataTransfer.exporting') : t('settings.dataTransfer.exportBtn')] }), _jsxs("label", { className: `btn-ghost flex items-center gap-2 cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`, children: [_jsx(Upload, { size: 14 }), importing ? t('settings.dataTransfer.importing') : t('settings.dataTransfer.importBtn'), _jsx("input", { ref: fileRef, type: "file", accept: ".json", className: "hidden", onChange: handleFileChange, disabled: importing })] })] }), importResult && (_jsxs("div", { className: "rounded-lg bg-green-900/30 border border-green-700 p-4 text-sm text-green-300", children: [_jsxs("div", { className: "flex items-center gap-2 font-medium mb-2", children: [_jsx(CheckCircle, { size: 16 }), " ", t('settings.dataTransfer.importSuccessTitle')] }), _jsx("ul", { className: "grid grid-cols-2 gap-x-6 gap-y-1 text-green-400", children: Object.entries(importResult).map(([key, count]) => (_jsxs("li", { className: "flex justify-between", children: [_jsx("span", { className: "capitalize", children: key.replace(/_/g, ' ') }), _jsx("span", { className: "font-medium", children: count })] }, key))) })] })), importError && (_jsxs("div", { className: "rounded-lg bg-red-900/30 border border-red-700 p-4 text-sm text-red-300 flex items-start gap-2", children: [_jsx(AlertCircle, { size: 16, className: "mt-0.5 shrink-0" }), _jsx("span", { children: importError })] })), _jsx("p", { className: "text-xs text-gray-500", children: t('settings.dataTransfer.importNote') })] })), transferTab === 'spools' && (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-xs text-gray-400", children: t('settings.dataTransfer.spoolsDesc') }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsxs("button", { onClick: handleExportSpoolsCsv, disabled: exportingSpoolsCsv, className: "btn-primary flex items-center gap-2", children: [_jsx(Download, { size: 14 }), exportingSpoolsCsv ? t('settings.dataTransfer.exporting') : t('settings.dataTransfer.exportSpoolsCsvBtn')] }), _jsxs("label", { className: `btn-ghost flex items-center gap-2 cursor-pointer ${importingSpoolsCsv ? 'opacity-50 pointer-events-none' : ''}`, children: [_jsx(Upload, { size: 14 }), importingSpoolsCsv ? t('settings.dataTransfer.importing') : t('settings.dataTransfer.importSpoolsCsvBtn'), _jsx("input", { ref: csvSpoolsRef, type: "file", accept: ".csv", className: "hidden", onChange: handleImportSpoolsCsv, disabled: importingSpoolsCsv })] })] }), importSpoolsCsvResult && (_jsxs("div", { className: "rounded-lg bg-green-900/30 border border-green-700 p-3 text-sm text-green-300 flex items-center justify-between", children: [_jsx("span", { children: t('settings.dataTransfer.importSpoolsCsvResult', { created: importSpoolsCsvResult.created, updated: importSpoolsCsvResult.updated, skipped: importSpoolsCsvResult.skipped }) }), _jsx("button", { className: "ml-4 text-green-400 hover:text-white", onClick: () => setImportSpoolsCsvResult(null), children: "\u2715" })] })), importSpoolsCsvError && (_jsxs("div", { className: "rounded-lg bg-red-900/30 border border-red-700 p-3 text-sm text-red-300 flex items-start gap-2", children: [_jsx(AlertCircle, { size: 16, className: "mt-0.5 shrink-0" }), _jsx("span", { children: importSpoolsCsvError })] }))] })), transferTab === 'bambu' && (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-xs text-gray-400", children: t('settings.dataTransfer.bambuDesc') }), _jsx("div", { className: "flex flex-wrap gap-3", children: _jsxs("button", { onClick: handleCloudImport, disabled: importingCloud || !cloudConnected, title: !cloudConnected ? t('settings.dataTransfer.bambuNotConnected') : undefined, className: "btn-primary flex items-center gap-2 disabled:opacity-40", children: [_jsx(Download, { size: 14 }), importingCloud ? t('settings.dataTransfer.importingCloud') : t('settings.dataTransfer.importCloudBtn')] }) }), !cloudConnected && (_jsx("p", { className: "text-xs text-yellow-500", children: t('settings.dataTransfer.bambuNotConnected') })), cloudImportResult && (_jsxs("div", { className: "rounded-lg bg-green-900/30 border border-green-700 p-3 text-sm text-green-300", children: [_jsx(CheckCircle, { size: 14, className: "inline mr-1.5 mb-0.5" }), t('settings.dataTransfer.importCloudResult', cloudImportResult)] })), cloudImportError && (_jsxs("div", { className: "rounded-lg bg-red-900/30 border border-red-700 p-3 text-sm text-red-300 flex items-start gap-2", children: [_jsx(AlertCircle, { size: 14, className: "mt-0.5 shrink-0" }), _jsx("span", { children: t('settings.dataTransfer.importCloudError', { error: cloudImportError }) })] }))] })), transferTab === 'experimental' && (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-xs text-gray-400", children: t('settings.dataTransfer.experimentalDesc') }), _jsx("div", { className: "flex flex-wrap gap-3", children: _jsxs("button", { onClick: handleExportSpoolman, disabled: exportingSpoolman, className: "btn-ghost flex items-center gap-2", children: [_jsx(Download, { size: 14 }), exportingSpoolman ? t('settings.dataTransfer.exporting') : t('settings.dataTransfer.exportSpoolmanBtn'), _jsx("span", { className: "ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-yellow-900/60 text-yellow-400 border border-yellow-700", children: t('settings.dataTransfer.experimental') })] }) }), _jsx("p", { className: "text-xs text-gray-500", children: t('settings.dataTransfer.exportSpoolmanHint') }), _jsx("hr", { className: "border-surface-3" }), _jsx("div", { className: "flex flex-wrap gap-3", children: _jsxs("label", { className: `btn-ghost flex items-center gap-2 cursor-pointer ${importingSpoolman ? 'opacity-50 pointer-events-none' : ''}`, children: [_jsx(Upload, { size: 14 }), importingSpoolman ? t('settings.dataTransfer.importingSpoolman') : t('settings.dataTransfer.importSpoolmanBtn'), _jsx("span", { className: "ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-yellow-900/60 text-yellow-400 border border-yellow-700", children: t('settings.dataTransfer.experimental') }), _jsx("input", { ref: spoolmanJsonRef, type: "file", accept: ".json", className: "hidden", onChange: handleImportSpoolmanJson, disabled: importingSpoolman })] }) }), importSpoolmanResult && (_jsxs("div", { className: "rounded-lg bg-green-900/30 border border-green-700 p-3 text-sm text-green-300 flex items-center justify-between", children: [_jsx("span", { children: t('settings.dataTransfer.importSpoolmanResult', importSpoolmanResult) }), _jsx("button", { className: "ml-4 text-green-400 hover:text-white", onClick: () => setImportSpoolmanResult(null), children: "\u2715" })] })), importSpoolmanError && (_jsxs("div", { className: "rounded-lg bg-red-900/30 border border-red-700 p-3 text-sm text-red-300 flex items-start gap-2", children: [_jsx(AlertCircle, { size: 16, className: "mt-0.5 shrink-0" }), _jsx("span", { children: importSpoolmanError })] })), _jsx("p", { className: "text-xs text-gray-500", children: t('settings.dataTransfer.importSpoolmanHint') })] }))] }));
}
const EMPTY_CATALOG = {
    brand: '', material: '', subtype: null, subtype2: null,
    color_name: '', color_hex: '#888888',
    color2_hex: null, color3_hex: null, color4_hex: null,
    article_number: null,
};
function CatalogSortIcon({ col, sort }) {
    if (sort.key !== col)
        return _jsx(ChevronsUpDown, { size: 12, className: "text-gray-600" });
    return sort.dir === 'asc'
        ? _jsx(ChevronUp, { size: 12, className: "text-accent" })
        : _jsx(ChevronDown, { size: 12, className: "text-accent" });
}
// Module-level component — NOT defined inside FilamentDataSection to avoid remount on every render
function CatalogEditRow({ entry, editForm, setEditForm, onSave, onCancel, brands, materials, subtypes, actionsLast, propagate, onPropagateChange }) {
    const { t } = useTranslation();
    const set = (k, v) => setEditForm({ ...editForm, [k]: v });
    const hexValid = /^#[0-9a-fA-F]{6}$/.test(editForm.color_hex);
    const canSave = editForm.brand.trim() && editForm.material.trim() && editForm.color_name.trim() && hexValid;
    const colSpan = 11; // actions + 10 data columns
    const actionCell = (_jsx("td", { className: "px-2 py-1", children: _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { className: "btn-primary text-xs px-2 py-0.5", onClick: onSave, disabled: !canSave, children: t('common.save') }), _jsx("button", { className: "btn-ghost text-xs px-2 py-0.5", onClick: onCancel, children: t('common.cancel') })] }) }));
    return (_jsxs(_Fragment, { children: [_jsxs("tr", { className: "bg-surface-2", children: [!actionsLast && actionCell, _jsx("td", { className: "px-2 py-1", children: _jsxs("select", { className: "input text-xs py-0.5 w-full", value: editForm.brand, onChange: e => set('brand', e.target.value), children: [_jsx("option", { value: "", children: "\u2014" }), brands.map(b => _jsx("option", { value: b.name, children: b.name }, b.id))] }) }), _jsx("td", { className: "px-2 py-1", children: _jsxs("select", { className: "input text-xs py-0.5 w-full", value: editForm.material, onChange: e => set('material', e.target.value), children: [_jsx("option", { value: "", children: "\u2014" }), materials.map(m => _jsx("option", { value: m.name, children: m.name }, m.id))] }) }), _jsx("td", { className: "px-2 py-1", children: _jsxs("select", { className: "input text-xs py-0.5 w-full", value: editForm.subtype ?? '', onChange: e => set('subtype', e.target.value), children: [_jsx("option", { value: "", children: "\u2014" }), subtypes.map(s => _jsx("option", { value: s.name, children: s.name }, s.id))] }) }), _jsx("td", { className: "px-2 py-1", children: _jsxs("select", { className: "input text-xs py-0.5 w-full", value: editForm.subtype2 ?? '', onChange: e => set('subtype2', e.target.value), children: [_jsx("option", { value: "", children: "\u2014" }), subtypes.map(s => _jsx("option", { value: s.name, children: s.name }, s.id))] }) }), _jsx("td", { className: "px-2 py-1", children: _jsx("input", { className: "input text-xs py-0.5 w-full", value: editForm.color_name, onChange: e => set('color_name', e.target.value) }) }), _jsx("td", { className: "px-2 py-1", children: _jsxs("div", { className: "flex flex-col gap-1", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("input", { type: "color", className: "w-6 h-6 rounded cursor-pointer border border-surface-3 bg-transparent p-0 shrink-0", value: editForm.color_hex, onChange: e => set('color_hex', e.target.value) }), _jsxs("div", { className: "flex items-center", children: [_jsx("span", { className: "px-1.5 py-0.5 text-xs text-gray-400 bg-surface-3 border border-r-0 border-surface-3 rounded-l select-none", children: "#" }), _jsx("input", { className: `input text-xs py-0.5 w-16 font-mono rounded-l-none ${!hexValid ? 'border-red-500 focus:border-red-500' : ''}`, value: editForm.color_hex.replace(/^#/, ''), onChange: e => set('color_hex', '#' + e.target.value.replace(/^#/, '')), maxLength: 6 })] })] }), ['color2_hex', 'color3_hex', 'color4_hex'].map(k => (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("input", { type: "color", className: "w-6 h-6 rounded cursor-pointer border border-surface-3 bg-transparent p-0 shrink-0", value: /^#[0-9a-fA-F]{6}$/.test(editForm[k] ?? '') ? editForm[k] : '#888888', onChange: e => setEditForm({ ...editForm, [k]: e.target.value }) }), _jsxs("div", { className: "flex items-center", children: [_jsx("span", { className: "px-1.5 py-0.5 text-xs text-gray-400 bg-surface-3 border border-r-0 border-surface-3 rounded-l select-none", children: "#" }), _jsx("input", { className: "input text-xs py-0.5 w-16 font-mono rounded-l-none", value: (editForm[k] ?? '').replace(/^#/, ''), onChange: e => setEditForm({ ...editForm, [k]: e.target.value ? '#' + e.target.value.replace(/^#/, '') : null }), placeholder: "opt", maxLength: 6 })] }), editForm[k] && (_jsx("button", { type: "button", className: "text-gray-600 hover:text-red-400 p-0.5", onClick: () => setEditForm({ ...editForm, [k]: null }), children: _jsx(X, { size: 10 }) }))] }, k)))] }) }), _jsx("td", { className: "px-2 py-1", children: _jsx("input", { className: "input text-xs py-0.5 w-full", value: editForm.article_number ?? '', onChange: e => set('article_number', e.target.value) }) }), actionsLast && actionCell] }), _jsx("tr", { className: "border-b border-surface-3 bg-surface-2", children: _jsx("td", { colSpan: colSpan, className: "px-2 pb-2", children: _jsxs("label", { className: `flex items-center gap-2 text-xs cursor-pointer ${!editForm.article_number ? 'opacity-40 cursor-not-allowed' : ''}`, children: [_jsx("input", { type: "checkbox", checked: propagate && !!editForm.article_number, disabled: !editForm.article_number, onChange: e => onPropagateChange(e.target.checked), className: "accent-accent" }), t('settings.catalog.propagateToSpools', { article: editForm.article_number || '—' })] }) }) })] }));
}
function FilamentDataSection({ actionsLast }) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_CATALOG });
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ ...EMPTY_CATALOG });
    const [importResult, setImportResult] = useState(null);
    const csvInputRef = useRef(null);
    const [sort, setSort] = useState({ key: 'brand', dir: 'asc' });
    const [filters, setFilters] = useState({});
    const [propagate, setPropagate] = useState(() => localStorage.getItem('fm_catalog_propagate') === 'true');
    const handlePropagateChange = (v) => {
        setPropagate(v);
        localStorage.setItem('fm_catalog_propagate', String(v));
    };
    const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));
    const toggleSort = (k) => setSort(s => s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' });
    const { data: catalog = [] } = useQuery({
        queryKey: ['filament-catalog'],
        queryFn: api.getFilamentCatalog,
    });
    const { data: brands = [] } = useQuery({
        queryKey: ['filament-brands'], queryFn: api.getFilamentBrands,
    });
    const { data: materials = [] } = useQuery({
        queryKey: ['filament-materials'], queryFn: api.getFilamentMaterials,
    });
    const { data: subtypes = [] } = useQuery({
        queryKey: ['filament-subtypes'], queryFn: api.getFilamentSubtypes,
    });
    const inv = () => qc.invalidateQueries({ queryKey: ['filament-catalog'] });
    const createMut = useMutation({
        mutationFn: () => api.createFilamentCatalog({
            ...form,
            subtype: form.subtype || null,
            subtype2: form.subtype2 || null,
            article_number: form.article_number || null,
        }),
        onSuccess: () => { inv(); setForm({ ...EMPTY_CATALOG }); setShowAdd(false); },
    });
    const updateMut = useMutation({
        mutationFn: (id) => api.updateFilamentCatalog(id, {
            ...editForm,
            subtype: editForm.subtype || null,
            subtype2: editForm.subtype2 || null,
            article_number: editForm.article_number || null,
            propagate_to_spools: propagate && !!editForm.article_number,
        }),
        onSuccess: () => {
            inv();
            if (propagate && editForm.article_number)
                qc.invalidateQueries({ queryKey: ['spools'] });
            setEditingId(null);
        },
    });
    const deleteMut = useMutation({ mutationFn: api.deleteFilamentCatalog, onSuccess: inv });
    const importMut = useMutation({
        mutationFn: api.importFilamentCatalog,
        onSuccess: (result) => { inv(); setImportResult(result); },
    });
    const handleExportCatalogCsv = () => {
        const header = ['Brand', 'Material', 'Subtype', 'Subtype 2', 'Color name', 'Article number', 'Hex-Code'];
        const q = (v) => `"${v.replace(/"/g, '""')}"`;
        const body = catalog.map(e => [
            q(e.brand),
            q(e.material),
            q(e.subtype ?? ''),
            q(e.subtype2 ?? ''),
            q(e.color_name),
            q(e.article_number ?? ''),
            q(e.color_hex),
        ].join(';'));
        const csv = '\uFEFF' + [header.join(';'), ...body].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `filament_catalog_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };
    const handleCsvFile = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            // Strip UTF-8 BOM (Excel UTF-8 exports include it)
            const text = (e.target?.result).replace(/^\uFEFF/, '');
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            if (lines.length < 1)
                return;
            // Detect delimiter from first line
            const delim = lines[0].includes(';') ? ';' : ',';
            // Strip surrounding quotes — handles Excel-quoted cells
            const unquote = (s) => s.trim().replace(/^["']|["']$/g, '');
            // Fixed column order: Brand;Material;Subtype;Subtype 2;Color name;Article number;Hex-Code
            // Skip header row if first cell is "brand" (exported files include a header)
            const dataLines = unquote(lines[0].split(delim)[0]).toLowerCase() === 'brand'
                ? lines.slice(1)
                : lines;
            const rows = dataLines.map(line => {
                const c = line.split(delim).map(unquote);
                return {
                    brand: c[0] ?? '',
                    material: c[1] ?? '',
                    subtype: c[2] || null,
                    subtype2: c[3] || null,
                    color_name: c[4] ?? '',
                    article_number: c[5] || null,
                    color_hex: c[6] ? `#${c[6].replace(/^#/, '')}` : '#888888',
                };
            }).filter(r => r.brand && r.material && r.color_name);
            if (rows.length > 0) {
                importMut.mutate(rows);
            }
            else {
                alert(t('settings.filamentCatalog.importNoRows'));
            }
        };
        reader.readAsText(file, 'UTF-8');
    };
    const startEdit = (e) => {
        setEditingId(e.id);
        setEditForm({ brand: e.brand, material: e.material, subtype: e.subtype ?? '', subtype2: e.subtype2 ?? '', color_name: e.color_name, color_hex: e.color_hex, color2_hex: e.color2_hex ?? null, color3_hex: e.color3_hex ?? null, color4_hex: e.color4_hex ?? null, article_number: e.article_number ?? '' });
    };
    const addHexValid = /^#[0-9a-fA-F]{6}$/.test(form.color_hex);
    const canAdd = form.brand.trim() && form.material.trim() && form.color_name.trim() && addHexValid;
    const processed = useMemo(() => {
        let rows = [...catalog];
        for (const [k, v] of Object.entries(filters)) {
            if (!v)
                continue;
            const lower = v.toLowerCase();
            rows = rows.filter(e => {
                const val = e[k];
                if (val == null)
                    return false;
                return String(val).toLowerCase().includes(lower);
            });
        }
        rows.sort((a, b) => {
            const av = a[sort.key] ?? '';
            const bv = b[sort.key] ?? '';
            const cmp = String(av).localeCompare(String(bv));
            return sort.dir === 'asc' ? cmp : -cmp;
        });
        return rows;
    }, [catalog, sort, filters]);
    const hasFilter = Object.values(filters).some(v => v);
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "sticky top-0 z-10 bg-surface pb-1 flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-300", children: t('settings.filamentCatalog.title') }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { ref: csvInputRef, type: "file", accept: ".csv", className: "hidden", onChange: e => { const f = e.target.files?.[0]; if (f) {
                                    handleCsvFile(f);
                                    e.target.value = '';
                                } } }), _jsxs("button", { className: "btn-ghost text-xs px-2 py-1 flex items-center gap-1", onClick: handleExportCatalogCsv, disabled: catalog.length === 0, children: [_jsx(Download, { size: 12 }), " ", t('settings.filamentCatalog.exportCsv')] }), _jsxs("button", { className: "btn-ghost text-xs px-2 py-1 flex items-center gap-1", onClick: () => { setImportResult(null); csvInputRef.current?.click(); }, disabled: importMut.isPending, children: [_jsx(Upload, { size: 12 }), " ", t('settings.filamentCatalog.importCsv')] }), _jsxs("button", { className: "btn-primary text-xs px-2 py-1 flex items-center gap-1", onClick: () => { setShowAdd(v => !v); setEditingId(null); }, children: [_jsx(Plus, { size: 12 }), " ", t('common.add')] })] })] }), importResult && (_jsxs("div", { className: "text-xs px-3 py-2 rounded bg-green-900/40 border border-green-700/50 text-green-300 flex items-center justify-between", children: [_jsx("span", { children: t('settings.filamentCatalog.importResult', { added: importResult.added, updated: importResult.updated }) }), _jsx("button", { className: "ml-4 text-green-400 hover:text-white", onClick: () => setImportResult(null), children: "\u2715" })] })), showAdd && (_jsxs("div", { className: "card space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "label text-xs", children: [t('settings.filamentCatalog.brand'), " *"] }), _jsxs("select", { className: "input text-xs py-1 w-full", value: form.brand, onChange: e => setForm(f => ({ ...f, brand: e.target.value })), children: [_jsx("option", { value: "", children: "\u2014" }), brands.map(b => _jsx("option", { value: b.name, children: b.name }, b.id))] })] }), _jsxs("div", { children: [_jsxs("label", { className: "label text-xs", children: [t('settings.filamentCatalog.material'), " *"] }), _jsxs("select", { className: "input text-xs py-1 w-full", value: form.material, onChange: e => setForm(f => ({ ...f, material: e.target.value })), children: [_jsx("option", { value: "", children: "\u2014" }), materials.map(m => _jsx("option", { value: m.name, children: m.name }, m.id))] })] }), _jsxs("div", { children: [_jsx("label", { className: "label text-xs", children: t('settings.filamentCatalog.subtype') }), _jsxs("select", { className: "input text-xs py-1 w-full", value: form.subtype ?? '', onChange: e => setForm(f => ({ ...f, subtype: e.target.value })), children: [_jsx("option", { value: "", children: "\u2014" }), subtypes.map(s => _jsx("option", { value: s.name, children: s.name }, s.id))] })] }), _jsxs("div", { children: [_jsx("label", { className: "label text-xs", children: t('settings.filamentCatalog.subtype2') }), _jsxs("select", { className: "input text-xs py-1 w-full", value: form.subtype2 ?? '', onChange: e => setForm(f => ({ ...f, subtype2: e.target.value })), children: [_jsx("option", { value: "", children: "\u2014" }), subtypes.map(s => _jsx("option", { value: s.name, children: s.name }, s.id))] })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "label text-xs", children: [t('settings.filamentCatalog.colorName'), " *"] }), _jsx("input", { className: "input text-xs py-1 w-full", value: form.color_name, onChange: e => setForm(f => ({ ...f, color_name: e.target.value })), placeholder: "Black" })] }), _jsxs("div", { children: [_jsx("label", { className: "label text-xs", children: t('settings.filamentCatalog.colorHex') }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "color", className: "w-8 h-8 rounded cursor-pointer border border-surface-3 bg-transparent p-0.5 shrink-0", value: form.color_hex, onChange: e => setForm(f => ({ ...f, color_hex: e.target.value })) }), _jsxs("div", { className: "flex items-center flex-1", children: [_jsx("span", { className: "px-2 py-1 text-xs text-gray-400 bg-surface-3 border border-r-0 border-surface-3 rounded-l select-none", children: "#" }), _jsx("input", { className: `input text-xs py-1 font-mono flex-1 rounded-l-none ${!addHexValid ? 'border-red-500 focus:border-red-500' : ''}`, value: form.color_hex.replace(/^#/, ''), onChange: e => setForm(f => ({ ...f, color_hex: '#' + e.target.value.replace(/^#/, '') })), maxLength: 6 })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "label text-xs", children: t('settings.filamentCatalog.articleNumber') }), _jsx("input", { className: "input text-xs py-1 w-full", value: form.article_number ?? '', onChange: e => setForm(f => ({ ...f, article_number: e.target.value })), placeholder: "BL-PLA-BK-1KG" })] }), _jsxs("div", { className: "flex items-end gap-2", children: [_jsx("button", { className: "btn-primary text-xs px-3 py-1.5", onClick: () => createMut.mutate(), disabled: !canAdd || createMut.isPending, children: t('common.add') }), _jsx("button", { className: "btn-ghost text-xs px-3 py-1.5", onClick: () => { setShowAdd(false); setForm({ ...EMPTY_CATALOG }); }, children: t('common.cancel') })] })] }), _jsx("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-4", children: ['color2_hex', 'color3_hex', 'color4_hex'].map(k => (_jsxs("div", { children: [_jsx("label", { className: "label text-xs", children: t(`settings.filamentCatalog.${k}`) }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("input", { type: "color", className: "w-8 h-8 rounded cursor-pointer border border-surface-3 bg-transparent p-0.5 shrink-0", value: /^#[0-9a-fA-F]{6}$/.test(form[k] ?? '') ? form[k] : '#888888', onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) }), _jsxs("div", { className: "flex items-center flex-1", children: [_jsx("span", { className: "px-2 py-1 text-xs text-gray-400 bg-surface-3 border border-r-0 border-surface-3 rounded-l select-none", children: "#" }), _jsx("input", { className: "input text-xs py-1 font-mono flex-1 rounded-l-none", value: (form[k] ?? '').replace(/^#/, ''), onChange: e => setForm(f => ({ ...f, [k]: e.target.value ? '#' + e.target.value.replace(/^#/, '') : null })), placeholder: t('common.optional'), maxLength: 6 })] }), form[k] && (_jsx("button", { type: "button", className: "text-gray-600 hover:text-red-400 p-0.5", onClick: () => setForm(f => ({ ...f, [k]: null })), children: _jsx(X, { size: 10 }) }))] })] }, k))) })] })), _jsx("div", { className: "overflow-x-auto overflow-y-auto max-h-[calc(100svh-18rem)] rounded-xl border border-surface-3 bg-surface-2", children: _jsxs("table", { className: "w-full text-xs text-left", style: { minWidth: '700px' }, children: [_jsxs("thead", { children: [_jsxs("tr", { className: "border-b border-surface-3", children: [!actionsLast && _jsx("th", { className: "sticky top-0 z-10 px-3 py-2 w-16 bg-surface-2" }), [
                                            ['brand', t('settings.filamentCatalog.brand')],
                                            ['material', t('settings.filamentCatalog.material')],
                                            ['subtype', t('settings.filamentCatalog.subtype')],
                                            ['subtype2', t('settings.filamentCatalog.subtype2')],
                                            ['color_name', t('settings.filamentCatalog.colorName')],
                                            ['color_hex', t('settings.filamentCatalog.colorHex')],
                                            ['color2_hex', t('settings.filamentCatalog.color2_hex')],
                                            ['color3_hex', t('settings.filamentCatalog.color3_hex')],
                                            ['color4_hex', t('settings.filamentCatalog.color4_hex')],
                                            ['article_number', t('settings.filamentCatalog.articleNumber')],
                                        ].map(([key, label]) => (_jsx("th", { className: "sticky top-0 z-10 bg-surface-2 px-3 py-2 text-gray-400 font-medium whitespace-nowrap cursor-pointer select-none hover:text-white", onClick: () => toggleSort(key), children: _jsxs("span", { className: "flex items-center gap-1", children: [label, " ", _jsx(CatalogSortIcon, { col: key, sort: sort })] }) }, key))), actionsLast && _jsx("th", { className: "sticky top-0 z-10 px-3 py-2 w-16 bg-surface-2" })] }), _jsxs("tr", { className: "border-b border-surface-3", children: [!actionsLast && (_jsx("td", { className: "sticky top-9 z-10 bg-surface-3 px-2 py-1", children: _jsx("button", { className: "text-xs text-gray-500 hover:text-white", onClick: () => setFilters({}), title: t('common.clear'), children: "\u2715" }) })), ['brand', 'material', 'subtype', 'subtype2', 'color_name', 'color_hex', 'color2_hex', 'color3_hex', 'color4_hex', 'article_number'].map(key => (_jsx("td", { className: "sticky top-9 z-10 bg-surface-3 px-2 py-1", children: _jsx("input", { className: "w-full bg-surface-3 rounded px-2 py-0.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-accent", placeholder: "filter\u2026", value: filters[key] ?? '', onChange: e => setFilter(key, e.target.value) }) }, key))), actionsLast && (_jsx("td", { className: "sticky top-9 z-10 bg-surface-3 px-2 py-1", children: _jsx("button", { className: "text-xs text-gray-500 hover:text-white", onClick: () => setFilters({}), title: t('common.clear'), children: "\u2715" }) }))] })] }), _jsxs("tbody", { children: [processed.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 11, className: "text-xs text-gray-500 py-4 px-3", children: hasFilter ? t('settings.filamentCatalog.noResults') : t('settings.filamentCatalog.noEntries') }) })), processed.map(entry => editingId === entry.id ? (_jsx(CatalogEditRow, { entry: entry, editForm: editForm, setEditForm: setEditForm, onSave: () => updateMut.mutate(entry.id), onCancel: () => setEditingId(null), brands: brands, materials: materials, subtypes: subtypes, actionsLast: actionsLast, propagate: propagate, onPropagateChange: handlePropagateChange }, entry.id)) : (_jsxs("tr", { className: "border-b border-surface-3/50 hover:bg-surface-3/40 transition-colors", children: [!actionsLast && (_jsx("td", { className: "px-3 py-2 whitespace-nowrap", children: _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { className: "btn-ghost p-1 text-gray-400 hover:text-white", onClick: () => startEdit(entry), children: _jsx(Pencil, { size: 12 }) }), _jsx("button", { className: "btn-ghost p-1 text-red-400 hover:text-red-300", onClick: () => deleteMut.mutate(entry.id), children: _jsx(Trash2, { size: 12 }) })] }) })), _jsx("td", { className: "px-3 py-2 font-medium text-white whitespace-nowrap", children: entry.brand }), _jsx("td", { className: "px-3 py-2 whitespace-nowrap", children: entry.material }), _jsx("td", { className: "px-3 py-2 whitespace-nowrap text-gray-400", children: entry.subtype ?? '—' }), _jsx("td", { className: "px-3 py-2 whitespace-nowrap text-gray-400", children: entry.subtype2 ?? '—' }), _jsx("td", { className: "px-3 py-2 whitespace-nowrap", children: _jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/10", style: { background: entry.color_hex } }), entry.color_name] }) }), _jsx("td", { className: "px-3 py-2 whitespace-nowrap font-mono text-gray-400", children: entry.color_hex }), _jsx("td", { className: "px-3 py-2", children: entry.color2_hex ? _jsx("span", { className: "w-4 h-4 rounded-full block ring-1 ring-white/10", style: { background: entry.color2_hex } }) : _jsx("span", { className: "text-gray-600", children: "\u2014" }) }), _jsx("td", { className: "px-3 py-2", children: entry.color3_hex ? _jsx("span", { className: "w-4 h-4 rounded-full block ring-1 ring-white/10", style: { background: entry.color3_hex } }) : _jsx("span", { className: "text-gray-600", children: "\u2014" }) }), _jsx("td", { className: "px-3 py-2", children: entry.color4_hex ? _jsx("span", { className: "w-4 h-4 rounded-full block ring-1 ring-white/10", style: { background: entry.color4_hex } }) : _jsx("span", { className: "text-gray-600", children: "\u2014" }) }), _jsx("td", { className: "px-3 py-2 whitespace-nowrap text-gray-400", children: entry.article_number ?? '—' }), actionsLast && (_jsx("td", { className: "px-3 py-2 whitespace-nowrap", children: _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { className: "btn-ghost p-1 text-gray-400 hover:text-white", onClick: () => startEdit(entry), children: _jsx(Pencil, { size: 12 }) }), _jsx("button", { className: "btn-ghost p-1 text-red-400 hover:text-red-300", onClick: () => deleteMut.mutate(entry.id), children: _jsx(Trash2, { size: 12 }) })] }) }))] }, entry.id)))] })] }) })] }));
}
// ── Cloud printer live status (used in Experiments tab) ───────────────────────
function CloudPrinterStatus({ printer }) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const [reconnecting, setReconnecting] = useState(false);
    const { data: status, refetch, isFetching } = useQuery({
        queryKey: ['cloud-status', printer.bambu_serial],
        queryFn: () => api.getBambuCloudPrinterStatus(printer.bambu_serial),
        refetchInterval: 10000,
        enabled: !!printer.bambu_serial,
    });
    const { data: trays, refetch: refetchTrays } = useQuery({
        queryKey: ['cloud-ams', printer.bambu_serial],
        queryFn: () => api.getBambuCloudPrinterAMS(printer.bambu_serial),
        refetchInterval: 10000,
        enabled: !!printer.bambu_serial,
    });
    const { data: debugInfo, refetch: refetchDebug } = useQuery({
        queryKey: ['cloud-debug'],
        queryFn: () => api.getBambuCloudDebug(),
        refetchInterval: 10000,
    });
    const rawCache = printer.bambu_serial && debugInfo?.printer_status_cache
        ? debugInfo.printer_status_cache[printer.bambu_serial] ?? {}
        : {};
    const rawAmsCache = printer.bambu_serial && debugInfo?.ams_cache
        ? debugInfo.ams_cache[printer.bambu_serial] ?? {}
        : {};
    // MQTT connection status for this serial
    const mqttInfo = printer.bambu_serial && debugInfo?.mqtt_clients
        ? debugInfo.mqtt_clients[printer.bambu_serial] ?? null
        : null;
    const mqttConnected = mqttInfo?.connected === true;
    const handleReconnect = async () => {
        setReconnecting(true);
        try {
            await api.bambuCloudReconnect();
            // Poll debug endpoint until MQTT shows connected for this serial (max 15s)
            const serial = printer.bambu_serial;
            if (serial) {
                for (let i = 0; i < 15; i++) {
                    await new Promise(r => setTimeout(r, 1000));
                    const dbg = await api.getBambuCloudDebug();
                    if (dbg.mqtt_clients?.[serial]?.connected)
                        break;
                }
            }
            await Promise.all([refetch(), refetchTrays(), refetchDebug()]);
            qc.invalidateQueries({ queryKey: ['printer-ams'] });
        }
        finally {
            setReconnecting(false);
        }
    };
    const handleRefreshAll = () => {
        refetch();
        refetchTrays();
        refetchDebug();
    };
    const [activeUnit, setActiveUnit] = useState(1);
    const [showRaw, setShowRaw] = useState(false);
    const [downloadingTasks, setDownloadingTasks] = useState(false);
    const handleDownloadTasks = async () => {
        if (!printer.bambu_serial)
            return;
        setDownloadingTasks(true);
        try {
            const data = await api.getBambuCloudTasksRaw(printer.bambu_serial);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tasks_${printer.bambu_serial}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
        finally {
            setDownloadingTasks(false);
        }
    };
    const LABELS = {
        print_stage: t('settings.bambuCloud.statusStage'), print_progress: t('settings.bambuCloud.statusProgress'),
        remaining_time: t('settings.bambuCloud.statusRemaining'), nozzle_temp: t('settings.bambuCloud.statusNozzle'),
        bed_temp: t('settings.bambuCloud.statusBed'), current_file: t('settings.bambuCloud.statusFile'),
        active_tray: t('settings.bambuCloud.statusActiveTray'),
    };
    const UNITS = {
        nozzle_temp: '°C', bed_temp: '°C', print_progress: '%', remaining_time: ' min',
    };
    const statusEntries = status
        ? Object.entries(status).filter(([, v]) => v != null && v !== '')
        : [];
    // Group AMS trays by unit
    const amsUnits = trays
        ? Array.from(new Set(trays.map(tr => {
            const m = tr.slot_key.match(/^ams(\d+)_/);
            return m ? parseInt(m[1]) : 1;
        }))).sort()
        : [];
    const visibleUnit = amsUnits.includes(activeUnit) ? activeUnit : (amsUnits[0] ?? 1);
    return (_jsxs("div", { className: "bg-surface-2 border border-surface-3 rounded-xl p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-white", children: printer.name }), _jsxs("div", { className: "flex items-center gap-2 mt-0.5", children: [_jsxs("p", { className: "text-xs text-gray-500", children: ['•'.repeat(8), printer.bambu_serial?.slice(-4) ?? '—'] }), mqttInfo !== null && (mqttConnected
                                        ? _jsxs("span", { className: "flex items-center gap-1 text-[10px] text-green-400", children: [_jsx(Wifi, { size: 10 }), " MQTT"] })
                                        : _jsxs("span", { className: "flex items-center gap-1 text-[10px] text-red-400", children: [_jsx(WifiOff, { size: 10 }), " ", t('settings.bambuCloud.notConnected')] }))] })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsxs("button", { className: "btn-ghost p-1 text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1", onClick: handleDownloadTasks, disabled: downloadingTasks, title: "Download full task list from Bambu Cloud as JSON", children: [_jsx(Download, { size: 11, className: downloadingTasks ? 'animate-pulse' : '' }), downloadingTasks ? t('settings.bambuCloud.fetchingTasks') : t('settings.bambuCloud.tasks')] }), _jsxs("button", { className: "btn-ghost p-1 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1", onClick: handleReconnect, disabled: reconnecting, title: "Reconnect MQTT and request fresh data", children: [_jsx(RefreshCw, { size: 11, className: reconnecting ? 'animate-spin' : '' }), reconnecting ? t('settings.bambuCloud.reconnecting') : t('settings.bambuCloud.reconnect')] }), _jsx("button", { className: "btn-ghost p-1", onClick: handleRefreshAll, title: "Refresh cache", children: _jsx(RefreshCw, { size: 12, className: isFetching ? 'animate-spin' : '' }) })] })] }), statusEntries.length > 0 ? (_jsx("div", { className: "grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-400 mb-3", children: statusEntries.map(([key, val]) => (key === 'current_file' ? (_jsxs("span", { className: "col-span-3 flex gap-1 min-w-0", children: [_jsxs("span", { className: "shrink-0", children: [LABELS[key], ":"] }), _jsx("span", { className: "text-white truncate", title: val ?? '', children: val })] }, key)) : (_jsxs("span", { children: [LABELS[key] ?? key, ": ", _jsxs("span", { className: "text-white", children: [val, UNITS[key] ?? ''] })] }, key)))) })) : (_jsx("p", { className: "text-xs text-gray-500 mb-3", children: t('settings.bambuCloud.noStatusData') })), trays && trays.length > 0 && (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 mb-1.5", children: [_jsx("p", { className: "text-xs font-medium text-gray-400", children: t('settings.printers.amsAssignment') }), amsUnits.length > 1 && (_jsx("div", { className: "flex rounded overflow-hidden border border-surface-3 text-xs", children: amsUnits.map(u => (_jsxs("button", { onClick: () => setActiveUnit(u), className: `px-2.5 py-0.5 transition-colors ${visibleUnit === u ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-gray-200'}`, children: ["AMS ", u] }, u))) }))] }), _jsx("div", { className: "space-y-1", children: trays
                            .filter(tr => {
                            const m = tr.slot_key.match(/^ams(\d+)_/);
                            return m ? parseInt(m[1]) === visibleUnit : true;
                        })
                            .map(tray => (_jsxs("div", { className: "flex items-center gap-2 bg-surface-3/40 rounded-lg px-3 py-1.5 text-xs", children: [_jsx("span", { className: "font-mono text-gray-400 w-20 shrink-0", children: tray.slot_key }), tray.ha_color_hex ? (_jsx("span", { className: "w-3 h-3 rounded-full border border-white/20 shrink-0", style: { background: tray.ha_color_hex } })) : (_jsx("span", { className: "w-3 h-3 rounded-full bg-surface-3 border border-white/10 shrink-0" })), _jsx("span", { className: "text-gray-300 flex-1", children: tray.ha_material ?? '—' }), _jsx("span", { className: "text-gray-400", children: tray.ha_remaining != null ? `${tray.ha_remaining}%` : '—' })] }, tray.slot_key))) })] })), (printer.energy_sensor_entity_id || printer.price_sensor_entity_id) && (_jsxs("div", { className: "mt-3 border-t border-surface-3 pt-2 space-y-0.5", children: [_jsx("p", { className: "text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1", children: t('settings.printers.energyTracking') }), printer.energy_sensor_entity_id && (_jsx("p", { className: "text-xs text-gray-400 font-mono", children: printer.energy_sensor_entity_id })), printer.price_sensor_entity_id && (_jsx("p", { className: "text-xs text-gray-400 font-mono", children: printer.price_sensor_entity_id }))] })), printer.energy_sensor_entity_id && (_jsx(StandbySection, { printer: printer })), _jsxs("div", { className: "mt-3 border-t border-surface-3 pt-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("button", { className: "text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1", onClick: () => setShowRaw(r => !r), children: [showRaw ? '▾' : '▸', " Raw MQTT cache (", Object.keys(rawCache).length, " printer fields, ", Object.keys(rawAmsCache).length, " AMS slots)"] }), debugInfo && printer.bambu_serial && (_jsxs("button", { className: "text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1", title: "Download full MQTT cache as JSON", onClick: () => {
                                    const serial = printer.bambu_serial;
                                    const payload = {
                                        serial,
                                        exported_at: new Date().toISOString(),
                                        printer_status: debugInfo.printer_status_cache?.[serial] ?? {},
                                        ams_cache: debugInfo.ams_cache?.[serial] ?? {},
                                        mqtt_client: debugInfo.mqtt_clients?.[serial] ?? {},
                                    };
                                    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `mqtt_cache_${serial}.json`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }, children: [_jsx(Download, { size: 11 }), " Download JSON"] }))] }), showRaw && (_jsxs("div", { className: "mt-2 space-y-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] text-gray-600 uppercase tracking-wider mb-1", children: "Printer status" }), Object.keys(rawCache).length === 0 ? (_jsx("span", { className: "text-[11px] font-mono text-gray-600", children: "No data in cache yet" })) : (_jsx("div", { className: "grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] font-mono", children: Object.entries(rawCache).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => (_jsxs("span", { className: "text-gray-500 truncate", children: [k, ": ", _jsx("span", { className: "text-gray-300", children: String(v) })] }, k))) }))] }), _jsxs("div", { children: [_jsx("p", { className: "text-[10px] text-gray-600 uppercase tracking-wider mb-1", children: "AMS tray cache" }), Object.keys(rawAmsCache).length === 0 ? (_jsx("span", { className: "text-[11px] font-mono text-gray-600", children: "No AMS data in cache yet" })) : (_jsx("div", { className: "space-y-1", children: Object.entries(rawAmsCache).sort(([a], [b]) => a.localeCompare(b)).map(([slot, td]) => (_jsxs("div", { className: "text-[11px] font-mono", children: [_jsx("span", { className: "text-blue-400", children: slot }), _jsx("span", { className: "text-gray-600", children: " \u2192 " }), Object.entries(td).map(([k, v]) => (_jsxs("span", { className: "text-gray-500 mr-3", children: [k, ": ", _jsx("span", { className: "text-gray-300", children: String(v) })] }, k)))] }, slot))) }))] })] }))] })] }));
}
export default function Settings() {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const [mainTab, setMainTab] = useState('printers');
    const [dataTab, setDataTab] = useState('brandWeights');
    const [activePrinterId, setActivePrinterId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const { data: printers = [] } = useQuery({
        queryKey: ['printers'],
        queryFn: api.getPrinters,
    });
    const { data: cloudStatus } = useQuery({
        queryKey: ['bambu-cloud-status'],
        queryFn: api.getBambuCloudStatus,
        refetchInterval: 5000,
    });
    const { data: versionData } = useQuery({
        queryKey: ['version'],
        queryFn: api.getVersion,
        staleTime: Infinity,
    });
    const isCloudConnected = cloudStatus?.status === 'connected';
    const invalidate = () => qc.invalidateQueries({ queryKey: ['printers'] });
    const createMut = useMutation({ mutationFn: api.createPrinter, onSuccess: () => { invalidate(); setShowForm(false); } });
    const updateMut = useMutation({
        mutationFn: ({ id, data }) => api.updatePrinter(id, data),
        onSuccess: () => { invalidate(); setEditing(null); },
    });
    const deleteMut = useMutation({ mutationFn: api.deletePrinter, onSuccess: invalidate });
    const activePrinter = printers.find(p => p.id === activePrinterId) ?? printers[0] ?? null;
    const MAIN_TABS = [
        { id: 'printers', label: t('settings.tabs.printers') },
        { id: 'data', label: t('settings.tabs.data') },
        { id: 'transfer', label: t('settings.tabs.transfer') },
        { id: 'experiments', label: t('settings.tabs.experiments'), dot: isCloudConnected },
        { id: 'appearance', label: t('settings.tabs.appearance') },
    ];
    const DATA_SUBTABS = [
        { id: 'brandWeights', label: t('settings.dataTabs.brandWeights') },
        { id: 'brands', label: t('settings.dataTabs.brands') },
        { id: 'materials', label: t('settings.dataTabs.materials') },
        { id: 'subtypes', label: t('settings.dataTabs.subtypes') },
        { id: 'locations', label: t('settings.dataTabs.locations') },
        { id: 'storageLocations', label: t('settings.dataTabs.storageLocations') },
        { id: 'filamentData', label: t('settings.dataTabs.filamentData') },
    ];
    // Experiments tab: all printers with a serial (regardless of source)
    const cloudPrinters = printers.filter(p => p.bambu_serial);
    const isFilamentData = mainTab === 'data' && dataTab === 'filamentData';
    const [actionsLast, setActionsLast] = useState(() => localStorage.getItem('fm_actions_last') === 'true');
    const toggleActionsLast = (val) => {
        setActionsLast(val);
        localStorage.setItem('fm_actions_last', String(val));
    };
    // Regional overrides
    const { data: userPrefs } = useQuery({
        queryKey: ['user-prefs'],
        queryFn: api.getUserPrefs,
        staleTime: Infinity,
    });
    const { data: haLocale } = useQuery({
        queryKey: ['ha-locale'],
        queryFn: api.getHALocale,
        staleTime: Infinity,
    });
    const [tzInput, setTzInput] = useState('');
    const [curInput, setCurInput] = useState('');
    const [ctyInput, setCtyInput] = useState('');
    const [lowStockPct, setLowStockPct] = useState(20);
    const [prefsSaved, setPrefsSaved] = useState(false);
    // Populate inputs once prefs load
    useEffect(() => {
        if (userPrefs) {
            setTzInput(userPrefs.timezone_override ?? '');
            setCurInput(userPrefs.currency_override ?? '');
            setCtyInput(userPrefs.country_override ?? '');
            setLowStockPct(userPrefs.low_stock_threshold_pct ?? 20);
        }
    }, [userPrefs]);
    const savePrefs = useMutation({
        mutationFn: () => api.saveUserPrefs({
            timezone_override: tzInput.trim() || null,
            currency_override: curInput.trim() || null,
            country_override: ctyInput.trim() || null,
            low_stock_threshold_pct: lowStockPct,
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['user-prefs'] });
            qc.invalidateQueries({ queryKey: ['ha-locale'] });
            setPrefsSaved(true);
            setTimeout(() => setPrefsSaved(false), 2000);
        },
    });
    return (_jsxs("div", { className: `space-y-4 ${isFilamentData ? '' : 'max-w-2xl'}`, children: [_jsxs("div", { className: "flex items-baseline justify-between", children: [_jsx("h2", { className: "text-lg font-bold", children: t('settings.title') }), versionData && _jsxs("span", { className: "text-xs text-gray-500", children: ["v", versionData.version] })] }), _jsx("div", { className: "flex border-b border-surface-3 gap-0", children: MAIN_TABS.map(tab => (_jsxs("button", { onClick: () => setMainTab(tab.id), className: `pb-2.5 pt-1 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 -mb-px ${mainTab === tab.id
                        ? 'border-blue-500 text-white'
                        : 'border-transparent text-gray-400 hover:text-gray-200'}`, children: [tab.label, tab.dot && _jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" })] }, tab.id))) }), mainTab === 'printers' && (_jsxs("div", { className: "card", children: [_jsx("div", { className: "flex justify-end mb-4", children: _jsxs("button", { className: "btn-primary flex items-center gap-1.5 text-xs", onClick: () => setShowForm(true), children: [_jsx(Plus, { size: 13 }), " ", t('settings.printers.addPrinter')] }) }), printers.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: t('settings.printers.noPrintersHint') })) : (_jsxs(_Fragment, { children: [printers.length > 1 && (_jsx("div", { className: "flex border-b border-surface-3 mb-4 gap-0 -mx-5 px-5 overflow-x-auto shrink-0", children: printers.map(p => (_jsx("button", { onClick: () => setActivePrinterId(p.id), className: `pb-2.5 pt-2 px-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${activePrinter?.id === p.id
                                        ? 'border-blue-500 text-white'
                                        : 'border-transparent text-gray-400 hover:text-gray-200'}`, children: p.name }, p.id))) })), activePrinter && (_jsx(PrinterCard, { printer: activePrinter, onEdit: () => setEditing(activePrinter), onDelete: () => {
                                    if (confirm(t('settings.printers.confirmDelete', { name: activePrinter.name })))
                                        deleteMut.mutate(activePrinter.id);
                                } }))] }))] })), mainTab === 'data' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: `card ${isFilamentData ? 'pb-0' : ''}`, children: [_jsx("div", { className: "flex border-b border-surface-3 gap-0 -mx-5 px-5 pt-1", style: { overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }, children: DATA_SUBTABS.map(st => (_jsx("button", { onClick: () => setDataTab(st.id), className: `pb-2.5 pt-1 px-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${dataTab === st.id
                                        ? 'border-blue-500 text-white'
                                        : 'border-transparent text-gray-400 hover:text-gray-200'}`, children: st.label }, st.id))) }), !isFilamentData && (_jsxs("div", { className: "mt-5", children: [dataTab === 'brandWeights' && _jsx(BrandWeightsSection, { actionsLast: actionsLast }), dataTab === 'brands' && (_jsx(NameListSection, { title: t('settings.brands.title'), queryKey: "filament-brands", fetchFn: api.getFilamentBrands, createFn: api.createFilamentBrand, updateFn: api.updateFilamentBrand, deleteFn: api.deleteFilamentBrand, placeholder: t('settings.brands.placeholder'), noEntries: t('settings.brands.noEntries'), actionsLast: actionsLast })), dataTab === 'materials' && (_jsx(NameListSection, { title: t('settings.materials.title'), queryKey: "filament-materials", fetchFn: api.getFilamentMaterials, createFn: api.createFilamentMaterial, updateFn: api.updateFilamentMaterial, deleteFn: api.deleteFilamentMaterial, placeholder: t('settings.materials.placeholder'), noEntries: t('settings.materials.noEntries'), actionsLast: actionsLast })), dataTab === 'subtypes' && (_jsx(NameListSection, { title: t('settings.subtypes.title'), queryKey: "filament-subtypes", fetchFn: api.getFilamentSubtypes, createFn: api.createFilamentSubtype, updateFn: api.updateFilamentSubtype, deleteFn: api.deleteFilamentSubtype, placeholder: t('settings.subtypes.placeholder'), noEntries: t('settings.subtypes.noEntries'), actionsLast: actionsLast })), dataTab === 'locations' && (_jsx(NameListSection, { title: t('settings.purchaseLocations.title'), queryKey: "purchase-locations", fetchFn: api.getPurchaseLocations, createFn: api.createPurchaseLocation, updateFn: api.updatePurchaseLocation, deleteFn: api.deletePurchaseLocation, placeholder: t('settings.purchaseLocations.placeholder'), noEntries: t('settings.purchaseLocations.noEntries'), actionsLast: actionsLast })), dataTab === 'storageLocations' && (_jsx(NameListSection, { title: t('settings.storageLocations.title'), queryKey: "storage-locations", fetchFn: api.getStorageLocations, createFn: api.createStorageLocation, updateFn: api.updateStorageLocation, deleteFn: api.deleteStorageLocation, placeholder: t('settings.storageLocations.placeholder'), noEntries: t('settings.storageLocations.noEntries'), actionsLast: actionsLast }))] }))] }), isFilamentData && _jsx(FilamentDataSection, { actionsLast: actionsLast })] })), mainTab === 'transfer' && _jsx(DataTransferSection, {}), mainTab === 'appearance' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "card space-y-4", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-300", children: t('settings.appearance.title') }), _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("input", { id: "actions-last", type: "checkbox", className: "mt-0.5 accent-blue-500", checked: actionsLast, onChange: e => toggleActionsLast(e.target.checked) }), _jsxs("label", { htmlFor: "actions-last", className: "cursor-pointer", children: [_jsx("p", { className: "text-sm text-gray-200", children: t('settings.appearance.actionsLast') }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: t('settings.appearance.actionsLastHint') })] })] })] }), _jsxs("div", { className: "card space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-gray-300", children: t('settings.appearance.regionalTitle') }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: t('settings.appearance.regionalHint') })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "label text-xs mb-1 block", children: t('settings.appearance.timezone') }), _jsx("input", { className: "input text-xs py-1 w-full max-w-xs", value: tzInput, onChange: e => setTzInput(e.target.value), placeholder: haLocale?.time_zone ?? 'UTC' }), _jsxs("p", { className: "text-[11px] text-gray-600 mt-0.5", children: [t('settings.appearance.currentValue'), ": ", haLocale?.time_zone ?? 'UTC', userPrefs?.timezone_override ? ` (${t('settings.appearance.override')})` : ` (${t('settings.appearance.fromHA')})`] })] }), _jsxs("div", { children: [_jsx("label", { className: "label text-xs mb-1 block", children: t('settings.appearance.currency') }), _jsx("input", { className: "input text-xs py-1 w-24 font-mono uppercase", value: curInput, onChange: e => setCurInput(e.target.value.toUpperCase().slice(0, 3)), placeholder: haLocale?.currency ?? 'EUR', maxLength: 3 }), _jsxs("p", { className: "text-[11px] text-gray-600 mt-0.5", children: [t('settings.appearance.currentValue'), ": ", haLocale?.currency ?? 'EUR', userPrefs?.currency_override ? ` (${t('settings.appearance.override')})` : ` (${t('settings.appearance.fromHA')})`] })] }), _jsxs("div", { children: [_jsx("label", { className: "label text-xs mb-1 block", children: t('settings.appearance.country') }), _jsx("input", { className: "input text-xs py-1 w-20 font-mono uppercase", value: ctyInput, onChange: e => setCtyInput(e.target.value.toUpperCase().slice(0, 2)), placeholder: haLocale?.country || '—', maxLength: 2 }), _jsxs("p", { className: "text-[11px] text-gray-600 mt-0.5", children: [t('settings.appearance.currentValue'), ": ", haLocale?.country || '—', userPrefs?.country_override ? ` (${t('settings.appearance.override')})` : ` (${t('settings.appearance.fromHA')})`] })] }), _jsxs("div", { children: [_jsx("label", { className: "label text-xs mb-1 block", children: t('settings.appearance.lowStockThreshold') }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { className: "input text-xs py-1 w-20", type: "number", min: 1, max: 100, value: lowStockPct, onChange: e => setLowStockPct(Math.max(1, Math.min(100, parseInt(e.target.value) || 20))) }), _jsx("span", { className: "text-xs text-gray-400", children: "%" })] }), _jsx("p", { className: "text-[11px] text-gray-600 mt-0.5", children: t('settings.appearance.lowStockHint') })] })] }), _jsxs("div", { className: "flex items-center gap-3 pt-1", children: [_jsx("button", { className: "btn-primary text-xs px-3 py-1.5", onClick: () => savePrefs.mutate(), disabled: savePrefs.isPending, children: prefsSaved ? t('settings.appearance.regionalSaved') : t('settings.appearance.regionalSave') }), prefsSaved && _jsx("span", { className: "text-xs text-green-400", children: "\u2713" })] })] })] })), mainTab === 'experiments' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "flex items-center justify-between mb-3", children: _jsx("h3", { className: "text-sm font-semibold text-gray-300", children: t('settings.bambuCloud.title') }) }), _jsx("p", { className: "text-xs text-gray-500 mb-4", children: t('settings.bambuCloud.hint') }), _jsx(BambuCloudSection, {})] }), _jsxs("div", { className: "card", children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-300", children: t('settings.filamentSync.title') }), _jsx("span", { className: "text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/40 border border-yellow-700 text-yellow-400", children: t('common.experimental') })] }), _jsx(FilamentSyncSection, { isCloudConnected: isCloudConnected })] }), isCloudConnected && cloudPrinters.length > 0 && (_jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-xs font-medium text-gray-400 uppercase tracking-wide", children: t('settings.bambuCloud.liveStatus') }), cloudPrinters.map(p => (_jsx(CloudPrinterStatus, { printer: p }, p.id)))] }))] })), (showForm || editing) && (_jsx(Modal, { children: _jsx(PrinterFormModal, { initial: editing ?? undefined, cloudStatus: cloudStatus, existingPrinters: printers, onSave: data => {
                        if (editing)
                            updateMut.mutate({ id: editing.id, data });
                        else
                            createMut.mutate(data);
                    }, onCancel: () => { setShowForm(false); setEditing(null); } }) }))] }));
}
