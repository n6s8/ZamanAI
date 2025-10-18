export const QuickActions = () => {
    const actions = [
        {label:'Создать цель', prompt:'Создай цель: Хадж, 3 000 000 ₸ до 2026-07-01. Распиши помесячно.'},
        {label:'Анализ трат по CSV', prompt:'Проанализируй мой CSV: категории, инсайты, 3 оптимизации.'},
        {label:'Подбор продуктов (халяль)', prompt:'Предложи 3 халяль-продукта под цель “Квартира 12 000 000 ₸ на 2030-01-01”.'},
        {label:'Совет по экономии', prompt:'Дай 5 способов снизить траты на еду на 15% без потери качества.'}
    ]
    const send = (p:string)=>window.dispatchEvent(new CustomEvent('quick:prompt',{detail:p}))
    return (
        <>
            <h3 style={{margin:'0 0 12px'}}>Быстрые действия</h3>
            <div className="row">
                {actions.map(a=>(
                    <button key={a.label} className="btn" onClick={()=>send(a.prompt)}>{a.label}</button>
                ))}
            </div>
            <div style={{marginTop:16,fontSize:12,color:'var(--muted)'}}>Подсказка: нажми любую кнопку, чтобы вставить промпт в поле ввода.</div>
        </>
    )
}
