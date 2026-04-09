// Typed storage helpers. All reads and writes to extension storage go through here.
// Never call browser.storage.* directly from a component or entrypoint.
// Prefix keys with 'local:' (device-only) or 'sync:' (cross-device, small quota).

import { storage } from 'wxt/storage';

export const localStore = {
    // Add typed local storage accessors here.
    // Example:
    // getUserId: () => storage.getItem<string>('local:userId'),
    // setUserId: (id: string) => storage.setItem('local:userId', id),
};

export const syncStore = {
    // Add typed sync storage accessors here.
    // Example:
    // getTheme: () => storage.getItem<'light' | 'dark'>('sync:theme'),
    // setTheme: (theme: 'light' | 'dark') => storage.setItem('sync:theme', theme),
};
