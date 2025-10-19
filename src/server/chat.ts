// src/server/chat.ts
import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import multer from 'multer'
import { createRequire } from 'module'

// --- Надёжный импорт pdf-parse (работает и в ESM, и в CJS) ---
const require = createRequire(import.meta.url)
const pdfParseAny: any = require('pdf-parse')               // может быть функцией или { default: fn }
const pdfParse: (data: Buffer | Uint8Array) => Promise<{ text: string }> =
    (typeof pdfParseAny === 'function' ? pdfParseAny : pdfParseAny?.default) as any

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }
})

type Role = 'system' | 'user' | 'assistant'
type Msg = { role: Exclude<Role, 'system'>; content: string }

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/ping', (_req, res) => res.type('text/plain').send('pong'))

const SYSTEM_PROMPT =
    'Ты — банковский ассистент Zaman Bank. Отвечай кратко, по шагам. Соблюдай принципы исламских финансов. Валюта: ₸.'

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, ms = 10000) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), ms)
    try {
        const res = await fetch(input, { ...init, signal: controller.signal })
        return res
    } finally {
        clearTimeout(id)
    }
}

/** === CHAT === */
app.post('/api/chat', async (req: Request, res: Response) => {
    try {
        const history = (req.body?.history ?? []) as Msg[]
        const messages: Array<{ role: Role; content: string }> = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history
        ]

        const base = process.env.HUB_BASE_URL || ''
        const key  = process.env.HUB_API_KEY  || ''
        if (!base || !key) return res.status(500).type('text/plain').send('HUB_BASE_URL or HUB_API_KEY is missing')

        const url  = `${base}/chat/completions`
        const headers: Record<string,string> = { 'Content-Type': 'application/json' }
        if (key.startsWith('sk-')) headers.Authorization = `Bearer ${key}`
        else headers['x-litellm-api-key'] = key

        const body = { model: 'gpt-4o-mini', messages, temperature: 0.2 }
        const r = await fetchWithTimeout(url, { method: 'POST', headers, body: JSON.stringify(body) }, 15000)
        const raw = await r.text()

        if (!r.ok) return res.status(r.status).type('text/plain').send(raw || 'hub error')

        let json: any = null
        try { json = JSON.parse(raw) } catch { return res.type('text/plain').send(raw) }

        const content = json?.choices?.[0]?.message?.content ?? json?.content ?? ''
        res.type('text/plain').send(content || '[пустой ответ]')
    } catch (e: any) {
        const msg = e?.name === 'AbortError' ? 'upstream timeout' : (e?.message ?? String(e))
        res.status(500).type('text/plain').send(msg)
    }
})

/** === STT (Whisper) === */
app.post('/api/stt', upload.any(), async (req: Request, res: Response) => {
    try {
        const base = process.env.HUB_BASE_URL || ''
        const key  = process.env.HUB_API_KEY  || ''
        if (!base || !key) {
            return res.status(500).type('text/plain').send('HUB_BASE_URL or HUB_API_KEY is missing')
        }
        const url  = `${base}/v1/audio/transcriptions`

        const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : []
        console.log('[STT] content-type:', req.headers['content-type'])
        console.log('[STT] files:', files.map(f => ({ field: f.fieldname, type: f.mimetype, size: f.size })))

        const preferred = new Set(['file','audio','audio_file','speech'])
        let file = files.find(f => preferred.has(f.fieldname))
        if (!file) file = files.find(f => (f.mimetype || '').startsWith('audio/')) || files[0]
        if (!file) return res.status(400).type('text/plain').send('no file')

        const form = new FormData()
        const filename = file.originalname || 'audio.webm'
        const type = file.mimetype || 'audio/webm'
        const webFile = new File([new Uint8Array(file.buffer)], filename, { type })
        form.append('file', webFile)
        form.append('model', 'whisper-1')

        const headers: Record<string,string> = {}
        if (key.startsWith('sk-')) headers.Authorization = `Bearer ${key}`
        headers['x-litellm-api-key'] = key

        const r = await fetch(url, { method: 'POST', headers, body: form })
        const raw = await r.text()
        if (!r.ok) return res.status(r.status).type('text/plain').send(raw || 'stt error')

        let json: any = null
        try { json = JSON.parse(raw) } catch { return res.json({ text: raw }) }

        const text = json?.text ?? json?.results?.[0]?.text ?? json?.data?.[0]?.text ?? ''
        return res.json({ text: String(text || '').trim() })
    } catch (e: any) {
        console.error('STT SERVER ERROR:', e)
        return res.status(500).type('text/plain').send(e?.message ?? 'stt error')
    }
})

/** === TTS === */
app.post('/api/tts', async (req: Request, res: Response) => {
    try {
        const base = process.env.HUB_BASE_URL || ''
        const key  = process.env.HUB_API_KEY  || ''
        if (!base || !key) return res.status(500).type('text/plain').send('HUB_BASE_URL or HUB_API_KEY is missing')

        const { text, voice = 'alloy', format = 'mp3', model = 'tts-1' } = req.body || {}
        if (!text || typeof text !== 'string') return res.status(400).type('text/plain').send('no text')

        const url = `${base}/v1/audio/speech`
        const headers: Record<string,string> = { 'Content-Type': 'application/json' }
        if (key.startsWith('sk-')) headers.Authorization = `Bearer ${key}`
        headers['x-litellm-api-key'] = key

        const body = JSON.stringify({ model, voice, input: text, format })
        const r = await fetch(url, { method: 'POST', headers, body })

        const buf = await r.arrayBuffer()
        const preview = Buffer.from(buf).toString('utf8').slice(0, 300)
        console.log('[TTS→hub] status:', r.status)
        console.log('[TTS→hub] preview:', preview)

        if (!r.ok) {
            return res.status(r.status).type('text/plain').send(preview || 'tts error')
        }

        res.setHeader('Content-Type', format === 'mp3' ? 'audio/mpeg' : 'audio/webm')
        res.setHeader('Cache-Control', 'no-store')
        return res.send(Buffer.from(buf))
    } catch (e: any) {
        console.error('TTS SERVER ERROR:', e)
        return res.status(500).type('text/plain').send(e?.message ?? 'tts error')
    }
})

