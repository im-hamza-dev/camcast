/**
 * Injected into meet.google.com / zoom.us (MAIN world).
 * Overrides getUserMedia to the custom mobile cam stream.
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

// Only intercept when the user explicitly chose our virtual device (avoids "close other app using camera").
function wantsOurDevice(constraints?: MediaStreamConstraints): boolean {
    const v = constraints?.video
    if (!v || v === true) return false
    const deviceId = (v as MediaTrackConstraints).deviceId
    if (deviceId === 'camcast-tab-capture') return true
    if (typeof deviceId === 'object' && deviceId !== null && !Array.isArray(deviceId)) {
        const d = deviceId as { exact?: string | string[]; ideal?: string | string[] }
        if (d.ideal === 'camcast-tab-capture' || (Array.isArray(d.exact) && d.exact.includes('camcast-tab-capture')) || d.exact === 'camcast-tab-capture') return true
    }
    return false
}

// 1. Override getUserMedia
navigator.mediaDevices.getUserMedia = async function (constraints) {
    if (!isVideoRequested(constraints)) {
        return originalGetUserMedia(constraints)
    }

    // Only provide our stream when user selected "Mobile Cam (Camcast)" — otherwise use real camera.
    if (!wantsOurDevice(constraints)) {
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

// 2. Override enumerateDevices so Meet "sees" our camera as an option (at the end to avoid "other app using camera").
navigator.mediaDevices.enumerateDevices = function () {
    return originalEnumerateDevices().then((devices) => {
        const virtualCam: MediaDeviceInfo = {
            deviceId: 'camcast-tab-capture',
            kind: 'videoinput',
            label: 'Mobile Cam (Camcast)',
            groupId: 'camcast-group'
        } as MediaDeviceInfo
        return [...devices, virtualCam]
    })
}

// 3. Handle the stream delivery
window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data?.type?.startsWith(CAMCAST_PREFIX)) return
    const { type, elementId } = event.data

    if (type === `${CAMCAST_PREFIX}fallback` && pendingRequest) {
        originalGetUserMedia(pendingRequest.constraints ?? {}).then(pendingRequest.resolve).catch(pendingRequest.reject)
        pendingRequest = null
        return
    }

    if (type === `${CAMCAST_PREFIX}stream-ready` && elementId && pendingRequest) {
        const el = document.getElementById(elementId) as HTMLVideoElement | null
        
        if (el) {
            // FIX: Ensure the video element is actually playing
            if (el.paused) await el.play().catch(console.warn);

            // FIX: use captureStream() if available, fallback to srcObject
            // captureStream(fps) ensures a continuous flow of frames to Meet
            const stream = (el as any).captureStream ? (el as any).captureStream(30) : el.srcObject;

            if (stream instanceof MediaStream && stream.getVideoTracks().length > 0) {
                const track = stream.getVideoTracks()[0];
                
                // Ensure track is enabled
                track.enabled = true;

                // Handle Meet's requirement for tracks to not be 'ended'
                track.onended = () => console.log("Camcast track ended");

                pendingRequest.resolve(stream)
                pendingRequest = null
                return;
            }
        }
        
        // Final Fallback
        originalGetUserMedia(pendingRequest.constraints ?? {}).then(pendingRequest.resolve).catch(pendingRequest.reject)
        pendingRequest = null
    }
})