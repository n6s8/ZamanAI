// src/components/ChatWindow.tsx
import React, { useState } from 'react'
import { MessageList, type Msg } from './MessageList'
import { MessageInput } from './MessageInput'
import { chat } from '../lib/chat'
import { tts } from '../lib/tts'
import { extractFacts, type Profile } from '../lib/facts'
import { store, calcBenchmarks } from '../lib/profile'

/** Безопасно записывает строку в store.memory (если нет store.remember) */
function rememberSafe(text: string) {
    // @ts-ignore — если есть метод remember, используем его
    if (typeof (store as any).remember === 'function') {
        // @ts-ignore
        (store as any).remember(text)
        return
    }
    const cur = store.get()
    const mem = Array.isArray(cur.memory) ? cur.memory.slice() : []
    mem.push({ ts: Date.now(), text })
    store.patch({ memory: mem })
}

/** Патч фактов в профиль и пересчёт бенчмарков */
function patchFacts(patch: Partial<Profile>) {
    if (!patch || Object.keys(patch).length === 0) return
    const cur = store.get()
    const nextProfile: Profile = { ...cur.profile, ...patch }
    store.patch({ profile: nextProfile, benchmarks: calcBenchmarks(nextProfile) })
}

export const ChatWindow: React.FC = () => {
    const [items, setItems] = useState<Msg[]>([])
    const [voiceOn, setVoiceOn] = useState<boolean>(true)
    const [ttsHint, setTtsHint] = useState<string>('')

    /** Отправка запроса в модель + обновление памяти/профиля + TTS */
    const send = async (text: string) => {
        const userMsg: Msg = { id: crypto.randomUUID(), role: 'user', content: text }
        setItems(prev => [...prev, userMsg])

        // Память/факты с пользовательского ввода
        rememberSafe(`🧑 ${text}`)
        patchFacts(extractFacts(text))

        let acc = ''
        const stream = await chat([...items, userMsg])

        for await (const chunk of stream) {
            acc += chunk
            setItems(prev => {
                const last = prev[prev.length - 1]
                if (last?.role === 'assistant') {
                    last.content += chunk
                    return [...prev.slice(0, -1), last]
                }
                return [...prev, { id: crypto.randomUUID(), role: 'assistant', content: chunk }]
            })
        }

        // Память/факты с ответа ассистента
        if (acc.trim()) {
            rememberSafe(`🤖 ${acc}`)
            patchFacts(extractFacts(acc))
        }

        // Озвучивание
        if (voiceOn && acc.trim()) {
            const r = await tts.speak(acc, { voice: 'alloy', format: 'mp3' })
            if (!r.ok) setTtsHint(`TTS: ${r.error ?? 'ошибка'}`)
            else setTtsHint(r.used === 'server' ? 'Озвучивание: сервер' : 'Озвучивание: браузер (Web Speech)')
        }
    }

    /** Повтор последнего ответа ассистента */
    const replay = async () => {
        const lastAssistant = [...items].reverse().find(m => m.role === 'assistant')
        if (!lastAssistant?.content?.trim()) return
        await tts.speak(lastAssistant.content, { voice: 'alloy', format: 'mp3' })
    }

    /** Пауза/продолжить TTS */
    const togglePause = async () => {
        const { mode } = tts.state()
        if (mode === 'playing') await tts.pause()
        else if (mode === 'paused') await tts.resume()
    }

    /** Остановить озвучивание */
    const stop = async () => { await tts.stop() }

    const { mode } = tts.state()
    const pauseTitle = mode === 'paused' ? 'Продолжить' : 'Пауза'
    const pauseIcon = mode === 'paused' ? '⏯️ Продолжить' : '⏸️ Пауза'

    return (
        <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', height: '100%' }}>
            {/* Верхняя панель действий чата */}
            <div
                style={{
                    padding: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #eee',
                    gap: 12
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontWeight: 700, color: 'var(--green)' }}>Чат</div>
                    <span className="badge">active</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                        type="button"
                        className="btn"
                        onClick={() => setVoiceOn(v => !v)}
                        title="Озвучивание ответов"
                    >
                        {voiceOn ? '🔊 Голос: Вкл' : '🔇 Голос: Выкл'}
                    </button>

                    <button type="button" className="btn" onClick={replay} title="Произнести последний ответ">
                        ▶️ Повтор
                    </button>

                    <button type="button" className="btn" onClick={togglePause} title={pauseTitle}>
                        {pauseIcon}
                    </button>

                    <button type="button" className="btn" onClick={stop} title="Стоп">
                        ⏹️ Стоп
                    </button>
                </div>
            </div>

            {/* Список сообщений */}
            <MessageList items={items} />

            {/* Подсказки TTS */}
            {ttsHint && (
                <div style={{ padding: '6px 12px', fontSize: 12, opacity: 0.75 }}>{ttsHint}</div>
            )}

            {/* Поле ввода */}
            <MessageInput onSend={send} />
        </div>
    )
}
