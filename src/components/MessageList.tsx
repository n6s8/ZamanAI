export type Msg={id:string;role:'user'|'assistant';content:string}
export const MessageList=({items}:{items:Msg[]})=>{
    return (
        <div className="scroll" style={{padding:16}}>
            {items.map(m=>(
                <div key={m.id} className={`msg ${m.role}`}>
                    <div className="bubble" dangerouslySetInnerHTML={{__html:m.content.replace(/\n/g,'<br/>')}} />
                </div>
            ))}
        </div>
    )
}
