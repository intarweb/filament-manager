import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Layers, Printer, Settings, FolderOpen, ChevronLeft, ChevronRight, Menu, X, Globe, } from 'lucide-react';
import { api } from '../api';
function AppIcon({ size = 24 }) {
    return (_jsx("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "currentColor", children: _jsx("path", { d: "M20 6h-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h3v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2h3a1 1 0 0 0 1-1V8a2 2 0 0 0-2-2M10 4h4v2h-4zm-2 16v-5h8v5zm10-7H6v-1h12zm0-3H6V8h12z" }) }));
}
const LANGUAGES = [
    { code: 'en', label: 'EN' },
    { code: 'de', label: 'DE' },
    { code: 'es', label: 'ES' },
];
function LanguageSwitcher({ collapsed }) {
    const { i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const current = LANGUAGES.find(l => l.code === i18n.resolvedLanguage) ?? LANGUAGES[0];
    return (_jsxs("div", { className: "relative", children: [_jsxs("button", { onClick: () => setOpen(o => !o), title: "Language", className: `flex items-center gap-1.5 text-gray-400 hover:text-white hover:bg-surface-3 rounded-lg transition-colors
          ${collapsed ? 'justify-center px-2 py-2' : 'px-2.5 py-1.5'}`, children: [_jsx(Globe, { size: 14, className: "shrink-0" }), !collapsed && _jsx("span", { className: "text-xs font-medium", children: current.label })] }), open && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-40", onClick: () => setOpen(false) }), _jsx("div", { className: "absolute bottom-full left-0 mb-1 z-50 bg-surface-2 border border-surface-3 rounded-lg shadow-xl overflow-hidden min-w-[80px]", children: LANGUAGES.map(lang => (_jsx("button", { onClick: () => { i18n.changeLanguage(lang.code); setOpen(false); }, className: `w-full text-left px-3 py-1.5 text-xs transition-colors
                  ${i18n.resolvedLanguage === lang.code
                                ? 'bg-accent text-white'
                                : 'text-gray-300 hover:bg-surface-3 hover:text-white'}`, children: lang.label }, lang.code))) })] }))] }));
}
function ChangelogModal({ version, onClose }) {
    const { data, isLoading } = useQuery({
        queryKey: ['changelog'],
        queryFn: api.getChangelog,
        staleTime: Infinity,
    });
    const sections = data?.changelog
        ? data.changelog.split(/^## /m).filter(Boolean).map((block) => {
            const [heading, ...rest] = block.split('\n');
            return { heading: heading.trim(), body: rest.join('\n').trim() };
        })
        : [];
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", children: [_jsx("div", { className: "absolute inset-0 bg-black/60", onClick: onClose }), _jsxs("div", { className: "relative bg-surface-2 border border-surface-3 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-surface-3 shrink-0", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-white", children: "Changelog" }), _jsxs("p", { className: "text-xs text-gray-500", children: ["v", version] })] }), _jsx("button", { className: "p-1.5 text-gray-400 hover:text-white hover:bg-surface-3 rounded-lg transition-colors", onClick: onClose, children: _jsx(X, { size: 16 }) })] }), _jsxs("div", { className: "overflow-y-auto p-5 space-y-5 text-sm", children: [isLoading && _jsx("p", { className: "text-xs text-gray-500", children: "Loading\u2026" }), !isLoading && sections.length === 0 && _jsx("p", { className: "text-xs text-gray-500", children: "No changelog available." }), sections.map(({ heading, body }) => (_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-accent mb-2", children: heading }), _jsx("ul", { className: "space-y-1", children: body.split('\n').filter((l) => l.trim().startsWith('-')).map((line, i) => (_jsxs("li", { className: "text-gray-300 text-xs flex gap-2", children: [_jsx("span", { className: "text-gray-500 shrink-0", children: "\u00B7" }), _jsx("span", { children: line.replace(/^-\s*(?:New:|Fix:|New\s|Fix\s)?/, '') })] }, i))) })] }, heading)))] })] })] }));
}
function VersionButton({ collapsed }) {
    const [open, setOpen] = useState(false);
    const { data } = useQuery({
        queryKey: ['version'],
        queryFn: api.getVersion,
        staleTime: Infinity,
    });
    const version = data?.version ?? '…';
    return (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => setOpen(true), title: `v${version} — view changelog`, className: `flex items-center gap-1.5 text-gray-500 hover:text-gray-300 hover:bg-surface-3 rounded-lg transition-colors text-xs
          ${collapsed ? 'justify-center px-2 py-2' : 'px-2.5 py-1.5'}`, children: collapsed ? _jsx("span", { className: "font-mono text-[10px]", children: "v" }) : _jsxs("span", { children: ["v", version] }) }), open && _jsx(ChangelogModal, { version: version, onClose: () => setOpen(false) })] }));
}
export default function Layout({ children }) {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const location = useLocation();
    const nav = [
        { to: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
        { to: '/spools', icon: Layers, label: t('nav.spools') },
        { to: '/prints', icon: Printer, label: t('nav.prints') },
        { to: '/projects', icon: FolderOpen, label: t('nav.projects') },
        { to: '/settings', icon: Settings, label: t('nav.settings') },
    ];
    useEffect(() => {
        setDrawerOpen(false);
    }, [location.pathname]);
    return (_jsxs("div", { className: "flex h-screen overflow-hidden bg-surface text-gray-100", children: [_jsxs("aside", { style: { width: collapsed ? 56 : 208 }, className: "hidden md:flex flex-col shrink-0 bg-surface-2 border-r border-surface-3 transition-all duration-200", children: [_jsx("div", { className: `border-b border-surface-3 py-4 flex items-center
                         ${collapsed ? 'justify-center px-2' : 'px-4 gap-2'}`, children: collapsed ? (_jsx("span", { className: "text-accent", title: t('nav.appName'), children: _jsx(AppIcon, { size: 22 }) })) : (_jsxs("div", { className: "flex items-center gap-2 flex-1 min-w-0", children: [_jsx("span", { className: "text-accent shrink-0", children: _jsx(AppIcon, { size: 20 }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-bold text-white leading-tight truncate", children: t('nav.appName') }), _jsx("p", { className: "text-xs text-gray-500", children: t('nav.appSub') })] })] })) }), _jsx("nav", { className: "flex-1 p-2 space-y-0.5 overflow-y-auto", children: nav.map(({ to, icon: Icon, label }) => (_jsxs(NavLink, { to: to, title: collapsed ? label : undefined, className: ({ isActive }) => `flex items-center gap-3 rounded-lg text-sm transition-colors
                 ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                 ${isActive
                                ? 'bg-accent text-white'
                                : 'text-gray-400 hover:text-white hover:bg-surface-3'}`, children: [_jsx(Icon, { size: 16, className: "shrink-0" }), !collapsed && _jsx("span", { children: label })] }, to))) }), _jsxs("div", { className: `border-t border-surface-3 px-2 py-2 flex ${collapsed ? 'flex-col items-center gap-1' : 'items-center justify-between'}`, children: [_jsx(LanguageSwitcher, { collapsed: collapsed }), _jsx(VersionButton, { collapsed: collapsed })] }), _jsx("button", { className: "flex items-center justify-center py-3 border-t border-surface-3\n                     text-gray-500 hover:text-white hover:bg-surface-3 transition-colors shrink-0", onClick: () => setCollapsed(c => !c), title: collapsed ? 'Expand sidebar' : 'Collapse sidebar', children: collapsed ? _jsx(ChevronRight, { size: 16 }) : _jsx(ChevronLeft, { size: 16 }) })] }), drawerOpen && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-40 bg-black/60", onClick: () => setDrawerOpen(false) }), _jsxs("aside", { className: "fixed inset-y-0 left-0 z-50 flex flex-col w-64\n                            bg-surface-2 border-r border-surface-3 shadow-xl", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b border-surface-3 shrink-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-accent shrink-0", children: _jsx(AppIcon, { size: 20 }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-bold text-white leading-tight", children: t('nav.appName') }), _jsx("p", { className: "text-xs text-gray-500", children: t('nav.appSub') })] })] }), _jsx("button", { className: "p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-3 transition-colors", onClick: () => setDrawerOpen(false), children: _jsx(X, { size: 18 }) })] }), _jsx("nav", { className: "flex-1 p-2 space-y-0.5 overflow-y-auto", children: nav.map(({ to, icon: Icon, label }) => (_jsxs(NavLink, { to: to, onClick: () => setDrawerOpen(false), className: ({ isActive }) => `flex items-center gap-3 rounded-lg text-sm px-3 py-2.5 transition-colors
                     ${isActive
                                        ? 'bg-accent text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-surface-3'}`, children: [_jsx(Icon, { size: 16, className: "shrink-0" }), _jsx("span", { children: label })] }, to))) }), _jsxs("div", { className: "border-t border-surface-3 px-3 py-2 flex items-center justify-between", children: [_jsx(LanguageSwitcher, {}), _jsx(VersionButton, {})] })] })] })), _jsxs("div", { className: "flex-1 flex flex-col min-w-0 overflow-hidden", children: [_jsxs("header", { className: "flex items-center gap-3 px-4 py-3\n                           bg-surface-2 border-b border-surface-3 shrink-0 md:hidden", children: [_jsx("button", { className: "p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-surface-3 transition-colors", onClick: () => setDrawerOpen(true), "aria-label": "Open menu", children: _jsx(Menu, { size: 20 }) }), _jsx("p", { className: "text-sm font-bold text-white", children: t('nav.appName') })] }), _jsx("main", { className: "flex-1 overflow-y-auto p-4 md:p-6", children: children })] })] }));
}
