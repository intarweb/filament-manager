// Relative base — works correctly behind HA ingress
const BASE = 'api';
async function request(path, options) {
    const res = await fetch(`${BASE}/${path}`, {
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        ...options,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status}: ${text}`);
    }
    if (res.status === 204)
        return undefined;
    return res.json();
}
export const api = {
    // Spools
    getSpools: (includeArchived = false) => request(includeArchived ? 'spools?include_archived=true' : 'spools'),
    getSpool: (id) => request(`spools/${id}`),
    createSpool: (data) => request('spools', { method: 'POST', body: JSON.stringify(data) }),
    updateSpool: (id, data) => request(`spools/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteSpool: (id) => request(`spools/${id}`, { method: 'DELETE' }),
    archiveSpool: (id) => request(`spools/${id}/archive`, { method: 'POST' }),
    unarchiveSpool: (id) => request(`spools/${id}/unarchive`, { method: 'POST' }),
    getSpoolAudit: (id) => request(`spools/${id}/audit`),
    correctSpoolAudit: (spoolId, entryId) => request(`spools/${spoolId}/audit/${entryId}/correct`, { method: 'POST' }),
    getMaterials: () => request('spools/materials/list'),
    getSubtypes: () => request('spools/subtypes/list'),
    // Projects
    getProjects: () => request('projects'),
    getProject: (id) => request(`projects/${id}`),
    createProject: (data) => request('projects', { method: 'POST', body: JSON.stringify(data) }),
    updateProject: (id, data) => request(`projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteProject: (id) => request(`projects/${id}`, { method: 'DELETE' }),
    assignPrintsToProject: (projectId, jobIds) => request(`projects/${projectId}/assign`, { method: 'POST', body: JSON.stringify({ job_ids: jobIds }) }),
    unassignPrintsFromProject: (projectId, jobIds) => request(`projects/${projectId}/unassign`, { method: 'POST', body: JSON.stringify({ job_ids: jobIds }) }),
    updateProjectPrint: (projectId, printId, data) => request(`projects/${projectId}/prints/${printId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    // Prints
    getPrints: (limit = 50, offset = 0, search, dateFrom, dateTo, tz) => {
        const p = new URLSearchParams({ limit: String(limit), offset: String(offset) });
        if (search)
            p.set('search', search);
        if (dateFrom)
            p.set('date_from', dateFrom);
        if (dateTo)
            p.set('date_to', dateTo);
        if (tz)
            p.set('timezone', tz);
        return request(`prints?${p}`);
    },
    getPrintsTotal: (search, dateFrom, dateTo, tz) => {
        const p = new URLSearchParams();
        if (search)
            p.set('search', search);
        if (dateFrom)
            p.set('date_from', dateFrom);
        if (dateTo)
            p.set('date_to', dateTo);
        if (tz)
            p.set('timezone', tz);
        const qs = p.toString();
        return request(`prints/count${qs ? `?${qs}` : ''}`);
    },
    getPrint: (id) => request(`prints/${id}`),
    createPrint: (data) => request('prints', { method: 'POST', body: JSON.stringify(data) }),
    updatePrint: (id, data) => request(`prints/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deletePrint: (id) => request(`prints/${id}`, { method: 'DELETE' }),
    // Printers
    getPrinters: () => request('printers'),
    createPrinter: (data) => request('printers', { method: 'POST', body: JSON.stringify(data) }),
    updatePrinter: (id, data) => request(`printers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deletePrinter: (id) => request(`printers/${id}`, { method: 'DELETE' }),
    getPrinterStatus: (id) => request(`printers/${id}/status`),
    getPrinterAMS: (id) => request(`printers/${id}/ams`),
    assignAMSTray: (printerId, slotKey, spoolId) => request(`printers/${printerId}/ams/${slotKey}/assign`, {
        method: 'POST',
        body: JSON.stringify({ spool_id: spoolId }),
    }),
    syncAMSWeights: (printerId) => request(`printers/${printerId}/ams/sync`, { method: 'POST' }),
    syncAMSTrayWeight: (printerId, slotKey) => request(`printers/${printerId}/ams/${slotKey}/sync`, { method: 'POST' }),
    resetPrinterStandby: (id) => request(`printers/${id}/reset-standby`, { method: 'POST' }),
    // Dashboard
    getDashboard: () => request('dashboard'),
    getHAStatus: () => request('dashboard/ha-status'),
    // App settings
    getBrandWeights: () => request('settings/brand-weights'),
    createBrandWeight: (data) => request('settings/brand-weights', { method: 'POST', body: JSON.stringify(data) }),
    updateBrandWeight: (id, data) => request(`settings/brand-weights/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteBrandWeight: (id) => request(`settings/brand-weights/${id}`, { method: 'DELETE' }),
    getFilamentSubtypes: () => request('settings/subtypes'),
    createFilamentSubtype: (name) => request('settings/subtypes', { method: 'POST', body: JSON.stringify({ name }) }),
    updateFilamentSubtype: (id, name) => request(`settings/subtypes/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    deleteFilamentSubtype: (id) => request(`settings/subtypes/${id}`, { method: 'DELETE' }),
    getFilamentMaterials: () => request('settings/materials'),
    createFilamentMaterial: (name) => request('settings/materials', { method: 'POST', body: JSON.stringify({ name }) }),
    updateFilamentMaterial: (id, name) => request(`settings/materials/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    deleteFilamentMaterial: (id) => request(`settings/materials/${id}`, { method: 'DELETE' }),
    getFilamentBrands: () => request('settings/brands'),
    createFilamentBrand: (name) => request('settings/brands', { method: 'POST', body: JSON.stringify({ name }) }),
    updateFilamentBrand: (id, name) => request(`settings/brands/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    deleteFilamentBrand: (id) => request(`settings/brands/${id}`, { method: 'DELETE' }),
    getPurchaseLocations: () => request('settings/purchase-locations'),
    createPurchaseLocation: (name) => request('settings/purchase-locations', { method: 'POST', body: JSON.stringify({ name }) }),
    updatePurchaseLocation: (id, name) => request(`settings/purchase-locations/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    deletePurchaseLocation: (id) => request(`settings/purchase-locations/${id}`, { method: 'DELETE' }),
    getStorageLocations: () => request('settings/storage-locations'),
    createStorageLocation: (name) => request('settings/storage-locations', { method: 'POST', body: JSON.stringify({ name }) }),
    updateStorageLocation: (id, name) => request(`settings/storage-locations/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    deleteStorageLocation: (id) => request(`settings/storage-locations/${id}`, { method: 'DELETE' }),
    getFilamentCatalog: () => request('settings/filament-catalog'),
    createFilamentCatalog: (data) => request('settings/filament-catalog', { method: 'POST', body: JSON.stringify(data) }),
    updateFilamentCatalog: (id, data) => request(`settings/filament-catalog/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteFilamentCatalog: (id) => request(`settings/filament-catalog/${id}`, { method: 'DELETE' }),
    importFilamentCatalog: (rows) => request('settings/filament-catalog/import', { method: 'POST', body: JSON.stringify({ rows }) }),
    // Version / Changelog
    getVersion: () => request('settings/version'),
    getChangelog: () => request('settings/changelog'),
    getHASensorValue: (entityId) => request(`settings/ha-sensor-value?entity_id=${encodeURIComponent(entityId)}`),
    getHALocale: () => request('settings/ha-locale'),
    getUserPrefs: () => request('settings/user-prefs'),
    saveUserPrefs: (data) => request('settings/user-prefs', { method: 'POST', body: JSON.stringify(data) }),
    // Bambu Cloud
    getBambuCloudStatus: () => request('bambu-cloud/status'),
    bambuCloudLogin: (email, password, region) => request('bambu-cloud/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, region }),
    }),
    bambuCloudVerify: (code) => request('bambu-cloud/verify', {
        method: 'POST',
        body: JSON.stringify({ code }),
    }),
    bambuCloudLogout: () => request('bambu-cloud/logout', { method: 'DELETE' }),
    bambuCloudCancel2fa: () => request('bambu-cloud/cancel-2fa', { method: 'POST' }),
    getBambuCloudDevices: () => request('bambu-cloud/devices'),
    getBambuCloudPrinterStatus: (serial) => request(`bambu-cloud/printer/${serial}/status`),
    getBambuCloudDebug: () => request('bambu-cloud/debug'),
    bambuCloudReconnect: () => request('bambu-cloud/reconnect', { method: 'POST' }),
    getBambuCloudTasksRaw: (serial) => request(`bambu-cloud/printer/${serial}/tasks-raw`),
    bambuCloudImportPrints: () => request('bambu-cloud/import-prints', { method: 'POST' }),
    getBambuCloudPrinterAMS: (serial) => request(`bambu-cloud/printer/${serial}/ams`),
    // Filament Sync
    getFilamentSyncStatus: () => request('filament-sync/status'),
    patchFilamentSyncSettings: (data) => request('filament-sync/settings', { method: 'PATCH', body: JSON.stringify(data) }),
    filamentSyncPreview: () => request('filament-sync/preview', { method: 'POST' }),
    filamentSyncApply: (data) => request('filament-sync/apply', { method: 'POST', body: JSON.stringify(data) }),
    // Data transfer
    exportData: () => fetch(`${BASE}/data/export`).then(r => r.blob()),
    exportSpoolsCsv: () => fetch(`${BASE}/data/export-spools-csv`).then(r => r.blob()),
    importSpoolsCsv: (file) => {
        const fd = new FormData();
        fd.append('file', file);
        return fetch(`${BASE}/data/import-spools-csv`, { method: 'POST', body: fd })
            .then(r => r.ok ? r.json() : r.json().then((e) => { throw new Error(e.detail); }));
    },
    exportSpoolman: () => fetch(`${BASE}/data/export-spoolman`).then(r => r.blob()),
    importSpoolmanJson: (file) => {
        const fd = new FormData();
        fd.append('file', file);
        return fetch(`${BASE}/data/import-spoolman`, { method: 'POST', body: fd })
            .then(r => r.ok ? r.json() : r.json().then((e) => { throw new Error(e.detail); }));
    },
    importData: (bundle) => request('data/import', {
        method: 'POST',
        body: JSON.stringify(bundle),
    }),
};
