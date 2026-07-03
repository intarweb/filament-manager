import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { AlertTriangle, Printer, Zap, CheckCircle2 } from 'lucide-react';
import { findBestSpoolMatch } from '../utils/amsMatch';
import { formatDistanceToNow } from 'date-fns';
import { enUS, de, es } from 'date-fns/locale';
import { useHATZ, useCurrencyFormatter } from '../hooks/useHATZ';
import { parseUTC } from '../utils/time';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, CartesianGrid, } from 'recharts';
const LOCALE_MAP = { en: enUS, de, es };
const PIE_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
];
const TT_STYLE = { background: '#1c1c1e', border: '1px solid #48484a', borderRadius: 8, color: '#f5f5f7' };
const TT_LABEL = { color: '#d1d5db' };
const TT_ITEM = { color: '#f5f5f7' };
// ── Combined inventory card ───────────────────────────────────────────────────
function InventoryCard({ stats }) {
    const { t } = useTranslation();
    const fmtCurrency = useCurrencyFormatter();
    const rows = [
        {
            label: t('dashboard.totalPurchased'),
            spools: stats.total_spools,
            kg: stats.total_filament_kg,
            eur: stats.total_filament_spent_eur,
            dim: false,
        },
        {
            label: t('dashboard.printedSpent'),
            spools: stats.empty_spools,
            kg: stats.total_filament_kg - stats.total_available_kg,
            eur: stats.total_filament_spent_eur - stats.total_available_eur,
            dim: true,
        },
        {
            label: t('dashboard.available'),
            spools: stats.active_spools,
            kg: stats.total_available_kg,
            eur: stats.total_available_eur,
            est: true,
            dim: false,
        },
    ];
    return (_jsxs("div", { className: "card", children: [_jsx("p", { className: "text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3", children: t('dashboard.inventoryGroup') }), _jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-surface-3", children: [_jsx("th", { className: "pb-2 text-left" }), _jsx("th", { className: "pb-2 text-right text-xs font-medium text-gray-500 pl-5 whitespace-nowrap", children: t('dashboard.spoolsGroup') }), _jsx("th", { className: "pb-2 text-right text-xs font-medium text-gray-500 pl-5 whitespace-nowrap", children: t('dashboard.colWeight') }), _jsx("th", { className: "pb-2 text-right text-xs font-medium text-gray-500 pl-5 whitespace-nowrap", children: t('dashboard.colMoney') })] }) }), _jsx("tbody", { children: rows.map(r => (_jsxs("tr", { className: "border-b border-surface-3/40 last:border-0", children: [_jsx("td", { className: `py-2.5 pr-4 text-sm ${r.dim ? 'text-gray-500' : 'text-gray-300'}`, children: r.label }), _jsx("td", { className: `py-2.5 pl-5 text-right text-sm font-semibold tabular-nums ${r.dim ? 'text-gray-500' : 'text-white'}`, children: r.spools }), _jsxs("td", { className: `py-2.5 pl-5 text-right text-sm font-semibold tabular-nums whitespace-nowrap ${r.dim ? 'text-gray-500' : 'text-white'}`, children: [r.kg.toFixed(2), " kg"] }), _jsx("td", { className: `py-2.5 pl-5 text-right text-sm tabular-nums whitespace-nowrap ${r.dim ? 'text-gray-500' : 'text-gray-300'}`, children: fmtCurrency(r.eur) })] }, r.label))) })] })] }));
}
// ── Running job card ──────────────────────────────────────────────────────────
const LIVE_UNITS = {
    print_progress: '%',
    remaining_time: ' min',
    print_weight: 'g',
};
const LIVE_KEYS = ['print_stage', 'print_progress', 'remaining_time', 'print_weight', 'ams_active', 'active_tray'];
function RunningJobCard({ job, printers }) {
    const { t, i18n } = useTranslation();
    const liveLabels = {
        print_stage: t('settings.bambuCloud.statusStage'),
        print_progress: t('settings.bambuCloud.statusProgress'),
        remaining_time: t('settings.bambuCloud.statusRemaining'),
        print_weight: 'Weight',
        ams_active: 'AMS',
        active_tray: t('settings.bambuCloud.statusActiveTray'),
    };
    const locale = LOCALE_MAP[i18n.resolvedLanguage ?? 'en'] ?? enUS;
    const tz = useHATZ();
    const qc = useQueryClient();
    const printer = printers.find(p => p.name === job.printer_name) ?? null;
    const { data: status } = useQuery({
        queryKey: ['printer-status-live', printer?.id],
        queryFn: () => api.getPrinterStatus(printer.id),
        enabled: !!printer,
        refetchInterval: 10000,
    });
    const forceFinishMut = useMutation({
        mutationFn: () => api.updatePrint(job.id, {
            finished_at: new Date().toISOString(),
            success: true,
        }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard'] }),
    });
    const handleForceFinish = () => {
        if (!window.confirm(t('dashboard.forceFinishConfirm')))
            return;
        forceFinishMut.mutate();
    };
    const liveEntries = status
        ? LIVE_KEYS.map(k => [k, status[k]]).filter(([, v]) => v != null && v !== '')
        : [];
    return (_jsxs("div", { className: "card border border-blue-800/60 bg-blue-950/20", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx(Zap, { size: 15, className: "text-blue-400 shrink-0 mt-0.5" }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-semibold text-white truncate", children: job.name }), _jsxs("p", { className: "text-xs text-gray-500 mt-0.5", children: [job.printer_name && _jsxs("span", { children: [job.printer_name, " \u00B7 "] }), t('dashboard.runningFor'), " ", formatDistanceToNow(parseUTC(job.started_at), { locale })] })] })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsxs("button", { className: "flex items-center gap-1 text-xs text-gray-400 hover:text-white border border-surface-3 hover:border-gray-500 rounded px-2 py-0.5 transition-colors disabled:opacity-50", onClick: handleForceFinish, disabled: forceFinishMut.isPending, title: t('dashboard.forceFinish'), children: [_jsx(CheckCircle2, { size: 12 }), t('dashboard.forceFinish')] }), _jsx("span", { className: "text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full", children: t('dashboard.runningJob') })] })] }), liveEntries.length > 0 && (_jsx("div", { className: "mt-3 pt-3 border-t border-blue-800/40 flex flex-wrap gap-x-5 gap-y-1", children: liveEntries.map(([key, val]) => (_jsxs("span", { className: "text-xs text-gray-500", children: [liveLabels[key], ": ", _jsxs("span", { className: "text-gray-200 font-medium", children: [val, LIVE_UNITS[key] ?? ''] })] }, key))) }))] }));
}
// ── Recent print row ──────────────────────────────────────────────────────────
function PrintRow({ job }) {
    const { i18n } = useTranslation();
    const locale = LOCALE_MAP[i18n.resolvedLanguage ?? 'en'] ?? enUS;
    return (_jsxs("div", { className: "flex items-center justify-between py-2.5 border-b border-surface-3 last:border-0", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-white truncate", children: job.name }), _jsxs("p", { className: "text-xs text-gray-500", children: [formatDistanceToNow(parseUTC(job.started_at), { addSuffix: true, locale }), job.printer_name && ` · ${job.printer_name}`] })] }), _jsxs("div", { className: "text-right shrink-0 ml-4", children: [_jsxs("p", { className: "text-sm text-white", children: [(job.total_grams / 1000).toFixed(3), " kg"] }), job.total_cost > 0 && (_jsxs("p", { className: "text-xs text-gray-400", children: ["\u20AC", job.total_cost.toFixed(2)] }))] })] }));
}
function ChartSection({ stats }) {
    const { t } = useTranslation();
    const [tab, setTab] = useState('materials');
    const hasEnergy = stats.printer_energy.length > 0;
    const TAB_LABELS = [
        { key: 'materials', label: t('dashboard.tabs.materials') },
        { key: 'cost', label: t('dashboard.tabs.cost') },
        { key: 'weight', label: t('dashboard.tabs.weight') },
        { key: 'location', label: t('dashboard.tabs.location') },
        { key: 'timeline', label: t('dashboard.tabs.timeline') },
        ...(hasEnergy ? [{ key: 'energy', label: t('dashboard.tabs.energy') }] : []),
    ];
    const pieData = stats.material_breakdown.map((m, i) => ({
        name: m.material,
        value: m.count,
        kg: m.current_kg,
        color: PIE_COLORS[i % PIE_COLORS.length],
    }));
    const costData = [
        { name: t('dashboard.chart.purchased'), value: stats.total_filament_spent_eur },
        { name: t('dashboard.chart.printed'), value: +(stats.total_filament_spent_eur - stats.total_available_eur).toFixed(2) },
        { name: t('dashboard.chart.available'), value: stats.total_available_eur },
    ];
    const weightData = [
        { name: t('dashboard.chart.purchased'), value: stats.total_filament_kg },
        { name: t('dashboard.chart.printed'), value: +(stats.total_filament_kg - stats.total_available_kg).toFixed(3) },
        { name: t('dashboard.chart.available'), value: stats.total_available_kg },
    ];
    const locationData = stats.price_by_location.map((l, i) => ({
        name: l.location,
        avg: l.avg_price,
        count: l.count,
        color: PIE_COLORS[i % PIE_COLORS.length],
    }));
    return (_jsxs("div", { className: "card", children: [_jsx("div", { className: "flex gap-1 mb-4 border-b border-surface-3 pb-3 flex-wrap", children: TAB_LABELS.map(t => (_jsx("button", { onClick: () => setTab(t.key), className: `px-3 py-1 text-xs rounded-lg transition-colors ${tab === t.key
                        ? 'bg-accent text-white'
                        : 'text-gray-400 hover:text-white hover:bg-surface-3'}`, children: t.label }, t.key))) }), tab === 'materials' && (pieData.length === 0
                ? _jsx("p", { className: "text-sm text-gray-500", children: t('dashboard.noSpools') })
                : _jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: pieData, dataKey: "value", nameKey: "name", cx: "50%", cy: "50%", outerRadius: 90, children: pieData.map((entry, i) => _jsx(Cell, { fill: entry.color }, i)) }), _jsx(Tooltip, { contentStyle: TT_STYLE, labelStyle: TT_LABEL, itemStyle: TT_ITEM, formatter: (value, name, props) => [
                                    `${value} ${value === 1 ? t('dashboard.chart.spool') : t('dashboard.chart.spools')} · ${props.payload.kg.toFixed(2)} kg`, name,
                                ] }), _jsx(Legend, { formatter: (v, entry) => (_jsxs("span", { style: { color: '#9ca3af', fontSize: 12 }, children: [v, entry?.payload?.value != null ? ` (${entry.payload.value})` : ''] })) })] }) })), tab === 'cost' && (stats.total_filament_spent_eur === 0
                ? _jsx("p", { className: "text-sm text-gray-500", children: t('dashboard.noPurchaseData') })
                : _jsx(ResponsiveContainer, { width: "100%", height: 240, children: _jsxs(BarChart, { data: costData, barSize: 48, children: [_jsx(XAxis, { dataKey: "name", tick: { fill: '#9ca3af', fontSize: 12 }, axisLine: false, tickLine: false }), _jsx(YAxis, { tick: { fill: '#9ca3af', fontSize: 11 }, axisLine: false, tickLine: false }), _jsx(Tooltip, { contentStyle: TT_STYLE, labelStyle: TT_LABEL, itemStyle: TT_ITEM, separator: "", formatter: (v) => [`€${v.toFixed(2)}`, ''] }), _jsxs(Bar, { dataKey: "value", radius: [4, 4, 0, 0], children: [_jsx(Cell, { fill: "#3b82f6" }), _jsx(Cell, { fill: "#ef4444" }), _jsx(Cell, { fill: "#10b981" })] })] }) })), tab === 'weight' && (stats.total_filament_kg === 0
                ? _jsx("p", { className: "text-sm text-gray-500", children: t('dashboard.noFilamentData') })
                : _jsx(ResponsiveContainer, { width: "100%", height: 240, children: _jsxs(BarChart, { data: weightData, barSize: 48, children: [_jsx(XAxis, { dataKey: "name", tick: { fill: '#9ca3af', fontSize: 12 }, axisLine: false, tickLine: false }), _jsx(YAxis, { tick: { fill: '#9ca3af', fontSize: 11 }, axisLine: false, tickLine: false }), _jsx(Tooltip, { contentStyle: TT_STYLE, labelStyle: TT_LABEL, itemStyle: TT_ITEM, separator: "", formatter: (v) => [`${v.toFixed(3)} kg`, ''] }), _jsxs(Bar, { dataKey: "value", radius: [4, 4, 0, 0], children: [_jsx(Cell, { fill: "#3b82f6" }), _jsx(Cell, { fill: "#ef4444" }), _jsx(Cell, { fill: "#10b981" })] })] }) })), tab === 'location' && (locationData.length === 0
                ? _jsx("p", { className: "text-sm text-gray-500", children: t('dashboard.noLocationData') })
                : _jsx(ResponsiveContainer, { width: "100%", height: 240, children: _jsxs(BarChart, { data: locationData, barSize: 40, children: [_jsx(XAxis, { dataKey: "name", tick: { fill: '#9ca3af', fontSize: 12 }, axisLine: false, tickLine: false }), _jsx(YAxis, { tick: { fill: '#9ca3af', fontSize: 11 }, axisLine: false, tickLine: false, unit: "\u20AC" }), _jsx(Tooltip, { contentStyle: TT_STYLE, labelStyle: TT_LABEL, itemStyle: TT_ITEM, formatter: (v, _, props) => [
                                    `€${v.toFixed(2)} avg (${props.payload.count} ${props.payload.count !== 1 ? t('dashboard.chart.spools') : t('dashboard.chart.spool')})`,
                                    t('dashboard.chart.avgPrice'),
                                ] }), _jsx(Bar, { dataKey: "avg", radius: [4, 4, 0, 0], children: locationData.map((entry, i) => _jsx(Cell, { fill: entry.color }, i)) })] }) })), tab === 'timeline' && (stats.prints_per_day.length === 0
                ? _jsx("p", { className: "text-sm text-gray-500", children: t('dashboard.noPrints') })
                : (() => {
                    const data = stats.prints_per_day;
                    const total = data.length;
                    const minGap = Math.max(1, Math.floor(total / 24));
                    let lastMonth = '';
                    const tickFormatter = (dateStr, index) => {
                        if (index % minGap !== 0)
                            return '';
                        const month = dateStr.slice(0, 7);
                        if (month === lastMonth)
                            return '';
                        lastMonth = month;
                        const d = new Date(dateStr + 'T12:00:00Z');
                        return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                    };
                    return (_jsx(ResponsiveContainer, { width: "100%", height: 240, children: _jsxs(BarChart, { data: data, barSize: total > 180 ? 2 : total > 60 ? 4 : 8, barCategoryGap: 1, children: [_jsx(CartesianGrid, { vertical: false, stroke: "#2c2c2e" }), _jsx(XAxis, { dataKey: "date", tick: { fill: '#9ca3af', fontSize: 11 }, axisLine: false, tickLine: false, tickFormatter: tickFormatter, interval: 0 }), _jsx(YAxis, { tick: { fill: '#9ca3af', fontSize: 11 }, axisLine: false, tickLine: false, allowDecimals: false, width: 24 }), _jsx(Tooltip, { contentStyle: TT_STYLE, labelStyle: TT_LABEL, itemStyle: TT_ITEM, labelFormatter: (label) => new Date(label + 'T12:00:00Z').toLocaleDateString(undefined, {
                                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                                    }), formatter: (v) => [v === 1 ? '1 print' : `${v} prints`, ''], separator: "" }), _jsx(Bar, { dataKey: "count", radius: [2, 2, 0, 0], children: data.map((entry, i) => (_jsx(Cell, { fill: entry.count === 0 ? '#1e293b' : '#3b82f6' }, i))) })] }) }));
                })()), tab === 'energy' && ((() => {
                const energyData = stats.printer_energy.map((e, i) => ({
                    ...e,
                    color: PIE_COLORS[i % PIE_COLORS.length],
                }));
                const hasCost = energyData.some(e => e.energy_cost != null);
                return (_jsx(ResponsiveContainer, { width: "100%", height: 240, children: _jsxs(BarChart, { data: energyData, barSize: hasCost ? 20 : 40, children: [_jsx(XAxis, { dataKey: "printer", tick: { fill: '#9ca3af', fontSize: 12 }, axisLine: false, tickLine: false }), _jsx(YAxis, { tick: { fill: '#9ca3af', fontSize: 11 }, axisLine: false, tickLine: false }), _jsx(Tooltip, { contentStyle: TT_STYLE, labelStyle: TT_LABEL, itemStyle: TT_ITEM, formatter: (v, name) => name === 'energy_kwh' ? [`${v.toFixed(3)} kWh`, t('dashboard.chart.energyKwh')] : [`€${v.toFixed(4)}`, t('dashboard.chart.energyCost')] }), _jsx(Bar, { dataKey: "energy_kwh", radius: [4, 4, 0, 0], name: "energy_kwh", children: energyData.map((e, i) => _jsx(Cell, { fill: e.color }, i)) }), hasCost && (_jsx(Bar, { dataKey: "energy_cost", radius: [4, 4, 0, 0], name: "energy_cost", children: energyData.map((e, i) => _jsx(Cell, { fill: e.color, fillOpacity: 0.45 }, i)) }))] }) }));
            })())] }));
}
// ── AMS mismatch alert ────────────────────────────────────────────────────────
function AMSPrinterAlert({ printer, spools }) {
    const { t } = useTranslation();
    const { data: trays = [] } = useQuery({
        queryKey: ['printer-ams', printer.id],
        queryFn: () => api.getPrinterAMS(printer.id),
        refetchInterval: 30000,
    });
    const mismatches = trays.filter(tr => tr.ha_material &&
        tr.ha_color_hex &&
        tr.ha_remaining !== null &&
        parseFloat(tr.ha_remaining) > 0 &&
        findBestSpoolMatch(tr, spools) === null);
    if (mismatches.length === 0)
        return null;
    return (_jsxs("div", { className: "card border border-amber-800/50 bg-amber-950/20", children: [_jsxs("h3", { className: "text-sm font-semibold text-white mb-3 flex items-center gap-2", children: [_jsx(AlertTriangle, { size: 14 }), " ", t('dashboard.amsNoMatchCard'), " \u2014 ", printer.name] }), _jsx("div", { children: mismatches.map(tr => (_jsxs("div", { className: "flex items-center gap-3 py-2 border-b border-amber-800/30 last:border-0", children: [_jsx("span", { className: "w-3 h-3 rounded-full shrink-0 border border-white/20", style: { background: tr.ha_color_hex ?? '#888' } }), _jsx("div", { className: "min-w-0 flex-1", children: _jsxs("p", { className: "text-sm text-white", children: [tr.slot_key.replace(/ams(\d+)_tray(\d+)/, 'AMS $1 · T$2'), _jsx("span", { className: "text-gray-400 ml-2", children: tr.ha_material })] }) }), _jsx("span", { className: "text-xs text-gray-400 shrink-0", children: t('dashboard.amsNoMatch') })] }, tr.slot_key))) })] }));
}
// ── Page ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
    const { t } = useTranslation();
    const { data: stats, isLoading } = useQuery({
        queryKey: ['dashboard'],
        queryFn: api.getDashboard,
        refetchInterval: 30000,
    });
    const { data: printers = [] } = useQuery({
        queryKey: ['printers'],
        queryFn: api.getPrinters,
    });
    const { data: spools = [] } = useQuery({
        queryKey: ['spools'],
        queryFn: () => api.getSpools(),
    });
    if (isLoading)
        return _jsx("div", { className: "text-gray-500 text-sm", children: t('common.loading') });
    if (!stats)
        return null;
    const cloudPrinters = printers.filter(p => p.is_active && !!p.bambu_serial);
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-lg font-bold", children: t('dashboard.title') }), stats.running_job && (_jsx(RunningJobCard, { job: stats.running_job, printers: printers })), cloudPrinters.map(p => (_jsx(AMSPrinterAlert, { printer: p, spools: spools }, p.id))), _jsx(InventoryCard, { stats: stats }), _jsx(ChartSection, { stats: stats }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: [_jsxs("div", { className: "card", children: [_jsxs("h3", { className: "text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2", children: [_jsx(Printer, { size: 14 }), " ", t('dashboard.recentPrints')] }), stats.recent_prints.length === 0 ? (_jsx("p", { className: "text-gray-500 text-sm", children: t('dashboard.noPrints') })) : (stats.recent_prints.map(job => _jsx(PrintRow, { job: job }, job.id)))] }), _jsxs("div", { className: "card", children: [_jsxs("h3", { className: "text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2", children: [_jsx(AlertTriangle, { size: 14, className: "text-yellow-400" }), " ", t('dashboard.lowStockAlerts')] }), stats.low_stock.length === 0 ? (_jsx("p", { className: "text-gray-500 text-sm", children: t('dashboard.allWellStocked') })) : (stats.low_stock.map(spool => (_jsxs("div", { className: "flex items-center gap-3 py-2 border-b border-surface-3 last:border-0", children: [_jsx("span", { className: "w-3 h-3 rounded-full shrink-0", style: { background: spool.color_hex } }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("p", { className: "text-sm text-white truncate", children: [spool.brand, " ", spool.material, spool.subtype ? ` ${spool.subtype}` : '', " \u2014 ", spool.color_name] }), _jsx("div", { className: "mt-1 h-1.5 rounded-full bg-surface-3 overflow-hidden", children: _jsx("div", { className: "h-full rounded-full bg-yellow-500", style: { width: `${spool.remaining_pct}%` } }) })] }), _jsxs("span", { className: "text-sm text-yellow-400 shrink-0", children: [spool.remaining_pct, "%"] })] }, spool.id))))] })] })] }));
}