/** === SPEND: парсинг PDF (Kaspi и похожие) === */
app.post('/api/spend/pdf', upload.single('file'), async (req: Request, res: Response) => {
    try {
        const file = req.file
        if (!file) return res.status(400).json({ error: 'no file' })
        if ((file.mimetype || '') !== 'application/pdf' && !/\.pdf$/i.test(file.originalname || '')) {
            return res.status(400).json({ error: 'not a pdf' })
        }

        if (typeof pdfParse !== 'function') {
            console.error('pdf-parse resolved to', typeof pdfParse, pdfParse)
            return res.status(500).json({ error: 'pdf-parse not a function (check install/lockfile)' })
        }

        // 1) текст из PDF
        const { text } = await pdfParse(file.buffer)

        // 2) разбор строк
        const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean)

        // 3) Kaspi-подобная регулярка
        const re =
            /(?<d>\b\d{2}\.\d{2}\.(\d{2}|\d{4})\b)\s+(?<sign>[+-])\s*(?<amt>[\d\s]+[.,]\d{2})\s*₸?\s+(?<kind>Purchases|Transfers|Replenishment|Withdrawals|Others)\s+(?<desc>.+)$/i

        type Tx = { date: string; description: string; amount: number; kind: string }
        const txs: Tx[] = []

        for (const ln of lines) {
            const m = re.exec(ln)
            if (!m?.groups) continue

            const d = m.groups['d']
            const sign = m.groups['sign']
            const kind = m.groups['kind']
            const desc = (m.groups['desc'] || '').replace(/\s{2,}/g, ' ').trim()

            const amtRaw = (m.groups['amt'] || '').replace(/\s/g, '').replace(',', '.')
            let amount = Number(amtRaw)
            if (!isFinite(amount)) continue
            if (sign === '-') amount = -amount

            const [dd, mm, yyraw] = d.split('.')
            const yyyy = yyraw.length === 2 ? `20${yyraw}` : yyraw
            const iso = `${yyyy}-${mm}-${dd}`

            txs.push({ date: iso, description: desc, amount, kind })
        }

        return res.json({ txs })
    } catch (e: any) {
        console.error('PDF PARSE ERROR:', e)
        return res.status(500).json({ error: e?.message ?? 'pdf parse error' })
    }
})

/** === AI-анализ расходов: группировка + привычки === */
app.post('/api/spend/ai', async (req: Request, res: Response) => {
    try {
        const txs = Array.isArray(req.body?.txs) ? req.body.txs : []
        if (!txs.length) return res.status(400).json({ error: 'no txs' })

        const base = process.env.HUB_BASE_URL || ''
        const key  = process.env.HUB_API_KEY  || ''
        if (!base || !key) {
            return res.status(500).json({ error: 'HUB_BASE_URL or HUB_API_KEY is missing' })
        }

        const compact = txs.slice(-200).map((t: any) => ({
            d: String(t.d ?? t.description ?? '').slice(0, 140),
            a: Number(t.a ?? t.amount ?? 0),
        }))

        const SYSTEM =
            'Ты — финансовый аналитик банка. Тебе дан список операций: d — описание, a — сумма (отрицательные — расходы). ' +
            'Сгруппируй их по категориям (например: "Продукты", "Кафе", "Транспорт", "Подписки", "Коммунальные", "Здоровье", "Переводы", "Другое"). ' +
            'Верни строго JSON вида: {"categories":[{"name":string,"total":number,"kind":"expense"|"income","examples":string[]}],"habits":string[]}. ' +
            'categories — топ-10 по расходам и доходам. habits — 5–10 советов, как сократить траты и выработать полезные финансовые привычки.'

        const USER = `Операции: ${JSON.stringify(compact)}`

        const url = `${base}/chat/completions`
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (key.startsWith('sk-')) headers.Authorization = `Bearer ${key}`
        else headers['x-litellm-api-key'] = key

        const body = {
            model: 'gpt-4o-mini',
            temperature: 0.3,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: SYSTEM },
                { role: 'user', content: USER }
            ]
        }

        const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
        const raw = await r.text()

        if (!r.ok) return res.status(r.status).json({ error: raw })

        let parsed
        try {
            const j = JSON.parse(raw)
            const c = j?.choices?.[0]?.message?.content
            parsed = typeof c === 'string' ? JSON.parse(c) : c
        } catch {
            parsed = JSON.parse(raw)
        }

        if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.habits))
            return res.status(500).json({ error: 'bad ai json', raw })

        res.json(parsed)
    } catch (e: any) {
        res.status(500).json({ error: e?.message ?? 'ai error' })
    }
})


const PORT = Number(process.env.PORT ?? 5210)
app.listen(PORT, () => console.log(`✅ Server: http://localhost:${PORT}`))
