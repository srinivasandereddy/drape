import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { DOSHA_GUIDE, DOSHA_ORDER, DOSHA_QUESTIONS, doshaLabel, scoreDosha, type DoshaId, type DoshaResult } from '../lib/dosha'

type Props = { onDone: (result: DoshaResult) => void; onSkip?: () => void }

/** The 10-question quiz, one question per screen. */
export function DoshaQuiz({ onDone, onSkip }: Props) {
  const [answers, setAnswers] = useState<DoshaId[]>([])
  const i = answers.length
  const q = DOSHA_QUESTIONS[i]

  if (!q) return null

  const answer = (d: DoshaId) => {
    const next = [...answers, d]
    if (next.length === DOSHA_QUESTIONS.length) onDone(scoreDosha(next))
    else setAnswers(next)
  }

  return (
    <div className="stack quiz">
      <div className="quiz-progress" aria-hidden="true">
        <i style={{ width: `${(i / DOSHA_QUESTIONS.length) * 100}%` }} />
      </div>
      <p className="muted small mono">
        Question {i + 1} of {DOSHA_QUESTIONS.length}
      </p>
      <h3 className="quiz-q">{q.topic}</h3>
      <div className="quiz-options" role="group" aria-label={q.topic}>
        {q.options.map((text, k) => (
          <button key={text} type="button" className="quiz-option" onClick={() => answer(DOSHA_ORDER[k]!)}>
            {text}
          </button>
        ))}
      </div>
      <div className="row-actions">
        {i > 0 && (
          <button type="button" className="btn" onClick={() => setAnswers(answers.slice(0, -1))}>
            <ChevronLeft size={18} aria-hidden="true" /> Back
          </button>
        )}
        {onSkip && (
          <button type="button" className="btn" onClick={onSkip}>
            Skip the quiz
          </button>
        )}
      </div>
      <p className="muted small">Traditional Ayurveda guidance for comfort and color. It is not medical advice.</p>
    </div>
  )
}

/** Scores and clothing guidance for a finished quiz. */
export function DoshaResultCard({ result }: { result: DoshaResult }) {
  const g = DOSHA_GUIDE[result.primary]
  const total = DOSHA_QUESTIONS.length
  return (
    <div className="stack dosha-result">
      <div className="stack-sm">
        <p className="muted small">Your constitution</p>
        <h3 className="dosha-name">{doshaLabel(result)}</h3>
        <p className="muted small">{g.element}</p>
      </div>
      <div className="dosha-bars">
        {DOSHA_ORDER.map((d) => (
          <div key={d} className="dosha-bar">
            <span>{DOSHA_GUIDE[d].label}</span>
            <span className="dosha-track">
              <i className={`dosha-fill ${d}`} style={{ width: `${(result.scores[d] / total) * 100}%` }} />
            </span>
            <span className="mono">{result.scores[d]}</span>
          </div>
        ))}
      </div>
      <dl className="guide">
        <div>
          <dt>Body temperature</dt>
          <dd>{g.tendency}</dd>
        </div>
        <div>
          <dt>Fabrics</dt>
          <dd>{g.fabrics.join(', ')}</dd>
        </div>
        <div>
          <dt>Colors</dt>
          <dd>{g.colors}</dd>
        </div>
        <div>
          <dt>Silhouettes</dt>
          <dd>{g.silhouettes}</dd>
        </div>
        <div>
          <dt>Go easy on</dt>
          <dd>{g.avoid}</dd>
        </div>
      </dl>
    </div>
  )
}
