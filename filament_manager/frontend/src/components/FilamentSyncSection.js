import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Ban } from 'lucide-react';
import { api } from '../api';
import SyncReviewModal from './SyncReviewModal';
const MODES = [
    { value: 'off', icon: _jsx(Ban, { size: 12 }) },
    { value: 'pull', icon: _jsx(ArrowDownToLine, { size: 12 }) },
    { value: 'push', icon: _jsx(ArrowUpFromLine, { size: 12 }) },
    { value: 'bidirectional', icon: _jsx(ArrowLeftRight, { size: 12 }) },
];
export default function FilamentSyncSection({ isCloudConnected }) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    const { data: syncStatus, isLoading } = useQuery({
        queryKey: ['filament-sync-status'],
        queryFn: api.getFilamentSyncStatus,
        refetchInterval: 30000,
    });
    const settingsMut = useMutation({
        mutationFn: api.patchFilamentSyncSettings,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['filament-sync-status'] }),
    });
    if (isLoading || !syncStatus)
        return null;
    if (!isCloudConnected) {
        return _jsx("p", { className: "text-xs text-yellow-500", children: t('settings.filamentSync.requiresCloud') });
    }
    const currentMode = syncStatus.sync_mode ?? 'off';
    const busy = settingsMut.isPending;
    return (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-xs text-gray-500", children: t('settings.filamentSync.hint') }), _jsxs("div", { children: [_jsx("label", { className: "label mb-1", children: t('settings.filamentSync.syncMode') }), _jsx("div", { className: "flex gap-2 flex-wrap", children: MODES.map(({ value, icon }) => (_jsxs("button", { onClick: () => settingsMut.mutate({ sync_mode: value }), disabled: busy, className: `flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors
                ${currentMode === value
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-surface-2 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200'}`, children: [busy && currentMode !== value ? null : icon, t(`settings.filamentSync.mode_${value}`)] }, value))) }), _jsx("p", { className: "text-xs text-gray-500 mt-1.5", children: t(`settings.filamentSync.modeHint_${currentMode}`) })] }), currentMode !== 'off' && (_jsxs("div", { className: "flex flex-wrap gap-4 text-xs text-gray-400", children: [_jsx("span", { children: t('settings.filamentSync.linked', {
                            n: syncStatus.linked_spools,
                            total: syncStatus.total_spools,
                        }) }), syncStatus.last_sync_at && (_jsx("span", { children: t('settings.filamentSync.lastSync', {
                            date: new Date(syncStatus.last_sync_at).toLocaleString(),
                        }) }))] })), currentMode !== 'off' && (_jsxs("button", { onClick: () => setShowModal(true), className: "btn-primary flex items-center gap-1.5 text-xs", children: [_jsx(RefreshCw, { size: 13 }), t('settings.filamentSync.syncNow')] })), showModal && (_jsx(SyncReviewModal, { syncMode: currentMode, onClose: () => {
                    setShowModal(false);
                    qc.invalidateQueries({ queryKey: ['filament-sync-status'] });
                    qc.invalidateQueries({ queryKey: ['spools'] });
                } }))] }));
}
