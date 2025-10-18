// src/lib/facts.ts
export type Profile = {
    name?: string
    age?: number
    city?: string
    incomeMonthly?: number
    goals?: string[]
}

function norm(s: string) {
    return s.replace(/\s+/g, ' ').trim()
}

// Нормализация города из "Шымкента" -> "Шымкент" (простая эвристика)
function normalizeCity(raw: string): string {
    let c = (raw || '').trim()

    // Не трогаем "Алматы/Almaty"
    if (/^(алматы|almaty)$/i.test(c)) return cap(c)

    // Частые рус/каз окончания род./дат. падежей: а/я/е/у/ю/ы/и
    if (/[аяеуюыи]$/i.test(c) && c.length > 4) c = c.slice(0, -1)

    return cap(c)
}

function cap(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1)
}

// "600-700 тысяч", "1,2 млн", "500000" -> число
function parseAmount(s: string, unit?: string): number | null {
    let str = (s || '').replace(/\s/g, '').replace(',', '.')
    const range = str.match(/^([\d.]+)\s*[-–—]\s*([\d.]+)$/)
    let val: number
    if (range) {
        const a = parseFloat(range[1])
        const b = parseFloat(range[2])
        if (!isFinite(a) || !isFinite(b)) return null
        val = (a + b) / 2
    } else {
        const num = parseFloat(str)
        if (!isFinite(num)) return null
        val = num
    }
    const u = (unit || '').toLowerCase()
    if (/млн|мил/i.test(u)) val *= 1_000_000
    else if (/тыс|тысяч/i.test(u)) val *= 1_000
    return Math.round(val)
}

export function extractFacts(text: string): Partial<Profile> {
    const p: Partial<Profile> = {}
    const t = text

    // ---- ИМЯ ----
    {
        const m =
            /(меня\s+зовут|зовут\s+меня)\s+([А-ЯЁA-Z][а-яёa-z-]+)/iu.exec(t) ||
            /\bя\s+([А-ЯЁA-Z][а-яёa-z-]+)\b/iu.exec(t)
        if (m) p.name = cap(m[2] || m[1])
    }

    // ---- ВОЗРАСТ ----
    {
        const m = /(?:мне|возраст)\s+(\d{1,2})\b/iu.exec(t)
        if (m) p.age = Number(m[1])
    }

    // ---- ГОРОД ----
    // 1) "из города Шымкент" / "город Шымкент" / "в г. Шымкент"
    let mCity =
        /(из\s+города|город[ауе]?|в\s+г\.?)\s*([А-ЯЁA-Z][А-ЯЁA-Zа-яёa-z-]+)/iu.exec(t)

    // 2) "из Шымкента" / "из г. Шымкента"
    if (!mCity) mCity = /(из\s+г\.?|из)\s+([А-ЯЁA-Z][А-ЯЁA-Zа-яёa-z-]+)/iu.exec(t)

    // 3) Обратный порядок: "Шымкента город" / "Шымкент город"
    if (!mCity) mCity = /([А-ЯЁA-Z][А-ЯЁA-Zа-яёa-z-]+)\s+город/iu.exec(t)

    if (mCity) {
        const rawCity = mCity[2] || mCity[1]
        if (rawCity) p.city = normalizeCity(rawCity)
    }

    // ---- ДОХОД (месячный) ----
    {
        const m =
            /(доход(?:\s+месячный)?|зарплата|получаю|зарабатываю)[^0-9\-]{0,15}(\d[\d\s.,]*(?:\s*[-–—]\s*\d[\d\s.,]*)?)\s*(тысяч[аи]?|тыс\.?|млн|миллион[а-я]*|мил\.)?\s*(?:тенге|т|₸)?/iu.exec(
                t
            )
        if (m) {
            const amount = parseAmount(m[2], m[3])
            if (amount) p.incomeMonthly = amount
        }
    }

    // ---- ЦЕЛИ ----
    {
        const goals: string[] = []
        const gRe = /(цель|хочу|планирую|мечтаю|стремлюсь)\s+([^.!\n]+)/giu
        let gm: RegExpExecArray | null
        while ((gm = gRe.exec(t))) {
            const g = norm(gm[2])
            if (g) goals.push(g)
        }
        if (goals.length) p.goals = goals
    }

    return p
}
