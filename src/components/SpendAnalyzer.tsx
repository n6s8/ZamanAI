// src/components/SpendAnalyzer.tsx
import { useMemo, useState, type ReactNode } from 'react'
import { parseTransactions, type Tx } from '../lib/spend'

/* ---------- Категоризация для диаграммы и офлайн-анализа ---------- */
const CATEGORY_RULES: Array<{ name: string; keys: RegExp[] }> = [
    { name: 'Продукты', keys: [/magnum/i, /small/i, /grocery/i, /market/i, /super/i] },
    { name: 'Обеды/кафе', keys: [/coffee/i, /kafe/i, /cafe/i, /restaurant/i, /burger/i, /pizza/i, /doner/i, /kfc/i, /mc/i] },
    { name: 'Транспорт', keys: [/taxi/i, /bolt/i, /yandex/i, /bus/i, /metro/i, /fuel/i, /gas/i, /petrol/i, /ai-?92|ai-?95/i] },
    { name: 'Связь/интернет', keys: [/tele2/i, /activ/i, /beeline/i, /kcell/i, /inet/i, /internet/i, /wifi/i] },
    { name: 'Шоппинг', keys: [/sulpak/i, /technodom/i, /wildberries/i, /wb/i, /ozon/i, /lamoda/i, /store/i, /shop/i] },
    { name: 'Здоровье', keys: [/apteka/i, /drug/i, /pharm/i, /clinic/i, /hospital/i, /med/i] },
    { name: 'Коммунальные', keys: [/kommun/i, /electric/i, /water/i, /heat/i, /egov/i] },
    { name: 'Развлечения', keys: [/cinema/i, /kino/i, /netflix/i, /youtube/i, /music/i, /game/i, /steam/i] },
    { name: 'Образование', keys: [/course/i, /edu/i, /school/i, /univer/i, /udemy/i, /coursera/i] },
    { name: 'Другое', keys: [/.*/] },
]
function classify(desc: string): string {
    for (const r of CATEGORY_RULES) if (r.keys.some(rx => rx.test(desc))) return r.name
    return 'Другое'
}

/* ---------- Тип для «AI/локального» результата ---------- */
type Insight = {
    categories: Array<{ name: string; total: number; kind: 'expense' | 'income'; examples: string[] }>
    habits: string[]
}

