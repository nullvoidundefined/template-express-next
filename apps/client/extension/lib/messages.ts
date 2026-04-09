// Typed message definitions for inter-context communication.
// All messages between popup, content script, and background use this union.
// Never send raw string-based messages; always go through this typed interface.

export type ExtensionMessage = { type: 'PING' };

export type ExtensionResponse = { type: 'PING'; data: 'pong' };

async function sendMessage<T extends ExtensionMessage>(
    message: T,
): Promise<Extract<ExtensionResponse, { type: T['type'] }>['data']> {
    return browser.runtime.sendMessage(message);
}

function onMessage(
    handler: (
        message: ExtensionMessage,
        sender: browser.Runtime.MessageSender,
    ) => Promise<unknown> | unknown,
) {
    browser.runtime.onMessage.addListener(handler);
}

export { onMessage, sendMessage };
