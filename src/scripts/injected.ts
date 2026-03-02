/**
 * Injected into meet.google.com / zoom.us (MAIN world).
 * Overrides getUserMedia so the page receives the tab-capture stream from the content script
 * (obtained via a shared DOM video element).
 */
const CAMCAST_PREFIX = '__camcast__'

let pendingRequest: {
    resolve: (stream: MediaStream) => void
    reject: (err: Error) => void
    constraints?: MediaStreamConstraints
} | null = null

const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices)

function isVideoRequested(constraints?: MediaStreamConstraints): boolean {
    if (!constraints) return true
    const v = constraints.video
    if (v === false) return false
    return v === true || !!v
}

navigator.mediaDevices.getUserMedia = function (constraints) {
    if (!isVideoRequested(constraints)) {
        return originalGetUserMedia(constraints)
    }
    return new Promise((resolve, reject) => {
        pendingRequest = { resolve, reject, constraints }
        window.postMessage(
            { type: `${CAMCAST_PREFIX}request-stream`, constraints: JSON.parse(JSON.stringify(constraints || {})) },
            '*'
        )
        setTimeout(() => {
            if (pendingRequest) {
                const pr = pendingRequest
                pendingRequest = null
                originalGetUserMedia(pr.constraints ?? {}).then(pr.resolve).catch(pr.reject)
            }
        }, 10000)
    })
}

navigator.mediaDevices.enumerateDevices = function () {
    return originalEnumerateDevices().then((devices) => {
        const v: MediaDeviceInfo = {
            deviceId: 'camcast-tab-capture',
            kind: 'videoinput',
            label: 'Camcast (clone-cam tab)',
            groupId: 'camcast'
        } as MediaDeviceInfo
        return [v, ...devices]
    })
}

window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data?.type?.startsWith(CAMCAST_PREFIX)) return
    const { type, elementId } = event.data

    if (type === `${CAMCAST_PREFIX}fallback` && pendingRequest) {
        originalGetUserMedia(pendingRequest.constraints ?? {}).then(pendingRequest.resolve).catch(pendingRequest.reject)
        pendingRequest = null
        return
    }

    if (type === `${CAMCAST_PREFIX}stream-ready` && elementId && pendingRequest) {
        const el = document.getElementById(elementId) as HTMLVideoElement | null
        const stream = el?.srcObject
        if (stream instanceof MediaStream) {
            pendingRequest.resolve(stream)
            pendingRequest = null
        } else {
            originalGetUserMedia(pendingRequest.constraints ?? {}).then(pendingRequest.resolve).catch(pendingRequest.reject)
            pendingRequest = null
        }
    }
})
