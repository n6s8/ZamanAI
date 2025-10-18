import { useEffect, useMemo, useState } from 'react'
import { onStoreChange, store, type InsightState, calcBenchmarks } from '../lib/profile'

export const SidePanel = () => {
    const [st, setSt] = useState<InsightState>(() => store.get())
    useEffect(() => onStoreChange(() => setSt(store.get())), [])

    const saveField = <K extends keyof InsightState['profile']>(key: K, val: InsightState['profile'][K]) => {
        const cur = store.get()
        const nextProfile = { ...cur.profile, [key]: val }
        store.patch({ profile: nextProfile, benchmarks: calcBenchmarks(nextProfile) })
    }

    const spendBars = useMemo(() => {
        const s = st.benchmarks.spendShare
        return [
            { label: 'Базовые нужды', val: s.essentials },
            { label: 'Стиль жизни',   val: s.lifestyle },
            { label: 'Благотворит.',  val: s.charity },
            { label: 'Накопления',    val: s.savings }
        ]
    }, [st])

    const downloadTxt = () => {
        const txt = exportText(store.get())
        const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'zaman_memory.txt'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
    }

    return (
        <>
            <h3 style={{ marginTop: 0, color: 'var(--green)' }}>Профиль и аналитика</h3>

            <div className="card" style={{ padding: 12, background: '#fbfbf8', marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Профиль</div>
                <Field label="Имя">
                    <input className="input" placeholder="без имени"
                           value={st.profile.name ?? ''} onChange={e => saveField('name', e.target.value || undefined)} />
                </Field>
                <Field label="Возраст">
                    <input className="input" type="number" min={1} placeholder="—"
                           value={st.profile.age ?? ''} onChange={e => saveField('age', Number(e.target.value) || undefined)} />
                </Field>
                <Field label="Город">
                    <input className="input" placeholder="—"
                           value={st.profile.city ?? ''} onChange={e => saveField('city', e.target.value || undefined)} />
                </Field>
                <Field label="Доход (₸/мес)">
                    <input className="input" type="number" min={0} step={1000} placeholder="—"
                           value={st.profile.incomeMonthly ?? ''} onChange={e => saveField('incomeMonthly', Number(e.target.value) || undefined)} />
                </Field>
                <Field label="Цели">
                    <input className="input" placeholder="Хадж, Квартира"
                           value={(st.profile.goals ?? []).join(', ')}
                           onChange={e => saveField('goals', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
                </Field>
            </div>

            <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Сравнение с похожими</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{st.benchmarks.cohortLabel}</div>

                {spendBars.map((b) => (
                    <div key={b.label} style={{ margin: '6px 0' }}>
                        <div style={{ fontSize: 12, marginBottom: 2 }}>{b.label} — {b.val}%</div>
                        <div style={{ height: 8, background: '#eee', borderRadius: 999 }}>
                            <div style={{ width: `${b.val}%`, height: 8, borderRadius: 999, background: 'var(--green)' }} />
                        </div>
                    </div>
                ))}

                <div style={{ marginTop: 10, fontSize: 13 }}>
                    В среднем пользователи с похожим профилем ставят цели: {st.benchmarks.avgGoals.join(' • ')}.
                </div>
            </div>

            <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Память сеанса</div>
                {st.memory.length === 0 ? (
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Пока пусто. Сообщайте факты: «Доход 600 000», «Цель — Хадж» и т.д.</div>
                ) : (
                    <ul style={{ paddingLeft: 16, margin: 0, maxHeight: 220, overflow: 'auto' }}>
                        {[...st.memory].reverse().slice(0, 12).map(m => (
                            <li key={m.ts} style={{ fontSize: 13, margin: '6px 0' }}>
                <span style={{ opacity: 0.6, fontSize: 12 }}>
                  {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
                </span>
                                {m.text}
                            </li>
                        ))}
                    </ul>
                )}
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <button className="btn" onClick={() => store.resetAll()}>Очистить</button>
                    <button className="btn" onClick={downloadTxt}>Скачать .txt</button>
                </div>
            </div>
        </>
    )
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: 8, margin: '6px 0' }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
        <div>{children}</div>
    </div>
)

function exportText(s: InsightState) {
    const lines: string[] = []
    lines.push('# Профиль')
    lines.push(`Имя: ${s.profile.name ?? ''}`)
    lines.push(`Возраст: ${s.profile.age ?? ''}`)
    lines.push(`Город: ${s.profile.city ?? ''}`)
    lines.push(`Доход: ${s.profile.incomeMonthly ?? ''} ₸/мес`)
    lines.push(`Цели: ${(s.profile.goals ?? []).join(', ')}`)
    lines.push('')
    lines.push('# Память')
    s.memory.forEach(m => lines.push(`${new Date(m.ts).toISOString()}  ${m.text}`))
    return lines.join('\n')
}
