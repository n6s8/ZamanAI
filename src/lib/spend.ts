// src/lib/spend.ts

export type Tx = {
    date: Date
    description: string
    amount: number // >0 доход, <0 расход, в тенге
    raw?: Record<string, string>
}

export type Breakdown = {
    income: number
    expense: number
    net: number
    byMonth: { ym: string; income: number; expense: number }[]
    byCategory: { cat: string; sum: number }[]
    tips: string[]
}

const guessDelimiter = (head: string) =>
    (head.match(/;/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? ';' : ','

const stripQuotes = (s: string) => s.replace(/^"(.*)"$/, '$1').trim()

// Очень терпимый CSV-парсер (без внешних либ)
export function parseCsv(text: string): string[][] {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length)
    if (lines.length === 0) return []
    const delim = guessDelimiter(lines[0])
    return lines.map(l => {
        // простой сплит с учётом кавычек
        const out: string[] = []
        let cur = '', quoted = false
        for (let i = 0; i < l.length; i++) {
            const ch = l[i]
            if (ch === '"') {
                quoted = !quoted
                continue
            }
            if (ch === delim && !quoted) {
                out.push(stripQuotes(cur))
                cur = ''
            } else cur += ch
        }
        out.push(stripQuotes(cur))
        return out
    })
}

function parseKaspiHeaders(cols: string[]) {
    // Частые названия колонок у Kaspi/Halyk и т.п.
    const lc = cols.map(c => c.toLowerCase())
    return {
        idxDate: lc.findIndex(c => /date|дата/.test(c)),
        idxDesc: lc.findIndex(c => /(description|назначение|категория|details|контрагент)/.test(c)),
        idxAmount:
            lc.findIndex(c => /(amount|сумма|итого|total)/.test(c)),
        idxCredit: lc.findIndex(c => /(credit|поступление|приход)/.test(c)),
        idxDebit: lc.findIndex(c => /(debit|списание|расход)/.test(c)),
        idxCurrency: lc.findIndex(c => /(currency|валюта)/.test(c)),
    }
}

function toNumber(s: string) {
    if (!s) return 0
    const t = s.replace(/\s/g, '').replace(/₸|тг|tg/gi, '').replace(',', '.')
    const m = t.match(/-?\d+(\.\d+)?/)
    return m ? Number(m[0]) : 0
}

function parseDateAny(s: string): Date | null {
    // "2024-11-02", "02.11.2024", "02/11/2024 12:33"
    const t = s.trim()
    const d1 = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (d1) return new Date(Number(d1[1]), Number(d1[2]) - 1, Number(d1[3]))
    const d2 = t.match(/^(\d{2})[./](\d{2})[./](\d{4})/)
    if (d2) return new Date(Number(d2[3]), Number(d2[2]) - 1, Number(d2[1]))
    const d = new Date(t)
    return isNaN(d.getTime()) ? null : d
}

export function parseTransactions(text: string): Tx[] {
    const rows = parseCsv(text)
    if (rows.length <= 1) return []
    const header = rows[0]
    const map = parseKaspiHeaders(header)
    const txs: Tx[] = []

    for (let i = 1; i < rows.length; i++) {
        const r = rows[i]
        const dateStr = r[map.idxDate] ?? r[0]
        const descStr = r[map.idxDesc] ?? r[1] ?? ''
        const curr = (r[map.idxCurrency] || '').toUpperCase()
        let amount = 0

        if (map.idxAmount >= 0) {
            amount = toNumber(r[map.idxAmount])
        } else {
            // Классическая схема: есть приход и расход раздельно
            const credit = map.idxCredit >= 0 ? toNumber(r[map.idxCredit]) : 0
            const debit  = map.idxDebit  >= 0 ? toNumber(r[map.idxDebit])  : 0
            amount = credit !== 0 ? credit : -Math.abs(debit)
        }

        // Валюта: всё приводим к тенге. Если не тенге — оставим как есть (предположим тенге)
        if (curr && !/KZT|₸|Т|ТГ/.test(curr)) {
            // тут можно подключить курс, но оставим как есть
        }

        const date = parseDateAny(dateStr)
        if (!date) continue
        if (!isFinite(amount) || amount === 0) continue

        txs.push({
            date, description: descStr || '-', amount,
            raw: Object.fromEntries(header.map((h, j) => [h, r[j] ?? ''])),
        })
    }
    return txs.sort((a, b) => a.date.getTime() - b.date.getTime())
}

// Категоризация по ключевым словам
export function guessCategory(t: Tx): string {
    const s = (t.description || '').toLowerCase()
    const rules: [RegExp, string][] = [
        [/(beeline|tele2|kcell|activ|altel|telekom|телеком|сотов|связь)/, 'Связь'],
        [/(spotify|netflix|youtube|yandex plus|music|ivi|okko| подписк)/, 'Подписки'],
        [/(яндекс|yandex taxi|inDrive|bolt|такси|транспорт|автобус|metro)/, 'Транспорт'],
        [/(magnum|small|anvar|supermarket|market|гипер|продукт)/, 'Продукты'],
        [/(cof+e|кофе|кофейня|cafe|кафе|restaurant|ресторан|еда|eat)/, 'Кафе'],
        [/(kaspi red|рассрочка|percent|процент|комиссия)/, 'Проценты/комиссии'],
        [/(air|aviakassa|rail|жд|билет|отель|hotel|booking|travel)/, 'Путешествия'],
        [/(sport|fitness|фитнес|зал|gym)/, 'Спорт/ЗОЖ'],
        [/(apteka|аптека|medicine|врач)/, 'Здоровье'],
        [/(fashion|odezhd|одежд|обув|h&m|zara|lc waikiki)/, 'Одежда'],
        [/(elec|электроник|sulpak|technodom|mechta)/, 'Электроника'],
        [/(withdrawal|наличн|снятие|cash)/, 'Наличные'],
        [/(перевод|p2p|p2p transfer|to card)/, 'Переводы'],
    ]
    for (const [re, cat] of rules) if (re.test(s)) return cat
    return t.amount > 0 ? 'Доход' : 'Прочее'
}

export function analyze(txs: Tx[]): Breakdown {
    const byMonthMap = new Map<string, { income: number; expense: number }>()
    const byCat = new Map<string, number>()
    let income = 0, expense = 0

    for (const t of txs) {
        const ym = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`
        const m = byMonthMap.get(ym) || { income: 0, expense: 0 }
        if (t.amount > 0) { m.income += t.amount; income += t.amount }
        else { m.expense += -t.amount; expense += -t.amount }
        byMonthMap.set(ym, m)

        const cat = guessCategory(t)
        byCat.set(cat, (byCat.get(cat) || 0) + (t.amount > 0 ? 0 : -t.amount))
    }

    const byMonth = [...byMonthMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([ym, v]) => ({ ym, income: Math.round(v.income), expense: Math.round(v.expense) }))

    const byCategory = [...byCat.entries()]
        .filter(([c]) => c !== 'Доход')
        .sort((a, b) => b[1] - a[1])
        .map(([cat, sum]) => ({ cat, sum: Math.round(sum) }))

    const tips = buildTips({ income, expense, byCategory, byMonth })

    return {
        income: Math.round(income),
        expense: Math.round(expense),
        net: Math.round(income - expense),
        byMonth,
        byCategory,
        tips
    }
}

function buildTips(d: { income: number; expense: number; byCategory: { cat: string; sum: number }[]; byMonth: { ym: string; expense: number }[] }): string[] {
    const tips: string[] = []
    const rate = d.income > 0 ? 100 * (d.income - d.expense) / d.income : 0
    if (rate < 10) tips.push('Низкая норма сбережений (<10%). Попробуйте правило 50/30/20 или задайте фиксированную автоперевод-копилку.')

    const top = d.byCategory.slice(0, 3)
    if (top[0]) tips.push(`Самая крупная категория — **${top[0].cat}** (${fmt(top[0].sum)}). Проверьте регулярные платежи и ищите акции.`)
    if (top.find(c => c.cat === 'Подписки')) tips.push('Подписки: отключите неиспользуемые, сведите к годовому тарифу — так дешевле.')

    // всплески расходов по месяцам
    const last3 = d.byMonth.slice(-3)
    if (last3.length === 3) {
        const avgPrev = (last3[0].expense + last3[1].expense) / 2
        if (avgPrev && last3[2].expense > avgPrev * 1.3) {
            tips.push('В последний месяц расходы выросли >30% к среднему — проверьте разовые крупные траты.')
        }
    }

    return tips
}

export const fmt = (n: number) =>
    new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(n) + ' ₸'
