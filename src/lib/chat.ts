export type Msg = { id: string; role: 'user' | 'assistant'; content: string }

export async function* chat(history: Msg[]) {
    try {
        const r = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history })
        })
        const text = await r.text()
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${text || 'no body'}`)
        yield text || '[пустой ответ]'
    } catch (e: any) {
        yield `Ошибка сети/сервера: ${e?.message ?? String(e)}`
    }
}
