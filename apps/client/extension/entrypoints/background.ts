// Extension background service worker (MV3).
// Runs persistently in the background; handles messages from popup and content scripts.
// All API calls must originate here, never from content scripts.

export default defineBackground(() => {
    browser.runtime.onInstalled.addListener((details) => {
        if (details.reason === 'install') {
            // One-time setup on fresh install
        }
    });
});
