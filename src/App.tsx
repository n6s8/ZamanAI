// +++
import { useState } from 'react'
import type { Profile } from './lib/facts'
// +++

import {SpendAnalyzer} from './components/SpendAnalyzer'
import { SidePanel } from './components/SidePanel'
import { ChatWindow } from './components/ChatWindow'
import { QuickActions } from './components/QuickActions'
import { colors } from './theme'
import './App.css'

export const App = () => {
    // +++ состояние профиля и «памяти»
    const [profile, setProfile] = useState<Profile>({ goals: [] })
    const [memory, setMemory] = useState<string[]>([])
    // простая «сравнительная» метрика — пересчитываем на лету из профиля
    const peers = {
        baseline: 55,
        lifestyle: 20,
        charity: 5,
        savings: 20
    }
    // +++

    return (
        <>
            <div className="header">
                <div className="hbar">
                    <div className="logo">Ассистент Zaman Bank</div>
                    <div className="row">
                        <span className="pill"><span style={{width:8,height:8,background:colors.green,borderRadius:99}}/>online</span>
                        <button className="btn btn--green">Текст</button>
                        <button className="btn">Голос</button>
                    </div>
                </div>
            </div>

            <div className="container">
                <div className="card"><QuickActions/></div>

                {/* ЧАТ: прокидываем коллбеки для обновления правой колонки */}
                <div className="card" style={{ padding: 0 }}>
                    <ChatWindow
                        onFacts={(patch) => setProfile(prev => ({
                            goals: prev.goals || [],
                            ...prev,
                            ...patch,
                            // мердж целей
                            goals: Array.from(new Set([...(prev.goals || []), ...(patch.goals || [])]))
                        }))}
                        onRemember={(line) => setMemory(prev => [...prev, line])}
                        onClearMemory={() => setMemory([])}
                    />
                </div>

                {/* ПРАВАЯ КОЛОНКА: получаем актуальные profile/peers/memory */}
                <div className="card">
                    <SidePanel
                        profile={profile}
                        memory={memory}
                        peers={peers}
                        onClearMemory={() => setMemory([])}
                        onDownloadMemory={() => {
                            const blob = new Blob([memory.join('\n')], { type: 'text/plain;charset=utf-8' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = 'session-notes.txt'
                            a.click()
                            URL.revokeObjectURL(url)
                        }}
                    />
                </div>

                {/* Анализ выписки остаётся внизу/в конце, как просили */}
                <div className="card">
                    <SpendAnalyzer/>
                </div>
            </div>
        </>
    )
}
