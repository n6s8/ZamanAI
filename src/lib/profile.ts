// src/lib/profile.ts

export type UserProfile = {
    name?: string
    age?: number
    city?: string
    incomeMonthly?: number // ₸/мес
    goals?: string[]
}

export type MemoryItem = { ts: number; text: string }

export type Benchmarks = {
    cohortLabel: string
    spendShare: { essentials: number; lifestyle: number; charity: number; savings: number }
    avgGoals: string[]
}

export type InsightState = {
    profile: UserProfile
    memory: MemoryItem[]
    benchmarks: Benchmarks
}

const LS_KEY = 'zaman.profile.v1'

function load(): InsightState {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
        try { return JSON.parse(raw) } catch {}
    }
    const profile: UserProfile = { incomeMonthly: 550_000, goals: ['Хадж', 'Квартира'] }
    return { profile, memory: [], benchmarks: calcBenchmarks(profile) }
}

function save(s: InsightState) { localStorage.setItem(LS_KEY, JSON.stringify(s)) }

// Вернуть полностью пустое состояние (для «Очистить»)
function emptyState(): InsightState {
    const profile: UserProfile = {}
    return { profile, memory: [], benchmarks: calcBenchmarks(profile) }
}

export const store = {
    get(): InsightState { return load() },
    set(next: InsightState) { save(next); notify() },
    patch(patch: Partial<InsightState>) {
        const cur = load()
        const profile = { ...cur.profile, ...(patch.profile ?? {}) }
        const memory  = patch.memory ?? cur.memory
        const benchmarks = patch.benchmarks ?? calcBenchmarks(profile)
        const next: InsightState = { profile, memory, benchmarks }
        save(next); notify()
    },
    addMemory(text: string) {
        const cur = load()
        const mem = [...cur.memory, { ts: Date.now(), text }]
        save({ ...cur, memory: mem }); notify()
    },
    // ← Новый публичный метод: полный сброс профиля+памяти
    resetAll() {
        const next = emptyState()
        save(next); notify()
    }
}

// ===== Benchmarks =====
export function calcBenchmarks(p: UserProfile): Benchmarks {
    const age = p.age ?? 30
    const inc = p.incomeMonthly ?? 0

    const ageGroup =
        age < 25 ? 'до 25 лет' :
            age < 35 ? '25–34 лет' :
                age < 45 ? '35–44 лет' :
                    age < 55 ? '45–54 лет' : '55+ лет'

    const incK = inc / 1000
    let incomeLabel = 'доход <400 тыс ₸'
    if (incK >= 400 && incK < 700) incomeLabel = 'доход 400–700 тыс ₸'
    else if (incK >= 700 && incK < 1200) incomeLabel = 'доход 700 тыс – 1.2 млн ₸'
    else if (incK >= 1200) incomeLabel = 'доход 1.2–2.5 млн ₸'

    const base = { essentials: 55, lifestyle: 20, charity: 5, savings: 20 }
    const savingsBoost =
        incK >= 1200 ? 8 :
            incK >= 700  ? 4 : 0

    const spendShare = {
        essentials: Math.max(35, base.essentials - savingsBoost),
        lifestyle:  base.lifestyle,
        charity:    base.charity,
        savings:    Math.min(35, base.savings + savingsBoost)
    }

    const avgGoals =
        incK >= 1200 ? ['Инвестиции', 'Квартира', 'Путешествия'] :
            incK >= 700  ? ['Квартира', 'Автомобиль', 'Ремонт'] :
                ['Автомобиль', 'Обучение', 'Подушка безопасности']

    return {
        cohortLabel: `Пользователи ${ageGroup}, ${incomeLabel}`,
        spendShare, avgGoals
    }
}

// ===== Парсер фраз из чата =====
const DIGIT = /[\d\s.,]+/

export function rememberFromUtterance(utter: string) {
    if (!utter?.trim()) return
    const s = norm(utter)

    // Имя
    const name = s.match(/меня\s+зовут\s+([a-zа-яё\-]+)/i)
    if (name?.[1]) store.patch({ profile: { name: capitalize(name[1]) } })

    // Возраст
    const age = s.match(/(?:мне|возраст)\s+(\d{2})\b/)
    if (age?.[1]) store.patch({ profile: { age: Number(age[1]) } })

    // Город
    const city = s.match(/(?:я\s+из\s+города|я\s+из|город|в\s+городе)\s+([a-zа-яё\-]+(?:\s+[a-zа-яё\-]+)?)/i)
    if (city?.[1]) store.patch({ profile: { city: titleWords(city[1]) } })

    // Доход — диапазон
    const incomeRange = s.match(new RegExp(`(?:доход|зарплат[аы]|получаю)\\s*:?\\s*(${DIGIT.source})\\s*[-–—]\\s*(${DIGIT.source})`))
    if (incomeRange?.[1] && incomeRange?.[2]) {
        const a = parseMoney(incomeRange[1])
        const b = parseMoney(incomeRange[2])
        if (a && b) store.patch({ profile: { incomeMonthly: Math.round((a + b) / 2) } })
    } else {
        // Доход — одно значение
        const income = s.match(new RegExp(`(?:доход|зарплат[аы]|получаю)\\s*:?\\s*(${DIGIT.source}\\s*(?:тыс|к|млн|лям)?\\s*\\d*)`))
        if (income?.[1]) {
            const val = parseMoney(income[1])
            if (val) store.patch({ profile: { incomeMonthly: val } })
        }
    }

    // Цель
    const goal = s.match(/(?:цель|коплю\s+на|мечта)\s*[:\-—]?\s*([a-zа-яё0-9\s]+)/i)
    if (goal?.[1]) {
        const cur = store.get()
        const text = prettifyGoal(goal[1])
        const goals = new Set([...(cur.profile.goals ?? []), text])
        store.patch({ profile: { goals: Array.from(goals) } })
    }

    // Память
    store.addMemory(utter)
}

// «600к», «600 000», «1.2 млн», «лям 2»
function parseMoney(raw: string): number | undefined {
    let t = raw.toLowerCase().replaceAll(',', '.').replaceAll(/₸|т|тенге/g, '').trim()
    t = t.replaceAll(/\s+/g, ' ')
    const l = t.match(/лям\s*(\d+(?:\.\d+)?)/)
    if (l?.[1]) return Math.round(parseFloat(l[1]) * 1_000_000)

    const m = t.match(/(\d+(?:\.\d+)?)(?:\s*(млн|тыс|к))?/)
    if (!m) return undefined
    let x = parseFloat(m[1])
    const unit = m[2]
    if (unit === 'млн') x *= 1_000_000
    else if (unit === 'тыс' || unit === 'к') x *= 1_000
    return Math.round(x)
}

function prettifyGoal(s: string) {
    s = s.trim()
    if (/авто|машин/.test(s)) return 'Автомобиль'
    if (/квартир/.test(s))   return 'Квартира'
    return capitalize(s)
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
function titleWords(x: string) { return x.trim().split(/\s+/).map(capitalize).join(' ') }
function norm(s: string) { return s.toLowerCase().replaceAll(/\u00A0/g, ' ') }

// ==== events ====
const BUS = 'zaman:memory-update'
function notify() { window.dispatchEvent(new CustomEvent(BUS)) }
export function onStoreChange(cb: () => void) {
    window.addEventListener(BUS, cb)
    return () => window.removeEventListener(BUS, cb)
}
