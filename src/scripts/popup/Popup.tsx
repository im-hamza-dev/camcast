import React, { useEffect, useState } from 'react'

export default function Popup() {
    const [sourceTabId, setSourceTabId] = useState<number | null>(null)
    const [status, setStatus] = useState<string>('')

    useEffect(() => {
        chrome.storage.local.get(['cloneCamTabId'], (data) => {
            setSourceTabId(data.cloneCamTabId ?? null)
        })
    }, [])

    const setCloneCamTabAsSource = () => {
        setStatus('Finding clone-cam tab…')
        chrome.runtime.sendMessage({ type: 'GET_CLONE_CAM_TAB' }, (response: { tabId?: number | null }) => {
            const tabId = response?.tabId
            if (tabId == null) {
                setStatus('Open clone-cam.vercel.app in a tab first (with your mobile stream).')
                return
            }
            chrome.storage.local.set({ cloneCamTabId: tabId }, () => {
                setSourceTabId(tabId)
                setStatus('Set! On Google Meet, join a call — your clone-cam tab will be used as camera.')
            })
        })
    }

    return (
        <div className="flex flex-col gap-4 p-4 w-80 bg-neutral-900 text-neutral-100 rounded-lg border border-zinc-800">
            <h1 className="text-lg font-semibold">Camcast</h1>
            <p className="text-sm text-zinc-400">
                Use the video from your <strong>clone-cam.vercel.app</strong> tab (mobile stream) as the camera in Google Meet.
            </p>
            <button
                type="button"
                onClick={setCloneCamTabAsSource}
                className="w-full py-2.5 px-4 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white"
            >
                Use clone-cam tab as camera
            </button>
            {sourceTabId != null && (
                <p className="text-xs text-zinc-500">
                    Source tab ID: {sourceTabId}. Go to Meet and join a call.
                </p>
            )}
            {status && <p className="text-sm text-zinc-300">{status}</p>}
        </div>
    )
}
