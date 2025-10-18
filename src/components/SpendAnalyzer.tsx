// src/components/SpendAnalyzer.tsx
import { useMemo, useState, type ReactNode } from 'react'
import { parseTransactions, type Tx } from '../lib/spend'

export const SpendAnalyzer = () => {
    const [txs, setTxs] = useState<Tx[]>([])
    const [hint, setHint] = useState<string>('Загрузите CSV или PDF (текстовый, не скан).')
    const [sortKey, setSortKey] = useState<'date' | 'description' | 'amount'>('date')
    const [sortDir, setSortDir] = useState<SortDir>('desc')
    const [query, setQuery] = useState<string>('')

    async function onFile(f: File) {
        const name = f.name.toLowerCase()

        // PDF -> сервер
        if (name.endsWith('.pdf')) {
            setHint(`Читаю PDF: ${f.name} ...`)
            const form = new FormData()
            form.append('file', f)
            try {
                const r = await fetch('/api/spend/pdf', { method: 'POST', body: form })
                const data = await r.json()
                if (!r.ok) {
                    setHint(`PDF ошибка: ${data?.error || r.status}`)
                    setTxs([])
                    return
                }
                const parsed: Tx[] = (data?.txs || []).map((t: any) => ({
                    date: new Date(t.date),
                    description: String(t.description || '-'),
                    amount: Number(t.amount || 0),
                }))
                if (!parsed.length) {
                    setHint('Из PDF ничего не извлечено. Возможно, это скан (нужен OCR).')
                    setTxs([])
                    return
                }
                setTxs(parsed)
                setHint(`Импортировано операций: ${parsed.length}`)
            } catch (e: any) {
                setHint(`PDF ошибка сети/сервера: ${e?.message ?? String(e)}`)
                setTxs([])
            }
            return
        }

        // CSV -> локальный парсер
        setHint(`Читаю CSV: ${f.name} ...`)
        try {
            const text = await f.text()
            const parsed = parseTransactions(text)
            if (parsed.length === 0) {
                setHint('Не удалось распознать CSV. Проверьте, чтобы это был именно CSV (не PDF).')
                setTxs([])
                return
            }
            setTxs(parsed)
            setHint(`Импортировано операций: ${parsed.length}`)
        } catch (e: any) {
            setHint(`CSV ошибка: ${e?.message ?? String(e)}`)
            setTxs([])
        }
    }

    // Сводка — только из txs, без analyze()
    const summary = useMemo(() => {
        const income = txs.reduce((s, t) => (t.amount > 0 ? s + t.amount : s), 0)
        const expenses = txs.reduce((s, t) => (t.amount < 0 ? s + t.amount : s), 0) // отрицательное число
        const balance = income + expenses
        return {
            count: txs.length,
            income,
            expenses,
            balance,
        }
    }, [txs])

    // фильтр + сортировка
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        const arr = q
            ? txs.filter(t => t.description.toLowerCase().includes(q))
            : txs.slice()

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
        if (sortKey !== key) {
            setSortKey(key)
            setSortDir('desc')
            return
        }
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    }

    return (
        <div>
            <h3 style={{ marginTop: 0, color: 'var(--green)' }}>Анализ выписки</h3>

            {/* загрузчик */}
            <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                    e.preventDefault()
                    const f = e.dataTransfer.files?.[0]
                    if (f) void onFile(f)
                }}
                style={{
                    padding: 16,
                    border: '2px dashed #ddd',
                    borderRadius: 12,
                    textAlign: 'center',
                    background: '#fbfbf8',
                    marginBottom: 12,
                }}
            >
                <div style={{ marginBottom: 8, fontWeight: 600 }}>
                    Перетащите CSV или PDF сюда либо выберите файл
                </div>
                <input
                    type="file"
                    accept=".csv,application/pdf"
                    onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) void onFile(f)
                    }}
                />
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>{hint}</div>
            </div>

            {/* поиск + сводка */}
            {txs.length > 0 && (
                <div
                    style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        marginBottom: 12,
                        flexWrap: 'wrap',
                    }}
                >
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
                </div>
            )}

            {/* таблица */}
            {filtered.length === 0 ? (
                <div style={{ fontSize: 13, opacity: 0.8 }}>Пока нет данных.</div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                        <tr>
                            <Th onClick={() => toggleSort('date')} active={sortKey === 'date'} dir={sortDir}>
                                Дата
                            </Th>
                            <Th
                                onClick={() => toggleSort('description')}
                                active={sortKey === 'description'}
                                dir={sortDir}
                            >
                                Описание
                            </Th>
                            <Th
                                onClick={() => toggleSort('amount')}
                                active={sortKey === 'amount'}
                                dir={sortDir}
                                align="right"
                            >
                                Сумма
                            </Th>
                        </tr>
                        </thead>
                        <tbody>
                        {filtered.map((t, i) => (
                            <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                                <Td>{fmtDate(t.date)}</Td>
                                <Td>{t.description}</Td>
                                <Td align="right" style={{ color: t.amount < 0 ? '#b23' : '#2a6' }}>
                                    {fmtCurrency(t.amount)}
                                </Td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

/* ---------- helpers UI ---------- */

type SortDir = 'asc' | 'desc'

type StatProps = { label: string; children?: ReactNode }
const Stat = ({ label, children }: StatProps) => (
    <div style={{ background: '#fbfbf8', padding: '10px 12px', borderRadius: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{label}</div>
        <div style={{ fontWeight: 700 }}>{children}</div>
    </div>
)

type ThProps = {
    onClick: () => void
    active: boolean
    dir: SortDir
    align?: 'left' | 'right'
    children?: ReactNode
}
const Th = ({ onClick, active, dir, align = 'left', children }: ThProps) => (
    <th
        onClick={onClick}
        style={{
            textAlign: align,
            cursor: 'pointer',
            padding: '10px 12px',
            userSelect: 'none',
            borderBottom: '1px solid #eee',
            whiteSpace: 'nowrap',
        }}
    >
        <span>{children}</span>
        <span style={{ opacity: active ? 1 : 0.25, marginLeft: 6 }}>{dir === 'asc' ? '▲' : '▼'}</span>
    </th>
)

type TdProps = {
    align?: 'left' | 'right'
    style?: React.CSSProperties
    children?: ReactNode
}
const Td = ({ align = 'left', style, children }: TdProps) => (
    <td style={{ textAlign: align, padding: '10px 12px', ...style }}>{children}</td>
)

/* ---------- formatters ---------- */

function fmtDate(d: Date) {
    try {
        return d.toLocaleDateString()
    } catch {
        return ''
    }
}
function fmtCurrency(n: number) {
    return n.toLocaleString('ru-RU', {
        style: 'currency',
        currency: 'KZT',
        maximumFractionDigits: 2,
    })
}
