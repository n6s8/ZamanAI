import { useEffect, useRef, useState } from 'react'

export function useRecorder() {
    const [recording, setRecording] = useState(false)
    const [blob, setBlob] = useState<Blob | null>(null)
    const recRef = useRef<MediaRecorder | null>(null)
    const chunks = useRef<BlobPart[]>([])
    const streamRef = useRef<MediaStream | null>(null)

    useEffect(() => {
        return () => {
            try { recRef.current?.stop() } catch {}
            streamRef.current?.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
    }, [])

    async function start() {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm'
        const rec = new MediaRecorder(stream, { mimeType: mime })
        recRef.current = rec
        chunks.current = []
        setBlob(null)

        rec.ondataavailable = e => {
            if (e.data && e.data.size) chunks.current.push(e.data)
        }

        // timeslice ensures chunks are flushed even on short taps
        rec.start(250)
        setRecording(true)
    }

    async function sendToServer(b: Blob): Promise<string> {
        const file = new File([b], 'audio.webm', { type: b.type || 'audio/webm' })
        const form = new FormData()
        form.append('file', file)

        const API_BASE = import.meta.env.VITE_API_URL || ''
        const r = await fetch(`${API_BASE}/api/stt`, { method: 'POST', body: form })
        if (!r.ok) throw new Error('STT server error')
        const ct = r.headers.get('content-type') || ''
        const data = ct.includes('application/json') ? await r.json() : await r.text()
        return typeof data === 'string' ? data : (data?.text || '')
    }

    async function stopAndGetText(): Promise<string> {
        const rec = recRef.current
        if (!rec) return ''

        const out = await new Promise<Blob | null>(resolve => {
            const finalize = () => {
                const b = chunks.current.length ? new Blob(chunks.current, { type: 'audio/webm' }) : null
                setBlob(b)
                setRecording(false)
                // always release mic
                streamRef.current?.getTracks().forEach(t => t.stop())
                streamRef.current = null
                resolve(b)
            }

            if (rec.state === 'inactive') return finalize()
            rec.onstop = finalize
            try { rec.stop() } catch { finalize() }
        })

        if (!out || out.size === 0) return ''
        try {
            return await sendToServer(out)
        } catch (e) {
            console.error(e)
            return ''
        }
    }

    function reset() {
        setBlob(null)
        chunks.current = []
    }

    return { recording, blob, start, stopAndGetText, reset }
}
