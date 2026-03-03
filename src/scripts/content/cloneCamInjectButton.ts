/**
 * On clone-cam.vercel.app desktop page: inject a "Use in Meet" button next to the Expand button.
 * Clicking it sets this tab as the Camcast source and opens/focuses Google Meet.
 */

const MEET_URL = 'https://meet.google.com'
const CLONECAM_HOSTS = ['clone-cam.vercel.app', 'localhost', '127.0.0.1']

function isCloneCamDesktopPage(): boolean {
    try {
        const host = window.location.hostname
        if (!CLONECAM_HOSTS.some((h) => host === h || host.endsWith('.' + h))) return false
        if (window.location.pathname.startsWith('/mobile')) return false
        return true
    } catch {
        return false
    }
}

function findExpandButton(): HTMLButtonElement | null {
    const buttons = document.querySelectorAll('button')
    for (const btn of buttons) {
        if (btn.textContent?.trim() === 'Expand' || btn.getAttribute('title')?.includes('Expand')) {
            return btn as HTMLButtonElement
        }
    }
    return null
}

function injectUseInMeetButton(): void {
    if (document.getElementById('camcast-use-in-meet-btn')) return
    const expandBtn = findExpandButton()
    if (!expandBtn) return
    const wrapper = expandBtn.parentElement
    if (!wrapper) return

    const btn = document.createElement('button')
    btn.id = 'camcast-use-in-meet-btn'
    btn.type = 'button'
    btn.textContent = 'Use in Meet'
    btn.title = 'Set this stream as camera source and open Google Meet'
    btn.className = expandBtn.className
    btn.style.marginLeft = '4px'
    btn.addEventListener('click', () => {
        btn.disabled = true
        btn.textContent = '…'
        chrome.runtime.sendMessage({ type: 'SET_SOURCE_AND_OPEN_MEET' }, () => {
            btn.disabled = false
            btn.textContent = 'Use in Meet'
        })
    })
    expandBtn.after(btn)
}

export function setupCloneCamInjectButton(): void {
    if (!isCloneCamDesktopPage()) return

    const tryInject = () => injectUseInMeetButton()
    tryInject()
    const observer = new MutationObserver(tryInject)
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(tryInject, 1500)
    setTimeout(tryInject, 4000)
}
