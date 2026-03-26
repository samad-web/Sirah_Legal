import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[LexDraft] Uncaught error:', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/home'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle size={28} className="text-red-400" />
              </div>
            </div>

            <div className="space-y-2">
              <h2
                className="text-xl text-[#FAF7F0]"
                style={{ fontFamily: 'Cormorant Garamond, serif' }}
              >
                Something went wrong
              </h2>
              <p className="text-sm text-[#FAF7F0]/50" style={{ fontFamily: 'Lora, serif' }}>
                An unexpected error occurred. Your data is safe — try refreshing the page.
              </p>
              {this.state.error && (
                <p
                  className="text-[10px] text-[#FAF7F0]/25 mt-2 px-4 py-2 bg-[#1a1a1a] rounded border border-[#2a2a2a] break-all"
                  style={{ fontFamily: 'DM Mono, monospace' }}
                >
                  {this.state.error.message}
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-[#C9A84C]/40 text-[#C9A84C] rounded-md hover:bg-[#C9A84C]/10 transition-colors"
                style={{ fontFamily: 'DM Mono, monospace' }}
              >
                <RefreshCw size={14} />
                Try again
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-[#FAF7F0]/10 text-[#FAF7F0]/60 rounded-md hover:bg-[#FAF7F0]/5 transition-colors"
                style={{ fontFamily: 'DM Mono, monospace' }}
              >
                <Home size={14} />
                Go home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
