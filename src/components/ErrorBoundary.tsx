import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode; fallback?: ReactNode }
type State = { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-4 text-sm text-amber-950">
            <p className="font-medium">화면 일부를 표시하는 중 오류가 발생했습니다. 새로고침하거나 다시 시도해 주세요.</p>
            {this.state.error ? (
              <p className="mt-2 font-mono text-xs text-amber-900/90">{this.state.error.message}</p>
            ) : null}
            <button
              type="button"
              className="mt-3 rounded-md bg-amber-800 px-3 py-1.5 text-xs font-medium text-white"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              다시 시도
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
