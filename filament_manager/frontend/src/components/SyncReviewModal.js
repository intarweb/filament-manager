import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertCircle, CheckCircle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../api';
import Modal from './Modal';
function ColorDot({ hex, size = 10 }) {
    return (_jsx("span", { className: "inline-block rounded-full shrink-0 ring-1 ring-white/10", style: { width: size, height: size, background: hex } }));
}
function ConfidenceBadge({ score }) {
    const color = score >= 80 ? 'bg-green-900/40 text-green-400 border-green-700' :
        score >= 60 ? 'bg-blue-900/40 text-blue-400 border-blue-700' :
            'bg-yellow-900/40 text-yellow-400 border-yellow-700';
    return (_jsxs("span", { className: `text-[10px] px-1.5 py-0.5 rounded border ${color}`, children: [score, "%"] }));
}
function Section({ title, count, defaultOpen = true, children, }) {
    const [open, setOpen] = useState(defaultOpen);
    return (_jsxs("div", { className: "border border-gray-700 rounded-lg overflow-hidden", children: [_jsxs("button", { className: "w-full flex items-center justify-between px-4 py-3 bg-surface-2 hover:bg-gray-700/50 text-left transition-colors", onClick: () => setOpen(o => !o), children: [_jsx("span", { className: "text-sm font-medium text-gray-200", children: title }), _jsxs("span", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs text-gray-500 bg-gray-700 rounded-full px-2 py-0.5", children: count }), open ? _jsx(ChevronDown, { size: 14, className: "text-gray-400" }) : _jsx(ChevronRight, { size: 14, className: "text-gray-400" })] })] }), open && _jsx("div", { className: "p-4 space-y-3 bg-surface-1", children: children })] }));
}
export default function SyncReviewModal({ syncMode, onClose }) {
    const { t } = useTranslation();
    const [phase, setPhase] = useState('loading');
    const [plan, setPlan] = useState(null);
    const [result, setResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    // User selections
    const [checkedMatches, setCheckedMatches] = useState(new Set()); // `${local_id}:${cloud_id}`
    const [checkedImport, setCheckedImport] = useState(new Set()); // cloud_ids
    const [checkedPush, setCheckedPush] = useState(new Set()); // local_ids
    const [deletedActions, setDeletedActions] = useState({});
    // Fetch preview on mount
    useEffect(() => {
        let cancelled = false;
        api.filamentSyncPreview()
            .then(p => {
            if (cancelled)
                return;
            setPlan(p);
            // Pre-populate selections
            const matchSet = new Set();
            p.match_suggestions.forEach(s => {
                if (s.pre_checked)
                    matchSet.add(`${s.local_id}:${s.cloud_id}`);
            });
            setCheckedMatches(matchSet);
            setCheckedImport(new Set(p.cloud_only.map(c => c.cloud_id)));
            setCheckedPush(new Set(p.local_only.map(l => l.local_id)));
            const actions = {};
            p.cloud_deleted.forEach(d => { actions[d.local_id] = 'archive'; });
            setDeletedActions(actions);
            setPhase('review');
        })
            .catch(err => {
            if (cancelled)
                return;
            setErrorMsg(err instanceof Error ? err.message : String(err));
            setPhase('error');
        });
        return () => { cancelled = true; };
    }, []);
    const toggleMatch = (key) => setCheckedMatches(prev => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
    });
    const toggleImport = (cloudId) => setCheckedImport(prev => {
        const next = new Set(prev);
        next.has(cloudId) ? next.delete(cloudId) : next.add(cloudId);
        return next;
    });
    const togglePush = (localId) => setCheckedPush(prev => {
        const next = new Set(prev);
        next.has(localId) ? next.delete(localId) : next.add(localId);
        return next;
    });
    const setDeleteAction = (localId, action) => setDeletedActions(prev => ({ ...prev, [localId]: action }));
    const handleApply = async () => {
        if (!plan)
            return;
        setPhase('applying');
        const confirmed_matches = plan.match_suggestions
            .filter(s => checkedMatches.has(`${s.local_id}:${s.cloud_id}`))
            .map(s => ({ local_id: s.local_id, cloud_id: s.cloud_id }));
        const deleted_actions = plan.cloud_deleted.map(d => ({
            local_id: d.local_id,
            action: deletedActions[d.local_id] ?? 'archive',
        }));
        const body = {
            confirmed_matches,
            import_from_cloud: Array.from(checkedImport),
            push_to_cloud: Array.from(checkedPush),
            deleted_actions,
        };
        try {
            const res = await api.filamentSyncApply(body);
            setResult(res);
            setPhase('done');
        }
        catch (err) {
            setErrorMsg(err instanceof Error ? err.message : String(err));
            setPhase('error');
        }
    };
    const showImport = syncMode === 'pull' || syncMode === 'bidirectional';
    const showPush = syncMode === 'push' || syncMode === 'bidirectional';
    const hasAnything = (plan?.match_suggestions.length ?? 0) > 0 ||
        (showImport && (plan?.cloud_only.length ?? 0) > 0) ||
        (showPush && (plan?.local_only.length ?? 0) > 0) ||
        (showImport && (plan?.cloud_deleted.length ?? 0) > 0);
    return (_jsx(Modal, { children: _jsxs("div", { className: "flex flex-col", style: { maxHeight: '85vh', width: 'min(680px, 96vw)' }, children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h2", { className: "text-base font-semibold text-gray-100", children: t('settings.filamentSync.modal.title') }), _jsx("span", { className: "text-[10px] px-2 py-0.5 rounded bg-blue-900/40 border border-blue-700 text-blue-400 capitalize", children: t(`settings.filamentSync.mode_${syncMode}`) })] }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-200 transition-colors", children: _jsx(X, { size: 18 }) })] }), _jsxs("div", { className: "overflow-y-auto flex-1 px-5 py-4 space-y-3", children: [phase === 'loading' && (_jsxs("div", { className: "flex items-center gap-3 py-8 justify-center text-gray-400", children: [_jsx(RefreshCw, { size: 18, className: "animate-spin" }), _jsx("span", { className: "text-sm", children: t('settings.filamentSync.modal.loading') })] })), phase === 'error' && (_jsxs("div", { className: "flex items-start gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2", children: [_jsx(AlertCircle, { size: 14, className: "mt-0.5 shrink-0" }), _jsx("span", { children: errorMsg })] })), phase === 'done' && result && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-start gap-2 text-sm text-green-400 bg-green-900/20 border border-green-800 rounded px-3 py-2", children: [_jsx(CheckCircle, { size: 14, className: "mt-0.5 shrink-0" }), _jsx("span", { children: t('settings.filamentSync.modal.result', {
                                                matched: result.matched,
                                                imported: result.imported,
                                                pushed: result.pushed,
                                                archived: result.archived,
                                                deleted: result.deleted,
                                                errors: result.errors,
                                            }) })] }), result.errors > 0 && (_jsx("p", { className: "text-xs text-yellow-400", children: t('settings.filamentSync.modal.resultErrors', { n: result.errors }) }))] })), (phase === 'review' || phase === 'applying') && plan && (_jsxs(_Fragment, { children: [plan.already_linked_count > 0 && (_jsx(Section, { title: t('settings.filamentSync.modal.alreadyLinked'), count: plan.already_linked_count, defaultOpen: false, children: _jsx("p", { className: "text-xs text-gray-400", children: t('settings.filamentSync.modal.alreadyLinkedDesc', {
                                            n: plan.already_linked_count,
                                        }) }) })), plan.match_suggestions.length > 0 && (_jsxs(Section, { title: t('settings.filamentSync.modal.suggestions'), count: plan.match_suggestions.length, children: [_jsx("p", { className: "text-xs text-gray-500 mb-2", children: t('settings.filamentSync.modal.suggestionsHint') }), _jsx("div", { className: "space-y-2", children: plan.match_suggestions.map(s => {
                                                const key = `${s.local_id}:${s.cloud_id}`;
                                                const checked = checkedMatches.has(key);
                                                return (_jsxs("label", { className: `flex items-center gap-3 p-2.5 rounded cursor-pointer border transition-colors
                            ${checked
                                                        ? 'bg-blue-900/20 border-blue-700'
                                                        : 'bg-surface-2 border-gray-700 hover:border-gray-500'}`, children: [_jsx("input", { type: "checkbox", className: "accent-blue-500 shrink-0", checked: checked, onChange: () => toggleMatch(key), disabled: phase === 'applying' }), _jsxs("div", { className: "flex items-center gap-1.5 min-w-0 flex-1", children: [_jsx(ColorDot, { hex: s.local_color_hex }), _jsx("span", { className: "text-xs text-gray-200 truncate", children: s.local_summary })] }), _jsx("span", { className: "text-gray-500 text-xs shrink-0", children: "\u2194" }), _jsxs("div", { className: "flex items-center gap-1.5 min-w-0 flex-1", children: [_jsx(ColorDot, { hex: s.cloud_color_hex }), _jsx("span", { className: "text-xs text-gray-200 truncate", children: s.cloud_summary })] }), _jsx(ConfidenceBadge, { score: s.confidence })] }, key));
                                            }) })] })), showImport && plan.cloud_only.length > 0 && (_jsxs(Section, { title: t('settings.filamentSync.modal.newFromCloud'), count: plan.cloud_only.length, children: [_jsx("p", { className: "text-xs text-gray-500 mb-2", children: t('settings.filamentSync.modal.newFromCloudHint') }), _jsx("div", { className: "space-y-1.5", children: plan.cloud_only.map(c => (_jsxs("label", { className: `flex items-center gap-3 p-2.5 rounded cursor-pointer border transition-colors
                          ${checkedImport.has(c.cloud_id)
                                                    ? 'bg-green-900/20 border-green-800'
                                                    : 'bg-surface-2 border-gray-700 hover:border-gray-500'}`, children: [_jsx("input", { type: "checkbox", className: "accent-green-500 shrink-0", checked: checkedImport.has(c.cloud_id), onChange: () => toggleImport(c.cloud_id), disabled: phase === 'applying' }), _jsx(ColorDot, { hex: c.color_hex }), _jsx("span", { className: "text-xs text-gray-200 flex-1 truncate", children: c.cloud_summary }), _jsxs("span", { className: "text-xs text-gray-500 shrink-0", children: [c.filament_type, " \u00B7 ", c.current_weight_g, "g"] })] }, c.cloud_id))) })] })), showPush && plan.local_only.length > 0 && (_jsxs(Section, { title: t('settings.filamentSync.modal.pushToCloud'), count: plan.local_only.length, children: [_jsx("p", { className: "text-xs text-gray-500 mb-2", children: t('settings.filamentSync.modal.pushToCloudHint') }), _jsx("div", { className: "space-y-1.5", children: plan.local_only.map(l => (_jsxs("label", { className: `flex items-center gap-3 p-2.5 rounded cursor-pointer border transition-colors
                          ${checkedPush.has(l.local_id)
                                                    ? 'bg-blue-900/20 border-blue-700'
                                                    : 'bg-surface-2 border-gray-700 hover:border-gray-500'}`, children: [_jsx("input", { type: "checkbox", className: "accent-blue-500 shrink-0", checked: checkedPush.has(l.local_id), onChange: () => togglePush(l.local_id), disabled: phase === 'applying' }), _jsx(ColorDot, { hex: l.color_hex }), _jsx("span", { className: "text-xs text-gray-200 flex-1 truncate", children: l.local_summary })] }, l.local_id))) })] })), showImport && plan.cloud_deleted.length > 0 && (_jsxs(Section, { title: t('settings.filamentSync.modal.deletedFromCloud'), count: plan.cloud_deleted.length, children: [_jsx("p", { className: "text-xs text-gray-500 mb-2", children: t('settings.filamentSync.modal.deletedFromCloudHint') }), _jsx("div", { className: "space-y-2", children: plan.cloud_deleted.map((d) => (_jsxs("div", { className: "flex items-center gap-3 p-2.5 rounded bg-surface-2 border border-yellow-800/50", children: [_jsx("span", { className: "text-xs text-gray-200 flex-1 truncate", children: d.local_summary }), _jsx("div", { className: "flex gap-1 shrink-0", children: ['archive', 'keep', 'delete'].map(action => (_jsx("button", { onClick: () => setDeleteAction(d.local_id, action), disabled: phase === 'applying', className: `px-2 py-1 rounded text-[10px] border transition-colors
                                ${deletedActions[d.local_id] === action
                                                                ? action === 'delete'
                                                                    ? 'bg-red-700 border-red-600 text-white'
                                                                    : 'bg-blue-600 border-blue-500 text-white'
                                                                : 'bg-surface-1 border-gray-600 text-gray-400 hover:border-gray-400'}`, children: t(`settings.filamentSync.modal.action_${action}`) }, action))) })] }, d.local_id))) })] })), !hasAnything && (_jsx("div", { className: "py-8 text-center text-sm text-gray-500", children: t('settings.filamentSync.modal.nothingToDo') }))] }))] }), _jsx("div", { className: "flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-700 shrink-0", children: phase === 'done' || phase === 'error' ? (_jsx("button", { onClick: onClose, className: "btn-primary text-sm", children: t('common.close') })) : (_jsxs(_Fragment, { children: [_jsx("button", { onClick: onClose, disabled: phase === 'applying', className: "btn-ghost text-sm", children: t('common.cancel') }), _jsxs("button", { onClick: handleApply, disabled: phase !== 'review' || !plan, className: "btn-primary flex items-center gap-1.5 text-sm", children: [phase === 'applying' && _jsx(RefreshCw, { size: 13, className: "animate-spin" }), t('settings.filamentSync.modal.apply')] })] })) })] }) }));
}
