import React, { useState } from 'react'
import { useRecorder } from '../lib/useRecorder'

type Props = { onText: (t: string) => void }

export const VoiceControls: React.FC<Props> = ({ onText }) => {
    const { recording, start, stopAndGetText, reset } = useRecorder()
    const [hint, setHint] = useState<string>('') // сообщение пользователю
    const [busy, setBusy] = useState(false)      // статус отправки

    async function handleClick() {
        setHint('')

        if (!recording) {
            // начало записи
            try {
                await start()
                setHint('🎙 Идёт запись...')
            } catch (e: any) {
                setHint(e?.message ?? 'Нет доступа к микрофону')
            }
            return
        }

        // остановка записи и распознавание
        setBusy(true)
        setHint('⏳ Распознаю...')
        try {
            const text = await stopAndGetText() // useRecorder сам отправит /api/stt
            if (text.trim()) {
                onText(text)
                reset()
                setHint('✅ Готово')
                setTimeout(() => setHint(''), 1500)
            } else {
                setHint('⚠️ Пустой ответ от STT')
            }
        } catch (e: any) {
            setHint(e?.message ?? 'Ошибка распознавания')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
                type="button"
                className="btn"
                onClick={handleClick}
                disabled={busy}
                title={recording ? 'Остановить и распознать' : 'Начать запись'}
            >
                {recording ? '⏹' : '🎤'}
            </button>

            {hint && (
                <span style={{ fontSize: 12, opacity: 0.8 }}>
          {hint}
        </span>
            )}
        </div>
    )
}
