/**
 * On Meet/Zoom: inject script that overrides getUserMedia.
 * We get the tab-capture stream in the content script (extension context) so Chrome
 * honors the chromeMediaSourceId constraint, then expose it to the page via a shared DOM element.
 */
const CAMCAST_PREFIX = '__camcast__'
const STREAM_VIDEO_ID = 'camcast-tab-stream-video'

function isMeetingPage(): boolean {
    const host = window.location.hostname
    return host.includes('meet.google.com') || host.includes('zoom.us')
}

function getTabCaptureConstraints(streamId: string): MediaStreamConstraints {
    const tabConstraint = {
        mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId
        }
    } as MediaTrackConstraints
    return { video: tabConstraint, audio: tabConstraint }
}

export function setupVirtualCamRelay(): void {
    if (!isMeetingPage()) return

    chrome.runtime.sendMessage({ type: 'INJECT_VIRTUAL_CAM' }, () => {})

    window.addEventListener('message', (event) => {
        if (event.source !== window || !event.data?.type?.startsWith(CAMCAST_PREFIX)) return
        const { type } = event.data

        if (type === `${CAMCAST_PREFIX}request-stream`) {
            chrome.runtime.sendMessage({ type: 'GET_STREAM_ID' }, (res: { streamId?: string | null }) => {
                if (!res?.streamId) {
                    window.postMessage({ type: `${CAMCAST_PREFIX}fallback`, constraints: event.data.constraints }, '*')
                    return
                }
                const constraints = getTabCaptureConstraints(res.streamId)
                navigator.mediaDevices.getUserMedia(constraints).then(
                    (stream) => {
                        let el = document.getElementById(STREAM_VIDEO_ID) as HTMLVideoElement | null
                        if (!el) {
                            el = document.createElement('video')
                            el.id = STREAM_VIDEO_ID
                            el.setAttribute('aria-hidden', 'true')
                            el.style.cssText = 'position:fixed;width:0;height:0;pointer-events:none;opacity:0;'
                            document.body.appendChild(el)
                        }
                        el.srcObject = stream
                        window.postMessage({ type: `${CAMCAST_PREFIX}stream-ready`, elementId: STREAM_VIDEO_ID }, '*')
                    },
                    () => {
                        window.postMessage({ type: `${CAMCAST_PREFIX}fallback`, constraints: event.data.constraints }, '*')
                    }
                )
            })
        }
    })
}
