import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Wifi, WifiOff, LogOut } from 'lucide-react';
import { api } from '../api';
export default function BambuCloudSection() {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const [step, setStep] = useState('form');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const { data: cloudStatus, refetch: refetchStatus } = useQuery({
        queryKey: ['bambu-cloud-status'],
        queryFn: api.getBambuCloudStatus,
        refetchInterval: 5000,
    });
    const { data: devices = [] } = useQuery({
        queryKey: ['bambu-cloud-devices'],
        queryFn: api.getBambuCloudDevices,
        enabled: cloudStatus?.status === 'connected',
    });
    const isConnected = cloudStatus?.status === 'connected';
    const isPending2fa = cloudStatus?.status === 'pending_2fa' || step === '2fa';
    // When backend auto-triggers 2FA (expired token refresh), show the code form
    useEffect(() => {
        if (cloudStatus?.status === 'pending_2fa' && step === 'form') {
            setStep('2fa');
        }
    }, [cloudStatus?.status]);
    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const res = await api.bambuCloudLogin(email, password, 'us');
            if (res.requires_2fa) {
                setStep('2fa');
                refetchStatus();
            }
            else {
                refetchStatus();
                qc.invalidateQueries({ queryKey: ['bambu-cloud-devices'] });
                qc.invalidateQueries({ queryKey: ['printers'] });
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setBusy(false);
        }
    };
    const handleVerify = async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            await api.bambuCloudVerify(code);
            setStep('form');
            setCode('');
            refetchStatus();
            qc.invalidateQueries({ queryKey: ['bambu-cloud-devices'] });
            qc.invalidateQueries({ queryKey: ['printers'] });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setBusy(false);
        }
    };
    const handleLogout = async () => {
        setBusy(true);
        try {
            await api.bambuCloudLogout();
            setStep('form');
            setEmail('');
            setPassword('');
            refetchStatus();
            qc.invalidateQueries({ queryKey: ['bambu-cloud-devices'] });
            qc.invalidateQueries({ queryKey: ['printers'] });
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { children: [isConnected && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm text-green-400", children: [_jsx(Wifi, { size: 15 }), _jsx("span", { children: t('settings.bambuCloud.connectedAs', { email: cloudStatus?.email }) })] }), _jsxs("button", { onClick: handleLogout, disabled: busy, className: "btn-ghost flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300", children: [_jsx(LogOut, { size: 13 }), t('settings.bambuCloud.disconnect')] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium text-gray-400 mb-2", children: t('settings.bambuCloud.devices') }), devices.length === 0 ? (_jsx("p", { className: "text-xs text-gray-500", children: t('settings.bambuCloud.noDevices') })) : (_jsx("div", { className: "space-y-1.5", children: devices.map(d => (_jsxs("div", { className: "flex items-center gap-2 text-xs text-gray-300 bg-surface-2 rounded px-3 py-2", children: [_jsx("span", { className: `w-1.5 h-1.5 rounded-full shrink-0 ${d.online ? 'bg-green-400' : 'bg-gray-600'}` }), _jsx("span", { className: "font-medium", children: d.name }), _jsx("span", { className: "text-gray-500", children: d.model }), _jsxs("span", { className: "ml-auto text-gray-600 font-mono text-[10px]", children: ['•'.repeat(8), d.serial.slice(-4)] })] }, d.serial))) }))] }), _jsx("p", { className: "text-[11px] text-gray-600", children: t('settings.bambuCloud.securityNote') })] })), !isConnected && !isPending2fa && cloudStatus?.error && (_jsxs("div", { className: "flex items-start gap-2 text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded px-3 py-2 mb-3", children: [_jsx(AlertCircle, { size: 13, className: "mt-0.5 shrink-0" }), _jsx("span", { children: cloudStatus.error })] })), !isConnected && isPending2fa && (_jsxs("form", { onSubmit: handleVerify, className: "space-y-3", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs text-yellow-400 mb-1", children: [_jsx(AlertCircle, { size: 14 }), _jsx("span", { children: t('settings.bambuCloud.twoFaPrompt') })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: t('settings.bambuCloud.twoFaCode') }), _jsx("input", { className: "input font-mono tracking-widest text-center text-lg", value: code, onChange: e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6)), placeholder: "000000", maxLength: 6, required: true, autoFocus: true })] }), error && (_jsxs("div", { className: "flex items-start gap-2 text-xs text-red-400", children: [_jsx(AlertCircle, { size: 13, className: "mt-0.5 shrink-0" }), _jsx("span", { children: t('settings.bambuCloud.errorVerify', { error }) })] })), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", disabled: busy || code.length !== 6, className: "btn-primary", children: busy ? t('settings.bambuCloud.verifying') : t('settings.bambuCloud.verify') }), _jsx("button", { type: "button", onClick: async () => {
                                    setStep('form');
                                    setError(null);
                                    setCode('');
                                    await api.bambuCloudCancel2fa();
                                    refetchStatus();
                                }, className: "btn-ghost", children: t('common.cancel') })] })] })), !isConnected && !isPending2fa && (_jsxs("form", { onSubmit: handleLogin, className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "label", children: t('settings.bambuCloud.email') }), _jsx("input", { type: "email", className: "input", value: email, onChange: e => setEmail(e.target.value), required: true, autoComplete: "email" })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: t('settings.bambuCloud.password') }), _jsx("input", { type: "password", className: "input", value: password, onChange: e => setPassword(e.target.value), required: true, autoComplete: "current-password" })] }), error && (_jsxs("div", { className: "flex items-start gap-2 text-xs text-red-400", children: [_jsx(AlertCircle, { size: 13, className: "mt-0.5 shrink-0" }), _jsx("span", { children: t('settings.bambuCloud.errorConnect', { error }) })] })), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("button", { type: "submit", disabled: busy, className: "btn-primary flex items-center gap-2", children: [_jsx(WifiOff, { size: 13 }), busy ? t('settings.bambuCloud.connecting') : t('settings.bambuCloud.connect')] }), _jsx("p", { className: "text-[11px] text-gray-600", children: t('settings.bambuCloud.securityNote') })] })] }))] }));
}
