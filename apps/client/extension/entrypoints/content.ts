// Extension content script.
// Injected into matching pages. Communicates with background via message bus only.
// Do not call the API directly from here; route through sendMessage to background.

export default defineContentScript({
    matches: ['<all_urls>'],
    runAt: 'document_idle',
    main() {
        // DOM interaction goes here
    },
});
