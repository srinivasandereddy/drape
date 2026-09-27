import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/** Catches a crash in any screen and offers a reload instead of a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Drape crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="crash">
        <h1>Drape hit a problem</h1>
        <p className="muted">Your closet is still saved on this phone. Reload to carry on.</p>
        <pre className="crash-detail">{this.state.error.message}</pre>
        <button type="button" className="btn primary" onClick={() => location.reload()}>
          Reload Drape
        </button>
      </main>
    )
  }
}
