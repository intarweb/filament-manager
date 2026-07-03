import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { Plus, Pencil, Trash2, X, FolderOpen, ChevronDown, ChevronRight, Layers, FlaskConical, ExternalLink } from 'lucide-react';
import { useHATZ } from '../hooks/useHATZ';
import { formatDateTimeTZ } from '../utils/time';
// ── Inline modal shell (matches Prints.tsx pattern) ───────────────────────────
function ModalShell({ title, onClose, wide, children }) {
    return (_jsx("div", { className: "fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4", children: _jsxs("div", { className: `bg-surface-2 border border-surface-3 rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`, children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-surface-3", children: [_jsx("h2", { className: "font-semibold", children: title }), _jsx("button", { onClick: onClose, className: "btn-ghost p-1", children: _jsx(X, { size: 16 }) })] }), _jsx("div", { className: "p-5", children: children })] }) }));
}
// ── Project Form ──────────────────────────────────────────────────────────────
function ProjectForm({ initial, onSave, onCancel, }) {
    const { t } = useTranslation();
    const [name, setName] = useState(initial?.name ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [url, setUrl] = useState(initial?.url ?? '');
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "label", children: [t('projects.name'), " *"] }), _jsx("input", { className: "input", value: name, onChange: e => setName(e.target.value), placeholder: t('projects.namePlaceholder'), autoFocus: true })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: t('projects.description') }), _jsx("textarea", { className: "input h-20 resize-none", value: description, onChange: e => setDescription(e.target.value), placeholder: t('projects.descriptionPlaceholder') })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: t('projects.url') }), _jsx("input", { className: "input", type: "url", value: url, onChange: e => setUrl(e.target.value), placeholder: t('projects.urlPlaceholder') })] }), _jsxs("div", { className: "flex justify-end gap-2 pt-2", children: [_jsx("button", { className: "btn-ghost px-4 py-2", onClick: onCancel, children: t('common.cancel') }), _jsx("button", { className: "btn-primary px-4 py-2", disabled: !name.trim(), onClick: () => onSave({ name: name.trim(), description: description.trim() || null, url: url.trim() || null }), children: t('common.save') })] })] }));
}
// ── Assign prints modal ───────────────────────────────────────────────────────
function AssignPrintsModal({ project, onClose, }) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const tz = useHATZ();
    const assignedIds = new Set(project.print_jobs.map(j => j.id));
    const { data: allPrints = [] } = useQuery({
        queryKey: ['prints', 1000, 0],
        queryFn: () => api.getPrints(1000, 0),
    });
    const eligible = allPrints.filter(j => !j.fm_project_id || j.fm_project_id === project.id);
    const [selected, setSelected] = useState(new Set(assignedIds));
    const assignMut = useMutation({
        mutationFn: async () => {
            const toAssign = [...selected].filter(id => !assignedIds.has(id));
            const toUnassign = [...assignedIds].filter(id => !selected.has(id));
            let latest;
            if (toAssign.length > 0)
                latest = await api.assignPrintsToProject(project.id, toAssign);
            if (toUnassign.length > 0)
                latest = await api.unassignPrintsFromProject(project.id, toUnassign);
            return latest;
        },
        onSuccess: (latest) => {
            // Immediately patch the project in the list cache with the fresh server data
            // so the card stats update without waiting for a background refetch
            if (latest) {
                qc.setQueryData(['projects'], old => old ? old.map(p => p.id === latest.id ? latest : p) : old);
            }
            qc.invalidateQueries({ queryKey: ['projects'] });
            qc.invalidateQueries({ queryKey: ['prints'] });
            onClose();
        },
    });
    const toggle = (id) => setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id))
            next.delete(id);
        else
            next.add(id);
        return next;
    });
    return (_jsx(ModalShell, { title: t('projects.assignPrints', { name: project.name }), onClose: onClose, wide: true, children: _jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-xs text-gray-400", children: t('projects.assignHint') }), _jsxs("div", { className: "max-h-96 overflow-y-auto space-y-1", children: [eligible.length === 0 && (_jsx("p", { className: "text-sm text-gray-500 py-4 text-center", children: t('common.noData') })), eligible.map(job => (_jsxs("label", { className: "flex items-center gap-3 p-2 rounded hover:bg-surface-3 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: selected.has(job.id), onChange: () => toggle(job.id), className: "w-4 h-4 accent-accent" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm text-white truncate", children: job.name }), job.success
                                                    ? _jsx("span", { className: "text-xs text-green-400", children: "\u2713" })
                                                    : _jsx("span", { className: "text-xs text-red-400", children: "\u2717" })] }), _jsxs("div", { className: "text-xs text-gray-400", children: [formatDateTimeTZ(job.started_at, tz), job.printer_name && ` · ${job.printer_name}`, job.total_grams > 0 && ` · ${job.total_grams.toFixed(1)}g`] })] })] }, job.id)))] }), _jsxs("div", { className: "flex justify-between items-center pt-2", children: [_jsxs("span", { className: "text-xs text-gray-400", children: [selected.size, " ", t('projects.selected')] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: "btn-ghost px-4 py-2", onClick: onClose, children: t('common.cancel') }), _jsx("button", { className: "btn-primary px-4 py-2", onClick: () => assignMut.mutate(), disabled: assignMut.isPending, children: t('common.save') })] })] })] }) }));
}
// ── Project Card ──────────────────────────────────────────────────────────────
function ProjectCard({ project, onEdit, onDelete, onManagePrints, }) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const { data: detail } = useQuery({
        queryKey: ['projects', project.id],
        queryFn: () => api.getProject(project.id),
        enabled: expanded,
    });
    const durationH = project.total_duration_seconds > 0
        ? (project.total_duration_seconds / 3600).toFixed(1)
        : null;
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "flex items-center gap-3 cursor-pointer", onClick: () => setExpanded(e => !e), children: [_jsx("span", { className: "text-accent shrink-0", children: expanded ? _jsx(ChevronDown, { size: 16 }) : _jsx(ChevronRight, { size: 16 }) }), _jsx(FolderOpen, { size: 16, className: "text-accent shrink-0" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-semibold text-white truncate", children: project.name }), _jsxs("span", { className: "text-xs text-gray-500 shrink-0", children: [project.print_count, " ", t('projects.prints')] }), project.test_print_count > 0 && (_jsxs("span", { className: "text-xs text-amber-500 shrink-0 flex items-center gap-0.5", children: [_jsx(FlaskConical, { size: 11 }), project.test_print_count] })), project.url && (_jsx("a", { href: project.url, target: "_blank", rel: "noopener noreferrer", onClick: e => e.stopPropagation(), className: "text-gray-500 hover:text-blue-400 shrink-0", title: project.url, children: _jsx(ExternalLink, { size: 11 }) }))] }), project.description && (_jsx("p", { className: "text-xs text-gray-400 truncate", children: project.description }))] }), _jsxs("div", { className: "hidden sm:flex items-center gap-4 text-xs text-gray-400 shrink-0", children: [project.total_grams > 0 && (_jsxs("span", { children: [(project.total_grams / 1000).toFixed(2), " ", t('common.kg')] })), project.total_cost > 0 && (_jsxs("span", { children: ["\u20AC", project.total_cost.toFixed(2)] })), project.total_energy_kwh != null && (_jsxs("span", { children: [project.total_energy_kwh.toFixed(2), " kWh", project.total_energy_cost != null && _jsxs(_Fragment, { children: [" \u00B7 \u20AC", project.total_energy_cost.toFixed(2)] })] })), durationH && _jsxs("span", { children: [durationH, "h"] })] }), _jsxs("div", { className: "flex items-center gap-1 shrink-0", onClick: e => e.stopPropagation(), children: [_jsx("button", { className: "btn-ghost p-1.5", onClick: onManagePrints, title: t('projects.managePrints'), children: _jsx(Layers, { size: 14 }) }), _jsx("button", { className: "btn-ghost p-1.5", onClick: onEdit, title: t('common.edit'), children: _jsx(Pencil, { size: 14 }) }), _jsx("button", { className: "btn-ghost p-1.5 text-red-400", onClick: onDelete, title: t('common.delete'), children: _jsx(Trash2, { size: 14 }) })] })] }), expanded && (_jsxs("div", { className: "mt-3 pt-3 border-t border-surface-3", children: [project.material_usage.length > 0 && (_jsx("div", { className: "flex items-center gap-3 flex-wrap mb-3 pb-2 border-b border-surface-3", children: project.material_usage.map((m, i) => (_jsxs("span", { className: "flex items-center gap-1 text-xs", children: [_jsx("span", { className: "w-2 h-2 rounded-full shrink-0 ring-1 ring-white/10", style: { background: m.color_hex } }), _jsx("span", { className: "text-gray-400", children: m.material }), _jsxs("span", { className: "text-gray-500", children: [m.grams.toFixed(0), "g"] })] }, i))) })), !detail && (_jsx("p", { className: "text-xs text-gray-500", children: t('common.loading') })), detail && detail.print_jobs.length === 0 && (_jsx("p", { className: "text-xs text-gray-500", children: t('projects.noPrints') })), detail && detail.print_jobs.map(job => (_jsx(PrintJobRow, { job: job, projectId: project.id }, job.id))), project.test_print_count > 0 && project.print_count > 0 && (() => {
                        const prodEnergyKwh = project.total_energy_kwh != null && project.test_total_energy_kwh != null
                            ? project.total_energy_kwh - project.test_total_energy_kwh : project.total_energy_kwh;
                        const prodEnergyCost = project.total_energy_cost != null && project.test_total_energy_cost != null
                            ? project.total_energy_cost - project.test_total_energy_cost : project.total_energy_cost;
                        return (_jsxs("div", { className: "mt-2 pt-2 border-t border-surface-3 flex gap-6 text-xs flex-wrap", children: [_jsxs("div", { children: [_jsxs("span", { className: "text-gray-500", children: [t('projects.normalStats'), ": "] }), _jsxs("span", { className: "text-gray-300", children: [project.print_count - project.test_print_count, " ", t('projects.prints'), ' · ', ((project.total_grams - project.test_total_grams) / 1000).toFixed(2), " ", t('common.kg'), ' · ', "\u20AC", (project.total_cost - project.test_total_cost).toFixed(2), prodEnergyKwh != null && _jsxs(_Fragment, { children: [' · ', prodEnergyKwh.toFixed(3), " kWh"] }), prodEnergyCost != null && _jsxs(_Fragment, { children: [' · ', "\u20AC", prodEnergyCost.toFixed(2)] })] })] }), _jsxs("div", { children: [_jsxs("span", { className: "text-amber-500 flex items-center gap-1 inline-flex", children: [_jsx(FlaskConical, { size: 11 }), t('projects.testStats'), ": "] }), _jsxs("span", { className: "text-gray-300", children: [project.test_print_count, " ", t('projects.prints'), ' · ', (project.test_total_grams / 1000).toFixed(2), " ", t('common.kg'), ' · ', "\u20AC", project.test_total_cost.toFixed(2), project.test_total_energy_kwh != null && _jsxs(_Fragment, { children: [' · ', project.test_total_energy_kwh.toFixed(3), " kWh"] }), project.test_total_energy_cost != null && _jsxs(_Fragment, { children: [' · ', "\u20AC", project.test_total_energy_cost.toFixed(2)] })] })] })] }));
                    })()] }))] }));
}
function PrintJobRow({ job, projectId }) {
    const { t } = useTranslation();
    const tz = useHATZ();
    const qc = useQueryClient();
    const toggleTestMut = useMutation({
        mutationFn: (isTest) => api.updateProjectPrint(projectId, job.id, { is_test_print: isTest }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['projects', projectId] });
            qc.invalidateQueries({ queryKey: ['projects'] });
        },
        onError: (err) => alert(err instanceof Error ? err.message : 'Failed to update test print flag'),
    });
    return (_jsxs("div", { className: "flex items-center gap-3 py-1.5 text-sm border-b border-surface-3 last:border-0", children: [_jsx("span", { className: job.success ? 'text-green-400' : 'text-red-400', children: job.success ? '✓' : '✗' }), _jsx("span", { className: "flex-1 truncate text-gray-200", children: job.name }), _jsx("span", { className: "text-xs text-gray-400 shrink-0", children: formatDateTimeTZ(job.started_at, tz) }), job.total_grams > 0 && (_jsxs("span", { className: "text-xs text-gray-400 shrink-0", children: [job.total_grams.toFixed(1), "g"] })), job.material_cost > 0 && (_jsxs("span", { className: "text-xs text-gray-400 shrink-0", children: ["\u20AC", job.material_cost.toFixed(2)] })), job.energy_kwh != null && (_jsxs("span", { className: "text-xs text-yellow-500 shrink-0", children: [job.energy_kwh.toFixed(2), " kWh", job.energy_cost != null && _jsxs(_Fragment, { children: [" \u00B7 \u20AC", job.energy_cost.toFixed(2)] })] })), job.total_cost > 0 && (_jsxs("span", { className: "text-xs text-white shrink-0 font-medium", children: ["= \u20AC", job.total_cost.toFixed(2)] })), job.nozzle_diameter && (_jsxs("span", { className: "text-xs text-blue-400 shrink-0", children: ["\u2300", job.nozzle_diameter] })), _jsx("button", { title: job.is_test_print ? t('projects.unmarkTestPrint') : t('projects.markTestPrint'), className: `shrink-0 p-1 rounded transition-colors ${job.is_test_print ? 'text-amber-400 bg-amber-400/10' : 'text-gray-600 hover:text-amber-400'}`, onClick: () => toggleTestMut.mutate(!job.is_test_print), disabled: toggleTestMut.isPending, children: _jsx(FlaskConical, { size: 13 }) })] }));
}
// ── Page ──────────────────────────────────────────────────────────────────────
export default function Projects() {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [managingPrints, setManagingPrints] = useState(null);
    const { data: projects = [], isLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: api.getProjects,
    });
    const { data: managingDetail } = useQuery({
        queryKey: ['projects', managingPrints?.id],
        queryFn: () => api.getProject(managingPrints.id),
        enabled: !!managingPrints,
    });
    const createMut = useMutation({
        mutationFn: (data) => api.createProject(data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setShowForm(false); },
    });
    const updateMut = useMutation({
        mutationFn: (data) => api.updateProject(editing.id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['projects'] });
            qc.invalidateQueries({ queryKey: ['prints'] });
            qc.invalidateQueries({ queryKey: ['prints-count'] });
            setEditing(null);
        },
    });
    const deleteMut = useMutation({
        mutationFn: () => api.deleteProject(deleting.id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['projects'] });
            qc.invalidateQueries({ queryKey: ['prints'] });
            qc.invalidateQueries({ queryKey: ['prints-count'] });
            setDeleting(null);
        },
    });
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-white", children: t('projects.title') }), _jsx("p", { className: "text-sm text-gray-400", children: t('projects.subtitle') })] }), _jsxs("button", { className: "btn-primary flex items-center gap-2 px-3 py-2", onClick: () => setShowForm(true), children: [_jsx(Plus, { size: 16 }), _jsx("span", { className: "hidden sm:inline", children: t('projects.new') })] })] }), isLoading && _jsx("p", { className: "text-sm text-gray-400", children: t('common.loading') }), !isLoading && projects.length === 0 && (_jsxs("div", { className: "card text-center py-12", children: [_jsx(FolderOpen, { size: 32, className: "mx-auto text-gray-600 mb-3" }), _jsx("p", { className: "text-gray-400", children: t('projects.empty') }), _jsx("button", { className: "mt-4 btn-primary px-4 py-2", onClick: () => setShowForm(true), children: t('projects.createFirst') })] })), projects.map(p => (_jsx(ProjectCard, { project: p, onEdit: () => setEditing(p), onDelete: () => setDeleting(p), onManagePrints: () => setManagingPrints(p) }, p.id))), showForm && (_jsx(ModalShell, { title: t('projects.newTitle'), onClose: () => setShowForm(false), children: _jsx(ProjectForm, { onSave: data => createMut.mutate(data), onCancel: () => setShowForm(false) }) })), editing && (_jsx(ModalShell, { title: t('projects.editTitle'), onClose: () => setEditing(null), children: _jsx(ProjectForm, { initial: editing, onSave: data => updateMut.mutate(data), onCancel: () => setEditing(null) }) })), deleting && (_jsxs(ModalShell, { title: t('projects.deleteTitle'), onClose: () => setDeleting(null), children: [_jsx("p", { className: "text-sm text-gray-300 mb-4", children: t('projects.deleteConfirm', { name: deleting.name }) }), _jsx("p", { className: "text-xs text-gray-400 mb-6", children: t('projects.deleteNote') }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { className: "btn-ghost px-4 py-2", onClick: () => setDeleting(null), children: t('common.cancel') }), _jsx("button", { className: "btn-danger px-4 py-2", onClick: () => deleteMut.mutate(), disabled: deleteMut.isPending, children: t('common.delete') })] })] })), managingPrints && managingDetail && (_jsx(AssignPrintsModal, { project: managingDetail, onClose: () => setManagingPrints(null) }))] }));
}
