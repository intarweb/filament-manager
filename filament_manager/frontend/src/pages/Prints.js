import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { Plus, Pencil, Trash2, X, CheckCircle, XCircle, Zap, Scale, FileText, Download, Search, CalendarDays, FolderOpen, ExternalLink, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';
import { useHATZ } from '../hooks/useHATZ';
import { formatDateTimeTZ, nowInTZ, utcToLocalInput, localInputToUTC } from '../utils/time';
const PAGE_SIZE = 50;
function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}
function getMondayOf(dateStr) {
    const d = new Date(dateStr + 'T12:00:00Z');
    const delta = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
    return addDays(dateStr, -delta);
}
/** Return the default date/month string for a mode+preset combination. */
function presetToCustom(mode, preset, today) {
    if (mode === 'month') {
        if (preset === 'this')
            return today.slice(0, 7);
        const d = new Date(today + 'T12:00:00Z');
        d.setUTCDate(1);
        d.setUTCMonth(d.getUTCMonth() - 1);
        return d.toISOString().slice(0, 7);
    }
    if (mode === 'week') {
        const ref = preset === 'this' ? today : addDays(today, -7);
        return getMondayOf(ref);
    }
    return preset === 'this' ? today : addDays(today, -1);
}
/** Format "YYYY-MM-DD" as "DD.MM." for compact range labels. */
function fmtShort(dateStr) {
    const [, m, d] = dateStr.split('-');
    return `${d}.${m}.`;
}
function resolveDateRange(f, today) {
    const { mode, preset, custom } = f;
    if (mode === 'month') {
        let ym;
        if (preset === 'this') {
            ym = today.slice(0, 7);
        }
        else if (preset === 'last') {
            const d = new Date(today + 'T12:00:00Z');
            d.setUTCDate(1);
            d.setUTCMonth(d.getUTCMonth() - 1);
            ym = d.toISOString().slice(0, 7);
        }
        else {
            if (!custom)
                return null;
            ym = custom;
        }
        const [y, m] = ym.split('-').map(Number);
        const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
        return { start: `${ym}-01`, end: `${ym}-${String(lastDay).padStart(2, '0')}` };
    }
    if (mode === 'week') {
        const ref = preset === 'this' ? today : preset === 'last' ? addDays(today, -7) : custom;
        if (!ref)
            return null;
        const mon = getMondayOf(ref);
        return { start: mon, end: addDays(mon, 6) };
    }
    if (mode === 'day') {
        const day = preset === 'this' ? today : preset === 'last' ? addDays(today, -1) : custom;
        if (!day)
            return null;
        return { start: day, end: day };
    }
    return null;
}
function PrintForm({ initial, spools, onSave, onCancel, }) {
    const { t } = useTranslation();
    const tz = useHATZ();
    const now = nowInTZ(tz);
    const [name, setName] = useState(initial?.name ?? '');
    const [modelName, setModelName] = useState(initial?.model_name ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [startedAt, setStartedAt] = useState(initial?.started_at ? utcToLocalInput(initial.started_at, tz) : now);
    const [finishedAt, setFinishedAt] = useState(initial?.finished_at ? utcToLocalInput(initial.finished_at, tz) : '');
    const [durationH, setDurationH] = useState(initial?.duration_hours?.toString() ?? '');
    const [success, setSuccess] = useState(initial?.success ?? true);
    const [printerId, setPrinterId] = useState('');
    const [notes, setNotes] = useState(initial?.notes ?? '');
    const [url, setUrl] = useState(initial?.url ?? '');
    const [energyKwh, setEnergyKwh] = useState(initial?.energy_kwh?.toString() ?? '');
    const [energyCost, setEnergyCost] = useState(initial?.energy_cost?.toString() ?? '');
    const [usages, setUsages] = useState(() => {
        // Confirmed usages take priority
        if (initial?.usages && initial.usages.length > 0) {
            return initial.usages.map(u => ({
                spool_id: u.spool_id,
                grams_used: u.grams_used,
                ams_slot: u.ams_slot ?? '',
            }));
        }
        // Unconfirmed auto print: pre-populate from the cloud snapshot so the edit
        // form shows the print-time spool, not whatever is in the slot right now.
        if (initial?.suggested_usages && initial.suggested_usages.length > 0) {
            return initial.suggested_usages
                .filter(s => s.spool_id != null)
                .map(s => ({ spool_id: s.spool_id, grams_used: s.grams, ams_slot: s.ams_slot }));
        }
        return [];
    });
    const [loadingAMS, setLoadingAMS] = useState(false);
    const [showEmptySpools, setShowEmptySpools] = useState(false);
    const [deductWeight, setDeductWeight] = useState(true);
    // For existing jobs usages start read-only; new jobs go straight to edit mode
    const [usageEditMode, setUsageEditMode] = useState(!initial);
    const [fmProjectId, setFmProjectId] = useState(initial?.fm_project_id ?? '');
    const { data: printers = [] } = useQuery({
        queryKey: ['printers'],
        queryFn: api.getPrinters,
    });
    const { data: projects = [] } = useQuery({
        queryKey: ['projects'],
        queryFn: api.getProjects,
    });
    useEffect(() => {
        if (initial?.printer_name && printers.length > 0) {
            const match = printers.find(p => p.name === initial.printer_name);
            if (match)
                setPrinterId(match.id);
        }
    }, [printers, initial?.printer_name]);
    const selectedPrinter = printers.find(p => p.id === printerId) ?? null;
    // Spools visible in dropdowns: non-empty always shown; empty only when checkbox is on.
    // Always include spools already selected in a usage row so existing rows don't go blank.
    const selectedSpoolIds = new Set(usages.map(u => u.spool_id));
    const visibleSpools = spools.filter(s => showEmptySpools || Math.round(s.remaining_pct) > 0 || selectedSpoolIds.has(s.id));
    // Auto-load AMS on first open when printer is known and no usages are set yet.
    // Only for new prints — never overwrite stored usages on an existing job.
    useEffect(() => {
        if (initial)
            return; // editing existing job — never auto-load
        if (!printerId)
            return;
        if (usages.length > 0)
            return; // already has data — don't overwrite
        const printer = printers.find(p => p.id === printerId);
        if (!printer)
            return;
        setLoadingAMS(true);
        api.getPrinterAMS(printer.id).then(trays => {
            const rows = trays
                .filter(t => t.spool !== null)
                .map(t => ({ spool_id: t.spool.id, grams_used: 0, ams_slot: t.slot_key }));
            if (rows.length > 0)
                setUsages(rows);
        }).finally(() => setLoadingAMS(false));
    }, [printerId]);
    const loadFromAMS = async () => {
        if (!selectedPrinter)
            return;
        setLoadingAMS(true);
        try {
            const trays = await api.getPrinterAMS(selectedPrinter.id);
            const rows = trays
                .filter(t => t.spool !== null)
                .map(t => ({ spool_id: t.spool.id, grams_used: 0, ams_slot: t.slot_key }));
            setUsages(rows);
        }
        finally {
            setLoadingAMS(false);
        }
    };
    const addUsage = () => {
        const first = visibleSpools[0];
        if (first)
            setUsages(u => [...u, { spool_id: first.id, grams_used: 0, ams_slot: '' }]);
    };
    const removeUsage = (i) => setUsages(u => u.filter((_, idx) => idx !== i));
    const updateUsage = (i, k, v) => setUsages(u => u.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
    const handleSave = () => {
        const payload = {
            name,
            model_name: modelName || null,
            description: description || null,
            url: url || null,
            started_at: localInputToUTC(startedAt, tz),
            finished_at: finishedAt ? localInputToUTC(finishedAt, tz) : null,
            duration_seconds: durationH ? Math.round(parseFloat(durationH) * 3600) : null,
            success,
            notes: notes || null,
            printer_name: selectedPrinter?.name ?? null,
            fm_project_id: fmProjectId || null,
            energy_kwh: energyKwh ? parseFloat(energyKwh) : null,
            energy_cost: energyCost ? parseFloat(energyCost) : null,
        };
        // Only send usages when the user explicitly entered edit mode — otherwise the
        // backend would revert and re-apply existing usages unchanged, creating noisy
        // audit pairs (print_delete + print_manual) with zero net weight change.
        if (usageEditMode) {
            payload.usages = usages.map(u => ({
                spool_id: Number(u.spool_id),
                grams_used: Number(u.grams_used),
                ams_slot: u.ams_slot || null,
            }));
            payload.deduct_weight = deductWeight;
        }
        onSave(payload);
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4", children: _jsxs("div", { className: "bg-surface-2 border border-surface-3 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-surface-3", children: [_jsx("h2", { className: "font-semibold", children: initial ? t('prints.editPrint') : t('prints.logPrint') }), _jsx("button", { onClick: onCancel, className: "btn-ghost p-1", children: _jsx(X, { size: 16 }) })] }), _jsxs("div", { className: "p-5 space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "label", children: [t('prints.form.printName'), " *"] }), _jsx("input", { className: "input", value: name, onChange: e => setName(e.target.value), placeholder: t('prints.form.namePlaceholder') })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: t('prints.form.description') }), _jsx("input", { className: "input", value: description, onChange: e => setDescription(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: t('prints.form.url') }), _jsx("input", { className: "input", type: "url", value: url, onChange: e => setUrl(e.target.value), placeholder: "https://makerworld.com/\u2026" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsxs("label", { className: "label", children: [t('prints.form.startedAt'), " *"] }), _jsx("input", { className: "input", type: "datetime-local", value: startedAt, onChange: e => setStartedAt(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: t('prints.form.finishedAt') }), _jsx("input", { className: `input ${initial?.finished_at ? 'opacity-60' : ''}`, type: "datetime-local", value: finishedAt, onChange: e => setFinishedAt(e.target.value), readOnly: !!initial?.finished_at })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "label", children: t('prints.form.duration') }), _jsx("input", { className: "input", type: "number", step: "0.1", min: "0", value: durationH, onChange: e => setDurationH(e.target.value), placeholder: "2.5" })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: t('prints.form.printer') }), initial ? (_jsx("p", { className: "input opacity-60 cursor-default select-none", children: initial.printer_name ?? t('common.none') })) : (_jsxs("select", { className: "input", value: printerId, onChange: e => setPrinterId(e.target.value ? Number(e.target.value) : ''), children: [_jsx("option", { value: "", children: t('common.none') }), printers.map(p => (_jsx("option", { value: p.id, children: p.name }, p.id)))] }))] })] }), projects.length > 0 && (_jsxs("div", { children: [_jsxs("label", { className: "label flex items-center gap-1", children: [_jsx(FolderOpen, { size: 12 }), " ", t('prints.form.project')] }), _jsxs("select", { className: "input", value: fmProjectId, onChange: e => setFmProjectId(e.target.value ? Number(e.target.value) : ''), children: [_jsx("option", { value: "", children: t('common.none') }), projects.map(p => (_jsx("option", { value: p.id, children: p.name }, p.id)))] })] })), _jsxs("div", { className: "flex items-center gap-6", children: [_jsxs("label", { className: "flex items-center gap-2 text-sm cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: success, onChange: e => setSuccess(e.target.checked) }), t('prints.form.printSucceeded')] }), _jsxs("label", { className: "flex items-center gap-2 text-sm cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: deductWeight, onChange: e => setDeductWeight(e.target.checked) }), t('prints.form.deductFromSpool')] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "label", children: t('prints.form.energyKwh') }), _jsx("input", { className: "input", type: "number", step: "0.01", min: "0", value: energyKwh, onChange: e => setEnergyKwh(e.target.value), placeholder: "0.00" })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: t('prints.form.energyCost') }), _jsx("input", { className: "input", type: "number", step: "0.01", min: "0", value: energyCost, onChange: e => setEnergyCost(e.target.value), placeholder: "0.00" })] })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("label", { className: "label mb-0", children: t('prints.form.filamentUsed') }), _jsx("div", { className: "flex items-center gap-2", children: usageEditMode ? (_jsxs(_Fragment, { children: [_jsxs("label", { className: "flex items-center gap-1 text-xs text-gray-400 cursor-pointer select-none", children: [_jsx("input", { type: "checkbox", checked: showEmptySpools, onChange: e => setShowEmptySpools(e.target.checked), className: "accent-blue-500" }), t('prints.form.showEmptySpools')] }), _jsxs("button", { className: "btn-ghost text-xs py-0.5 flex items-center gap-1 disabled:opacity-40", onClick: loadFromAMS, disabled: !selectedPrinter || loadingAMS, title: selectedPrinter ? `Load current AMS tray assignments from ${selectedPrinter.name}` : t('prints.form.selectPrinterFirst'), children: [_jsx(Download, { size: 11 }), loadingAMS ? t('prints.form.loading') : t('prints.form.loadFromAMS')] }), _jsx("button", { className: "btn-ghost text-xs py-0.5", onClick: addUsage, children: t('prints.form.addSpool') })] })) : (_jsxs("button", { className: "btn-ghost text-xs py-0.5 flex items-center gap-1", onClick: () => setUsageEditMode(true), children: [_jsx(Pencil, { size: 11 }), t('prints.form.editUsages')] })) })] }), !usageEditMode && (usages.length === 0 ? (_jsx("p", { className: "text-xs text-gray-500", children: t('prints.form.noUsagesRecorded') })) : (usages.map((u, i) => {
                                    const spool = spools.find(s => s.id === u.spool_id);
                                    return (_jsxs("div", { className: "flex items-center gap-2 py-1 text-xs text-gray-400", children: [spool && (_jsx("span", { className: "w-2.5 h-2.5 rounded-full shrink-0", style: { background: spool.color_hex } })), _jsx("span", { className: "flex-1", children: spool
                                                    ? `${spool.brand} ${spool.material}${spool.subtype ? ` ${spool.subtype}` : ''} — ${spool.color_name}`
                                                    : `Spool #${u.spool_id}` }), _jsxs("span", { className: "text-gray-300", children: [u.grams_used.toFixed(1), "g"] }), u.ams_slot && _jsx("span", { className: "text-blue-400", children: u.ams_slot })] }, i));
                                }))), usageEditMode && (_jsxs(_Fragment, { children: [usages.length === 0 && (_jsx("p", { className: "text-xs text-gray-500", children: selectedPrinter ? t('prints.form.loadAMSHint') : t('prints.form.noAMSPrinter') })), usages.map((u, i) => (_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("select", { className: "input flex-1 text-xs py-1", value: u.spool_id, onChange: e => updateUsage(i, 'spool_id', e.target.value), children: visibleSpools.map(s => (_jsxs("option", { value: s.id, children: [s.brand, " ", s.material, s.subtype ? ` ${s.subtype}` : '', " \u2014 ", s.color_name, " (", Math.round(s.remaining_pct), "%)"] }, s.id))) }), _jsx("input", { className: "input w-20 text-xs py-1", type: "number", step: "0.1", min: "0", value: u.grams_used || '', onChange: e => updateUsage(i, 'grams_used', parseFloat(e.target.value) || 0), placeholder: "g" }), _jsx("span", { className: "text-xs text-gray-500", children: "g" }), _jsx("input", { className: "input w-24 text-xs py-1", value: u.ams_slot, onChange: e => updateUsage(i, 'ams_slot', e.target.value), placeholder: "slot" }), _jsx("button", { onClick: () => removeUsage(i), className: "text-red-400 hover:text-red-300", children: _jsx(X, { size: 14 }) })] }, i)))] }))] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: t('prints.form.notes') }), _jsx("textarea", { className: "input h-16 resize-none", value: notes, onChange: e => setNotes(e.target.value) })] })] }), _jsxs("div", { className: "flex justify-end gap-2 px-5 py-4 border-t border-surface-3", children: [_jsx("button", { className: "btn-ghost", onClick: onCancel, children: t('common.cancel') }), _jsx("button", { className: "btn-primary", onClick: handleSave, disabled: !name || !startedAt, children: t('common.save') })] })] }) }));
}
// ── Log Usage Modal ───────────────────────────────────────────────────────────
function LogUsageModal({ job, onSave, onCancel, onEdit, }) {
    const { t } = useTranslation();
    const { data: spools = [] } = useQuery({
        queryKey: ['spools'],
        queryFn: () => api.getSpools(),
    });
    // Backward-compat fallback: for old suggestions without a spool_id, look up current AMS tray.
    const { data: printers = [] } = useQuery({
        queryKey: ['printers'],
        queryFn: api.getPrinters,
    });
    const printer = printers.find(p => p.name === job.printer_name) ?? null;
    const { data: trays = [], isLoading: traysLoading, refetch: refetchTrays } = useQuery({
        queryKey: ['printer-ams', printer?.id],
        queryFn: () => api.getPrinterAMS(printer.id),
        enabled: !!printer && (job.suggested_usages ?? []).length > 0,
    });
    const traysBySlot = Object.fromEntries(trays.map(t => [t.slot_key, t]));
    const suggestions = job.suggested_usages ?? [];
    const hasUnresolved = !traysLoading && suggestions.some(s => s.spool_id
        ? !spools.some(sp => sp.id === s.spool_id)
        : !traysBySlot[s.ams_slot]?.spool);
    // Grams state keyed by index (not ams_slot) — swap scenario has two entries for same slot
    const [grams, setGrams] = useState(() => Object.fromEntries(suggestions.map((s, i) => [i, String(s.grams)])));
    const handleSave = () => {
        const usages = [];
        suggestions.forEach((s, i) => {
            const gramsVal = parseFloat(grams[i] || '0');
            const spoolId = s.spool_id ?? traysBySlot[s.ams_slot]?.spool?.id ?? null;
            if (gramsVal <= 0 || spoolId == null)
                return;
            usages.push({ spool_id: spoolId, grams_used: gramsVal, ams_slot: s.ams_slot });
        });
        onSave(usages);
    };
    // Group suggestions by ams_slot to detect swap rows
    const grouped = suggestions.reduce((acc, s, i) => {
        if (!acc[s.ams_slot])
            acc[s.ams_slot] = [];
        acc[s.ams_slot].push({ ...s, _idx: i });
        return acc;
    }, {});
    return (_jsx("div", { className: "fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4", children: _jsxs("div", { className: "bg-surface-2 border border-surface-3 rounded-2xl w-full max-w-md", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-surface-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-semibold", children: t('prints.logUsage') }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5 truncate max-w-xs", children: job.name })] }), _jsx("button", { onClick: onCancel, className: "btn-ghost p-1", children: _jsx(X, { size: 16 }) })] }), _jsxs("div", { className: "p-5 space-y-4", children: [_jsx("p", { className: "text-xs text-blue-400 bg-blue-950/40 rounded px-3 py-1.5", children: t('prints.cloudSuggestion') }), suggestions.length === 0 && (_jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-sm text-gray-400", children: t('prints.noCloudData') }), _jsx("button", { className: "btn-secondary w-full", onClick: onEdit, children: t('prints.logManually') })] })), Object.entries(grouped).map(([slot, entries]) => {
                            const isSwap = entries.length > 1;
                            return (_jsxs("div", { className: isSwap ? 'rounded-lg border border-amber-700/50 bg-amber-950/20 p-3 space-y-2' : '', children: [isSwap && (_jsxs("p", { className: "text-xs text-amber-400 font-medium", children: [t('prints.spoolSwapDetected'), " \u00B7 ", slot] })), entries.map(s => {
                                        const spool = s.spool_id
                                            ? (spools.find(sp => sp.id === s.spool_id) ?? null)
                                            : (traysBySlot[s.ams_slot]?.spool ?? null);
                                        const swapLabel = s.swap_index === 0
                                            ? t('prints.swapOriginal')
                                            : s.swap_index === 1
                                                ? t('prints.swapReplacement')
                                                : null;
                                        return (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "w-3 h-3 rounded-full shrink-0", style: { background: spool?.color_hex ?? s.color ?? '#888' } }), _jsx("div", { className: "flex-1 min-w-0", children: spool ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm text-white truncate", children: [spool.brand, " ", spool.material, spool.subtype ? ` ${spool.subtype}` : '', " \u00B7 ", spool.color_name, swapLabel && (_jsxs("span", { className: "ml-1.5 text-xs text-amber-400", children: ["(", swapLabel, ")"] }))] }), _jsxs("p", { className: "text-xs text-gray-500", children: [!isSwap && `${slot} · `, spool.remaining_pct, "%", ` (${(spool.current_weight_g / 1000).toFixed(3)} kg)`, s.estimated && (_jsx("span", { className: "ml-1.5 text-yellow-600", children: t('common.est') }))] })] })) : (_jsxs("div", { children: [_jsxs("p", { className: "text-sm text-gray-400", children: [slot, s.filament_type ? ` · ${s.filament_type}` : '', swapLabel && (_jsxs("span", { className: "ml-1.5 text-xs text-amber-400", children: ["(", swapLabel, ")"] }))] }), _jsxs("div", { className: "flex items-center gap-2 mt-0.5", children: [_jsx("p", { className: "text-xs text-yellow-600", children: t('prints.spoolNotMatched') }), _jsxs("button", { className: "text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5", onClick: () => refetchTrays(), disabled: traysLoading, title: t('prints.reloadSlot'), children: [_jsx(RefreshCw, { size: 10, className: traysLoading ? 'animate-spin' : '' }), t('prints.reloadSlot')] })] })] })) }), _jsxs("div", { className: "flex items-center gap-1 shrink-0", children: [_jsx("input", { className: "input w-20 text-sm py-1 text-right", type: "number", min: "0", step: "0.1", placeholder: "0", value: grams[s._idx] ?? '', onChange: e => setGrams(g => ({ ...g, [s._idx]: e.target.value })) }), _jsx("span", { className: "text-xs text-gray-500", children: "g" })] })] }, s._idx));
                                    })] }, slot));
                        }), _jsx("p", { className: "text-xs text-gray-500 pt-1", children: t('prints.gramsHint') })] }), _jsxs("div", { className: "flex justify-end gap-2 px-5 py-4 border-t border-surface-3", children: [_jsx("button", { className: "btn-ghost", onClick: onCancel, children: t('common.cancel') }), hasUnresolved && suggestions.length > 0 && (_jsx("button", { className: "btn-secondary", onClick: onEdit, children: t('prints.logManually') })), _jsx("button", { className: "btn-primary", onClick: handleSave, children: t('prints.saveUsage') })] })] }) }));
}
// ── Live status bar for active (open) print jobs ──────────────────────────────
const LIVE_UNITS = {
    print_progress: '%',
    remaining_time: ' min',
    print_weight: 'g',
};
const LIVE_KEYS = ['print_stage', 'print_progress', 'remaining_time', 'print_weight', 'ams_active', 'active_tray'];
function LivePrintStatus({ printerId }) {
    const { t } = useTranslation();
    const liveLabels = {
        print_stage: t('settings.bambuCloud.statusStage'),
        print_progress: t('settings.bambuCloud.statusProgress'),
        remaining_time: t('settings.bambuCloud.statusRemaining'),
        print_weight: 'Weight',
        ams_active: 'AMS',
        active_tray: t('settings.bambuCloud.statusActiveTray'),
    };
    const { data: status } = useQuery({
        queryKey: ['printer-status-live', printerId],
        queryFn: () => api.getPrinterStatus(printerId),
        refetchInterval: 10000,
    });
    const entries = status
        ? LIVE_KEYS.map(k => [k, status[k]]).filter(([, v]) => v != null && v !== '')
        : [];
    if (entries.length === 0)
        return null;
    return (_jsx("div", { className: "mt-2 pt-2 border-t border-surface-3 flex flex-wrap gap-x-4 gap-y-0.5", children: entries.map(([key, val]) => (_jsxs("span", { className: "text-xs text-gray-500", children: [liveLabels[key], ": ", _jsxs("span", { className: "text-gray-300", children: [val, LIVE_UNITS[key] ?? ''] })] }, key))) }));
}
// ── Print Row ─────────────────────────────────────────────────────────────────
function PrintRow({ job, printer, onEdit, onDelete, onLogUsage }) {
    const tz = useHATZ();
    const [expanded, setExpanded] = useState(false);
    const needsUsage = job.source === 'auto' && job.finished_at && job.total_grams === 0 && job.suggested_usages !== null;
    const showModel = job.model_name && job.model_name !== job.name;
    const showDesignTitle = job.design_title && job.design_title !== job.name;
    return (_jsxs("div", { className: "card cursor-pointer", onClick: () => setExpanded(e => !e), children: [_jsxs("div", { className: "flex items-center gap-3", children: [job.success
                        ? _jsx(CheckCircle, { size: 16, className: "text-green-400 shrink-0" })
                        : _jsx(XCircle, { size: 16, className: "text-red-400 shrink-0" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("p", { className: "text-sm font-medium text-white truncate", children: job.name }), job.source === 'auto' && (_jsxs("span", { className: "text-xs bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0", children: [_jsx(Zap, { size: 9 }), " auto"] })), job.project_name && (_jsx("span", { className: "text-xs bg-surface-3 text-gray-300 px-1.5 py-0.5 rounded shrink-0", children: job.project_name })), job.url && (_jsx("a", { href: job.url, target: "_blank", rel: "noopener noreferrer", onClick: e => e.stopPropagation(), className: "text-gray-500 hover:text-blue-400 shrink-0", title: job.url, children: _jsx(ExternalLink, { size: 11 }) }))] }), _jsxs("p", { className: "text-xs text-gray-500", children: [formatDateTimeTZ(job.started_at, tz), job.printer_name && ` · ${job.printer_name}`, job.duration_hours && ` · ${job.duration_hours}h`] }), job.description && (_jsx("p", { className: "text-xs text-gray-400 mt-0.5 truncate", children: job.description })), showDesignTitle && (_jsxs("p", { className: "text-xs text-gray-600 flex items-center gap-1 mt-0.5", children: [_jsx(FileText, { size: 10 }), job.design_title] })), showModel && !showDesignTitle && (_jsxs("p", { className: "text-xs text-gray-600 flex items-center gap-1 mt-0.5", children: [_jsx(FileText, { size: 10 }), job.model_name] }))] }), _jsxs("div", { className: "text-right shrink-0", children: [_jsxs("p", { className: "text-sm text-white", children: [job.total_grams.toFixed(1), "g"] }), job.total_cost > 0 && _jsxs("p", { className: "text-xs text-gray-400", children: ["\u20AC", job.total_cost.toFixed(2)] }), job.energy_kwh != null && (_jsxs("p", { className: "text-xs text-gray-500", children: [job.energy_kwh.toFixed(2), " kWh", job.energy_cost != null && _jsxs(_Fragment, { children: [" \u00B7 \u20AC", job.energy_cost.toFixed(2)] })] }))] }), _jsxs("div", { className: "flex gap-1 ml-2", onClick: e => e.stopPropagation(), children: [needsUsage && (_jsx("button", { className: "btn-ghost p-1 text-yellow-400", onClick: onLogUsage, title: "Log filament usage", children: _jsx(Scale, { size: 12 }) })), _jsx("button", { className: "btn-ghost p-1", onClick: onEdit, children: _jsx(Pencil, { size: 12 }) }), _jsx("button", { className: "btn-ghost p-1 text-red-400", onClick: onDelete, children: _jsx(Trash2, { size: 12 }) })] })] }), !job.finished_at && printer && (_jsx(LivePrintStatus, { printerId: printer.id })), expanded && job.usages.length > 0 && (_jsx("div", { className: "mt-3 pt-3 border-t border-surface-3 space-y-1", children: job.usages.map(u => (_jsxs("div", { className: "flex items-center gap-2 text-xs text-gray-400", children: [u.spool && (_jsx("span", { className: "w-2.5 h-2.5 rounded-full shrink-0", style: { background: u.spool.color_hex } })), _jsx("span", { className: "flex-1", children: u.spool
                                ? `${u.spool.brand} ${u.spool.material}${u.spool.subtype ? ` ${u.spool.subtype}` : ''} — ${u.spool.color_name}`
                                : `Spool #${u.spool_id}` }), _jsxs("span", { children: [u.grams_used.toFixed(1), "g"] }), u.cost && _jsxs("span", { className: "text-gray-500", children: ["\u20AC", u.cost.toFixed(2)] }), u.ams_slot && _jsx("span", { className: "text-blue-400", children: u.ams_slot })] }, u.id))) }))] }));
}
// ── Page ──────────────────────────────────────────────────────────────────────
export default function Prints() {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const tz = useHATZ();
    const today = nowInTZ(tz).slice(0, 10);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [loggingUsage, setLoggingUsage] = useState(null);
    const [page, setPage] = useState(0);
    const [shown, setShown] = useState([]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [dateFilter, setDateFilter] = useState(null);
    // Debounce search input — fire API call 300 ms after the user stops typing
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);
    const needle = debouncedSearch.trim().toLowerCase();
    const dateRange = dateFilter ? resolveDateRange(dateFilter, today) : null;
    const isFiltered = !!needle || !!dateRange;
    // Reset accumulated list whenever filters change
    useEffect(() => {
        setShown([]);
        setPage(0);
    }, [debouncedSearch, dateFilter]);
    const { data: total } = useQuery({
        queryKey: ['prints-count', needle, dateRange?.start, dateRange?.end, tz],
        queryFn: () => api.getPrintsTotal(needle || undefined, dateRange?.start, dateRange?.end, tz),
    });
    const { data: pagePrints = [], isLoading } = useQuery({
        queryKey: ['prints', page, needle, dateRange?.start, dateRange?.end, tz],
        queryFn: () => api.getPrints(PAGE_SIZE, page * PAGE_SIZE, needle || undefined, dateRange?.start, dateRange?.end, tz),
    });
    useEffect(() => {
        if (pagePrints.length === 0)
            return;
        setShown(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newItems = pagePrints.filter(p => !existingIds.has(p.id));
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
        });
    }, [pagePrints]);
    const { data: spools = [] } = useQuery({
        queryKey: ['spools'],
        queryFn: () => api.getSpools(),
    });
    const { data: printers = [] } = useQuery({
        queryKey: ['printers'],
        queryFn: api.getPrinters,
    });
    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ['prints'] });
        qc.invalidateQueries({ queryKey: ['prints-count'] });
        qc.invalidateQueries({ queryKey: ['spools'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
        setShown([]);
        setPage(0);
    };
    const createMut = useMutation({ mutationFn: api.createPrint, onSuccess: () => { invalidate(); setShowForm(false); } });
    const updateMut = useMutation({
        mutationFn: ({ id, data }) => api.updatePrint(id, data),
        onSuccess: (updated) => {
            setShown(prev => prev.map(j => j.id === updated.id ? updated : j));
            qc.invalidateQueries({ queryKey: ['spools'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            qc.invalidateQueries({ queryKey: ['projects'] });
            // Invalidate prints cache so navigating away and back shows fresh project badges
            qc.invalidateQueries({ queryKey: ['prints'] });
            setEditing(null);
        },
    });
    const deleteMut = useMutation({ mutationFn: api.deletePrint, onSuccess: invalidate });
    const totalCount = total?.total ?? 0;
    const hasMore = shown.length < totalCount;
    // Filtering is handled server-side; shown contains only matching results
    const filtered = shown;
    const totalGrams = filtered.reduce((s, j) => s + j.total_grams, 0);
    const totalCost = filtered.reduce((s, j) => s + j.total_cost, 0);
    return (_jsxs("div", { className: "flex flex-col gap-4 h-full", children: [_jsxs("div", { className: "flex-none flex items-center justify-between flex-wrap gap-3", children: [_jsxs("div", { children: [_jsxs("h2", { className: "text-lg font-bold", children: [t('prints.history'), " (", isFiltered ? `${filtered.length} of ` : '', shown.length, totalCount > shown.length ? ` of ${totalCount}` : '', ")"] }), filtered.length > 0 && (_jsxs("p", { className: "text-xs text-gray-500", children: [totalGrams.toFixed(0), "g \u00B7 \u20AC", totalCost.toFixed(2)] }))] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { size: 13, className: "absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" }), _jsx("input", { className: "input pl-7 py-1.5 text-sm w-48", placeholder: t('prints.search'), value: search, onChange: e => setSearch(e.target.value) })] }), _jsxs("button", { className: "btn-primary flex items-center gap-1.5", onClick: () => setShowForm(true), children: [_jsx(Plus, { size: 14 }), " ", t('prints.logPrint')] })] })] }), _jsxs("div", { className: "flex-none card py-2.5 px-3 flex items-center gap-2 flex-wrap", children: [_jsx(CalendarDays, { size: 13, className: "text-gray-500 shrink-0" }), ['month', 'week', 'day'].map(m => (_jsx("button", { onClick: () => setDateFilter(f => f?.mode === m ? null : { mode: m, preset: 'this', custom: presetToCustom(m, 'this', today) }), className: `px-2.5 py-1 text-xs rounded-lg transition-colors ${dateFilter?.mode === m
                            ? 'bg-blue-900 text-blue-200'
                            : 'text-gray-400 hover:text-white hover:bg-surface-3 border border-surface-3'}`, children: t(`prints.filter.${m}`) }, m))), dateFilter && (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-px h-4 bg-surface-3 mx-0.5" }), ['this', 'last'].map(p => (_jsx("button", { onClick: () => setDateFilter(f => f ? { ...f, preset: p, custom: presetToCustom(f.mode, p, today) } : null), className: `px-2.5 py-1 text-xs rounded-lg transition-colors ${dateFilter.preset === p
                                    ? 'bg-surface-3 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-surface-3'}`, children: dateFilter.mode === 'month'
                                    ? (p === 'this' ? t('prints.filter.thisMonth') : t('prints.filter.lastMonth'))
                                    : dateFilter.mode === 'week'
                                        ? (p === 'this' ? t('prints.filter.thisWeek') : t('prints.filter.lastWeek'))
                                        : (p === 'this' ? t('prints.filter.today') : t('prints.filter.yesterday')) }, p))), _jsx("input", { type: dateFilter.mode === 'month' ? 'month' : 'date', className: "input py-0.5 text-xs", style: { width: 132 }, value: dateFilter.custom, onChange: e => {
                                    if (!e.target.value)
                                        return;
                                    if (dateFilter.mode === 'week') {
                                        // Snap to Monday of the selected week
                                        const monday = getMondayOf(e.target.value);
                                        setDateFilter(f => f ? { ...f, preset: 'custom', custom: monday } : null);
                                    }
                                    else {
                                        setDateFilter(f => f ? { ...f, preset: 'custom', custom: e.target.value } : null);
                                    }
                                } }), dateFilter.mode === 'week' && dateFilter.custom && (_jsxs("span", { className: "text-xs text-gray-400 whitespace-nowrap", children: [fmtShort(dateFilter.custom), " \u2013 ", fmtShort(addDays(dateFilter.custom, 6))] })), _jsx("button", { onClick: () => setDateFilter(null), className: "text-gray-500 hover:text-white ml-0.5", title: t('prints.filter.clear'), children: _jsx(X, { size: 13 }) })] }))] }), _jsxs("div", { className: "flex-1 min-h-0 overflow-y-auto space-y-2", children: [isLoading && shown.length === 0 && _jsx("p", { className: "text-gray-500 text-sm", children: t('common.loading') }), isFiltered && filtered.length === 0 && shown.length > 0 && (_jsx("p", { className: "text-sm text-gray-500", children: t('prints.noResults') })), filtered.map(job => (_jsx(PrintRow, { job: job, printer: printers.find(p => p.name === job.printer_name) ?? null, onEdit: () => setEditing(job), onDelete: () => { if (confirm(t('prints.confirmDelete', { name: job.name })))
                            deleteMut.mutate(job.id); }, onLogUsage: () => setLoggingUsage(job) }, job.id))), hasMore && (_jsx("div", { className: "flex justify-center pt-2", children: _jsx("button", { className: "btn-ghost text-sm px-6", onClick: () => setPage(p => p + 1), disabled: isLoading, children: isLoading ? t('common.loading') : t('prints.loadMore', { n: totalCount - shown.length }) }) }))] }), (showForm || editing) && (_jsx(Modal, { children: _jsx(PrintForm, { initial: editing ?? undefined, spools: spools, onSave: data => {
                        if (editing)
                            updateMut.mutate({ id: editing.id, data });
                        else
                            createMut.mutate(data);
                    }, onCancel: () => { setShowForm(false); setEditing(null); } }) })), loggingUsage && (_jsx(Modal, { children: _jsx(LogUsageModal, { job: loggingUsage, onSave: usages => {
                        updateMut.mutate({
                            id: loggingUsage.id,
                            data: { usages },
                        });
                        setLoggingUsage(null);
                    }, onCancel: () => setLoggingUsage(null), onEdit: () => { setEditing(loggingUsage); setLoggingUsage(null); } }) }))] }));
}
