import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Spools from './pages/Spools';
import Prints from './pages/Prints';
import Projects from './pages/Projects';
import Settings from './pages/Settings';
export default function App() {
    return (_jsx(Layout, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/dashboard", replace: true }) }), _jsx(Route, { path: "/dashboard", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "/spools", element: _jsx(Spools, {}) }), _jsx(Route, { path: "/prints", element: _jsx(Prints, {}) }), _jsx(Route, { path: "/projects", element: _jsx(Projects, {}) }), _jsx(Route, { path: "/settings", element: _jsx(Settings, {}) })] }) }));
}
