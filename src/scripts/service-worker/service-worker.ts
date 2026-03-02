/**
 * Camcast: bridge for tab-capture stream from clone-cam.vercel.app to Meet.
 */

chrome.runtime.onInstalled.addListener(() => {
    console.log('Camcast extension installed')
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type } = message
    if (type === 'INJECT_VIRTUAL_CAM' && sender.tab?.id != null) {
        chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            files: ['js/injected.js'],
            world: 'MAIN'
        }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }))
        return true
    }
    if (type === 'GET_CLONE_CAM_TAB') {
        chrome.tabs.query({ url: ['*://clone-cam.vercel.app/*', '*://*.clone-cam.vercel.app/*', 'http://localhost:*/*'] }, (tabs) => {
            const tab = tabs.find((t) => !t.url?.includes('/mobile'))
            sendResponse({ tabId: tab?.id ?? null })
        })
        return true
    }
    if (type === 'GET_STREAM_ID') {
        const consumerTabId = sender.tab?.id
        if (consumerTabId == null) {
            sendResponse({ streamId: null })
            return true
        }
        chrome.storage.local.get(['cloneCamTabId'], (data) => {
            const targetTabId = data.cloneCamTabId
            if (targetTabId == null) {
                sendResponse({ streamId: null })
                return
            }
            chrome.tabCapture.getMediaStreamId(
                { targetTabId, consumerTabId },
                (streamId) => sendResponse({ streamId: streamId && streamId.length > 0 ? streamId : null })
            )
        })
        return true
    }
    return false
})

export {}