/* ---------- Компонент ---------- */
export const SpendAnalyzer = () => {
    const [txs, setTxs] = useState<Tx[]>([])
    const [hint, setHint] = useState<string>('Загрузите CSV или PDF (текстовый, не скан).')
    const [sortKey, setSortKey] = useState<'date' | 'description' | 'amount'>('date')
    const [sortDir, setSortDir] = useState<SortDir>('desc')
    const [query, setQuery] = useState<string>('')

    // «AI/локальный» вывод
    const [aiLoading, setAiLoading] = useState(false)
    const [aiError, setAiError] = useState<string | null>(null)
    const [ai, setAi] = useState<Insight | null>(null)

    async function onFile(f: File) {
        const name = f.name.toLowerCase()

        if (name.endsWith('.pdf')) {
            setHint(`Читаю PDF: ${f.name} ...`)
            const form = new FormData()
            form.append('file', f)
            try {
                const r = await fetch('/api/spend/pdf', { method: 'POST', body: form })
                const data = await r.json()
                if (!r.ok) {
                    setHint(`PDF ошибка: ${data?.error || r.status}`)
                    setTxs([]); setAi(null)
                    return
                }
                const parsed: Tx[] = (data?.txs || []).map((t: any) => ({
                    date: new Date(t.date),
                    description: String(t.description || '-'),
                    amount: Number(t.amount || 0),
                }))
                if (!parsed.length) {
                    setHint('Из PDF ничего не извлечено. Возможно, это скан (нужен OCR).')
                    setTxs([]); setAi(null)
                    return
                }
                setTxs(parsed)
                setAi(null)
                setHint(`Импортировано операций: ${parsed.length}`)
            } catch (e: any) {
                setHint(`PDF ошибка сети/сервера: ${e?.message ?? String(e)}`)
                setTxs([]); setAi(null)
            }
            return
        }

        // CSV
        setHint(`Читаю CSV: ${f.name} ...`)
        try {
            const text = await f.text()
            const parsed = parseTransactions(text)
            if (parsed.length === 0) {
                setHint('Не удалось распознать CSV. Проверьте, чтобы это был именно CSV.')
                setTxs([]); setAi(null)
                return
            }
            setTxs(parsed)
            setAi(null)
            setHint(`Импортировано операций: ${parsed.length}`)
        } catch (e: any) {
            setHint(`CSV ошибка: ${e?.message ?? String(e)}`)
            setTxs([]); setAi(null)
        }
    }

    /* ---------- Сводка ---------- */
    const summary = useMemo(() => {
        const income = txs.reduce((s, t) => (t.amount > 0 ? s + t.amount : s), 0)
        const expenses = txs.reduce((s, t) => (t.amount < 0 ? s + t.amount : s), 0)
        const balance = income + expenses
        return { count: txs.length, income, expenses, balance }
    }, [txs])

    /* ---------- Круговая диаграмма (только по расходам) ---------- */
    const pie = useMemo(() => {
        const totals = new Map<string, number>()
        for (const t of txs) {
            if (t.amount >= 0) continue
            const cat = classify(t.description)
            totals.set(cat, (totals.get(cat) || 0) + Math.abs(t.amount))
        }
        const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
        const total = entries.reduce((s, [, v]) => s + v, 0)
        return { total, slices: entries.map(([label, value]) => ({ label, value, pct: total ? (value / total) * 100 : 0 })) }
    }, [txs])

    /* ---------- Таблица с сортировкой/поиском ---------- */
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        const arr = q ? txs.filter(t => t.description.toLowerCase().includes(q)) : txs.slice()
        arr.sort((a, b) => {
            let cmp = 0
            if (sortKey === 'date') cmp = a.date.getTime() - b.date.getTime()
            else if (sortKey === 'description') cmp = a.description.localeCompare(b.description)
            else cmp = a.amount - b.amount
            return sortDir === 'asc' ? cmp : -cmp
        })
        return arr
    }, [txs, query, sortKey, sortDir])

    const toggleSort = (key: 'date' | 'description' | 'amount') => {
        if (sortKey !== key) { setSortKey(key); setSortDir('desc'); return }
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    }

    /* ---------- ЛОКАЛЬНЫЙ АНАЛИЗ (без сервера) ---------- */
    function buildLocalInsights(): Insight {
        // 1) агрегируем категории
        const map = new Map<string, { total: number; examples: string[] }>()
        for (const t of txs) {
            const isIncome = t.amount > 0
            const cat = isIncome ? 'Поступления' : classify(t.description)
            const v = Math.abs(t.amount)
            if (!map.has(cat)) map.set(cat, { total: 0, examples: [] })
            const e = map.get(cat)!
            e.total += v
            if (e.examples.length < 3 && t.description.trim()) e.examples.push(t.description.trim())
        }

        // 2) в массив (доход/расход)
        const categories = [...map.entries()]
            .map(([name, v]) => ({
                name,
                total: v.total,
                kind: name === 'Поступления' ? 'income' : 'expense' as const,
                examples: v.examples
            }))
            .sort((a, b) => b.total - a.total)

        // 3) эвристические «привычки»
        const totalExpense = categories.filter(c => c.kind === 'expense').reduce((s, c) => s + c.total, 0) || 1
        const share = (name: string) =>
            (categories.find(c => c.name === name && c.kind === 'expense')?.total || 0) / totalExpense

        const habits: string[] = []
        if (share('Обеды/кафе') > 0.15) habits.push('Снизить траты на кафе: готовить дома 2–3 раза в неделю, брать обеды с собой.')
        if (share('Продукты') > 0.35) habits.push('Составлять список покупок и план питания на неделю — меньше импульсивных покупок.')
        if (share('Связь/интернет') > 0.08) habits.push('Проверить тарифы у оператора: часто есть пакет дешевле при автооплате или годовой оплате.')
        if (share('Развлечения') > 0.10) habits.push('Ограничить подписки и микроплатежи: раз в месяц аудит активных подписок.')
        if (share('Транспорт') > 0.12) habits.push('Чаще использовать общественный транспорт/каршеринг; объединять поездки, планировать маршруты.')
        if (share('Шоппинг') > 0.10) habits.push('Правило «24 часа»: если вещь не первой необходимости — подождать сутки перед покупкой.')
        if (categories.some(c => /коммун/i.test(c.name))) habits.push('Для коммунальных: оплата без просрочек и учет показаний — без штрафов и переплат.')
        if (totalExpense > 0 && summary.income > 0 && totalExpense / summary.income > 0.9)
            habits.push('Попробовать метод 50/30/20: 50% — базовые нужды, 30% — жизнь, 20% — накопления.')

        // если эвристик мало — добавим общих
        if (habits.length < 3) {
            habits.push('Ввести лимиты по категориям и напоминание о достижении 80% лимита.')
            habits.push('Автоматический перевод 10–15% дохода в накопления в день зарплаты.')
        }

        return { categories, habits }
    }

    async function runLocal() {
        setAiError(null)
        const res = buildLocalInsights()
        setAi(res)
    }

    /* ---------- AI через сервер (с фолбэком на локальный) ---------- */
    async function runAI() {
        setAiError(null)
        setAiLoading(true)
        try {
            const API = import.meta.env.VITE_API_BASE ?? ''
            const r = await fetch(`${API || ''}/api/spend/ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    txs: txs.slice(0, 200).map(t => ({ d: t.description, a: t.amount }))
                })
            })
            const raw = await r.text()
            let data: any
            try { data = JSON.parse(raw) }
            catch { throw new Error(`AI: backend non-JSON (${raw.slice(0, 120)}…)`) }

            if (!r.ok) throw new Error(data?.error || String(r.status))
            setAi(data as Insight)
        } catch (e: any) {
            // безопасный фолбэк
            setAi(buildLocalInsights())
            setAiError(`AI недоступен • применён локальный анализ (${e?.message ?? e})`)
        } finally {
            setAiLoading(false)
        }
    }

    return (
        <div>
            <h3 style={{ marginTop: 0, color: 'var(--green)' }}>Анализ выписки</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Левая колонка */}
                <div>
                    <DropBox onFile={onFile} hint={hint} />

                    {txs.length > 0 && (
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                            <input
                                className="input"
                                placeholder="Поиск по описанию..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                style={{ maxWidth: 320 }}
                            />
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                <Stat label="Операций">{summary.count}</Stat>
                                <Stat label="Поступления">{fmtCurrency(summary.income)}</Stat>
                                <Stat label="Расходы">{fmtCurrency(summary.expenses)}</Stat>
                                <Stat label="Баланс">{fmtCurrency(summary.balance)}</Stat>
                            </div>

                            <button className="btn" onClick={runLocal} disabled={txs.length === 0}>
                                Локальный анализ (офлайн)
                            </button>
                            <button
                                className="btn btn--green"
                                onClick={runAI}
                                disabled={aiLoading || txs.length === 0}
                                title="GPT сгруппирует траты и предложит привычки"
                            >
                                {aiLoading ? 'AI анализ…' : 'AI анализ (через сервер)'}
                            </button>
                            {aiError && <span style={{ color: '#b23', fontSize: 12 }}>Ошибка AI: {aiError}</span>}
                        </div>
                    )}

                    {/* Таблица */}
                    {filtered.length === 0 ? (
                        <div style={{ fontSize: 13, opacity: 0.8 }}>Пока нет данных.</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                <tr>
                                    <Th onClick={() => toggleSort('date')} active={sortKey === 'date'} dir={sortDir}>Дата</Th>
                                    <Th onClick={() => toggleSort('description')} active={sortKey === 'description'} dir={sortDir}>Описание</Th>
                                    <Th onClick={() => toggleSort('amount')} active={sortKey === 'amount'} dir={sortDir} align="right">Сумма</Th>
                                </tr>
                                </thead>
                                <tbody>
                                {filtered.map((t, i) => (
                                    <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                                        <Td>{fmtDate(t.date)}</Td>
                                        <Td>{t.description}</Td>
                                        <Td align="right" style={{ color: t.amount < 0 ? '#b23' : '#2a6' }}>{fmtCurrency(t.amount)}</Td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Правая колонка: Pie + Категории + Habits */}
                <div>
                    {/* Круговая диаграмма по локальным правилам */}
                    <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Где уходят деньги (локально)</div>
                        {pie.total === 0 ? (
                            <div style={{ fontSize: 13, opacity: 0.7 }}>Нет расходов для построения диаграммы.</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12 }}>
                                <PieChart width={220} height={220} data={pie.slices} />
                                <div>
                                    {pie.slices.map((s, i) => (
                                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', margin: '6px 0' }}>
                      <span style={{
                          width: 10, height: 10, borderRadius: 3,
                          background: PIE_COLORS[i % PIE_COLORS.length], marginRight: 8,
                      }} />
                                            <div style={{ flex: 1 }}>
                                                {s.label}
                                                <div style={{ fontSize: 12, opacity: 0.7 }}>
                                                    {fmtCurrency(s.value)} · {s.pct.toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Результаты анализа (AI или офлайн) */}
                    <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Группы категорий</div>
                        {!ai ? (
                            <div style={{ fontSize: 13, opacity: 0.7 }}>
                                Нажмите «Локальный анализ» (офлайн) или «AI анализ» (сервер).
                            </div>
                        ) : ai.categories.length === 0 ? (
                            <div style={{ fontSize: 13, opacity: 0.7 }}>Категории не обнаружены.</div>
                        ) : (
                            <div style={{ display: 'grid', gap: 8 }}>
                                {ai.categories.map((c, i) => (
                                    <div key={i} style={{ background: '#fbfbf8', borderRadius: 10, padding: '8px 10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                            <div><b>{c.name}</b> <span style={{ opacity: 0.6, fontSize: 12 }}>({c.kind === 'income' ? 'доход' : 'расход'})</span></div>
                                            <div style={{ whiteSpace: 'nowrap' }}>{fmtCurrency(c.total)}</div>
                                        </div>
                                        {c.examples?.length > 0 && (
                                            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                                                Примеры: {c.examples.join(' · ')}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="card" style={{ padding: 12 }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Habits (советы по экономии)</div>
                        {!ai ? (
                            <div style={{ fontSize: 13, opacity: 0.7 }}>Сначала выполните анализ.</div>
                        ) : ai.habits.length === 0 ? (
                            <div style={{ fontSize: 13, opacity: 0.7 }}>Советы не сформированы.</div>
                        ) : (
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                                {ai.habits.map((h, i) => <li key={i} style={{ margin: '6px 0' }}>{h}</li>)}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ---------- DropBox ---------- */
const DropBox = ({ onFile, hint }: { onFile: (f: File) => Promise<void>, hint: string }) => (
    <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void onFile(f) }}
        style={{ padding: 16, border: '2px dashed #ddd', borderRadius: 12, textAlign: 'center', background: '#fbfbf8', marginBottom: 12 }}
    >
        <div style={{ marginBottom: 8, fontWeight: 600 }}>
            Перетащите CSV или PDF сюда либо выберите файл
        </div>
        <input type="file" accept=".csv,application/pdf" onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f) }} />
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>{hint}</div>
    </div>
)

/* ---------- Pie chart (SVG) ---------- */
const PIE_COLORS = ['#5AA9E6', '#FF6B6B', '#FFD166', '#6BCB77', '#B28DFF', '#4D96FF', '#F4978E', '#6A4C93']
type PieDatum = { label: string; value: number; pct?: number }

const PieChart = ({ width, height, data }: { width: number; height: number; data: PieDatum[] }) => {
    const r = Math.min(width, height) / 2
    const cx = width / 2, cy = height / 2
    const total = data.reduce((s, d) => s + d.value, 0) || 1

    let angle = -Math.PI / 2
    const paths: ReactNode[] = []

    data.forEach((d, i) => {
        const slice = (d.value / total) * 2 * Math.PI
        const a0 = angle, a1 = angle + slice; angle = a1
        const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0)
        const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
        const largeArc = slice > Math.PI ? 1 : 0
        const dPath = [`M ${cx} ${cy}`, `L ${x0} ${y0}`, `A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1}`, 'Z'].join(' ')
        paths.push(<path key={i} d={dPath} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#fff" strokeWidth={1} />)
    })

    return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>{paths}</svg>
}

/* ---------- Утилиты ---------- */
type SortDir = 'asc' | 'desc'

type StatProps = { label: string; children?: ReactNode }
const Stat = ({ label, children }: StatProps) => (
    <div style={{ background: '#fbfbf8', padding: '10px 12px', borderRadius: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{label}</div>
        <div style={{ fontWeight: 700 }}>{children}</div>
    </div>
)

type ThProps = { onClick: () => void; active: boolean; dir: SortDir; align?: 'left' | 'right'; children?: ReactNode }
const Th = ({ onClick, active, dir, align = 'left', children }: ThProps) => (
    <th
        onClick={onClick}
        style={{ textAlign: align, cursor: 'pointer', padding: '10px 12px', userSelect: 'none', borderBottom: '1px solid #eee', whiteSpace: 'nowrap' }}
    >
        <span>{children}</span>
        <span style={{ opacity: active ? 1 : 0.25, marginLeft: 6 }}>{dir === 'asc' ? '▲' : '▼'}</span>
    </th>
)

type TdProps = { align?: 'left' | 'right'; style?: React.CSSProperties; children?: ReactNode }
const Td = ({ align = 'left', style, children }: TdProps) =>
    <td style={{ textAlign: align, padding: '10px 12px', ...style }}>{children}</td>

function fmtDate(d: Date) { try { return d.toLocaleDateString() } catch { return '' } }
function fmtCurrency(n: number) { return n.toLocaleString('ru-RU', { style: 'currency', currency: 'KZT', maximumFractionDigits: 2 }) }
