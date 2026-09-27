import { Send, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Sheet } from '../components/Sheet'
import { ThumbRow } from '../components/ThumbRow'
import { respond, SUGGESTIONS, type Memory, type Reply } from '../lib/assistant'
import { listFeedback, useCloset } from '../lib/closet'
import { learnAffinity, type Affinity } from '../lib/feedback'
import { useProfile } from '../lib/profile'
import { useWeather } from '../lib/useWeather'
import type { TripPrefill } from './TripsScreens'

type Message = { id: number; from: 'you' | 'drape'; text: string; reply?: Reply }

type Props = { onClose: () => void; onOpenPiece: (id: string) => void; onPlanTrip: (prefill: TripPrefill) => void }

/** "Ask Drape": an offline stylist that answers from your own closet. */
export function AssistantSheet({ onClose, onOpenPiece, onPlanTrip }: Props) {
  const { garments } = useCloset()
  const { profile } = useProfile()
  const { weather } = useWeather(profile.city)
  const [affinity, setAffinity] = useState<Affinity | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [memory, setMemory] = useState<Memory>({})
  const [text, setText] = useState('')
  const seq = useRef(0)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    void listFeedback().then((r) => {
      if (!cancelled) setAffinity(learnAffinity(r, new Map(garments.map((g) => [g.id, g]))))
    })
    return () => {
      cancelled = true
    }
  }, [garments])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  function ask(q: string) {
    const question = q.trim()
    if (!question) return
    const { reply, memory: next } = respond(question, { garments, profile, weather, affinity, now: new Date() }, memory)
    setMemory(next)
    setMessages((m) => [...m, { id: ++seq.current, from: 'you', text: question }, { id: ++seq.current, from: 'drape', text: reply.text, reply }])
    setText('')
  }

  return (
    <Sheet
      title="Ask Drape"
      onClose={onClose}
      footer={
        <form
          className="ask-form"
          onSubmit={(e) => {
            e.preventDefault()
            ask(text)
          }}
        >
          <input
            className="text-input"
            aria-label="Ask Drape"
            placeholder="e.g. What should I wear to a wedding?"
            value={text}
            maxLength={200}
            enterKeyHint="send"
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" className="btn primary ask-send" aria-label="Send" disabled={!text.trim()}>
            <Send size={18} aria-hidden="true" />
          </button>
        </form>
      }
    >
      <div className="chat">
        <div className="bubble drape">
          <p>
            <Sparkles size={14} aria-hidden="true" /> Hi{profile.name ? ` ${profile.name.split(' ')[0]}` : ''}! Ask me for an outfit, help packing, or what goes with a piece. I work from your closet, on your phone.
          </p>
        </div>
        {messages.length === 0 && (
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => ask(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.from}`}>
            <p>{m.text}</p>
            {m.reply?.kind === 'outfit' && (
              <>
                <ThumbRow garments={m.reply.outfit.pieces} onOpen={onOpenPiece} />
                <ul className="why-mini">
                  {m.reply.why.slice(0, 4).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <button type="button" className="chip" onClick={() => ask('another')}>
                  Show another
                </button>
              </>
            )}
            {m.reply?.kind === 'pieces' && <ThumbRow garments={m.reply.pieces} onOpen={onOpenPiece} />}
            {m.reply?.kind === 'trip' && (
              <button type="button" className="btn primary" onClick={() => onPlanTrip({ draft: m.reply?.kind === 'trip' ? m.reply.draft : undefined, placeQuery: m.reply?.kind === 'trip' ? m.reply.placeQuery : null })}>
                Plan this trip
              </button>
            )}
          </div>
        ))}
        <div ref={endRef} />
        <p className="muted small center">Works offline, from your own closet. No AI service sees your data.</p>
      </div>
    </Sheet>
  )
}
