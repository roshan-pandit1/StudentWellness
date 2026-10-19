import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Deliberately no telemetry or logging of application/assessment state.
    void _error; void _info
  }
  render() {
    if (this.state.failed) return <main className="container empty-page"><h1>Something interrupted this page.</h1><p>Please reload to start again. Reloading clears your in-memory answers.</p><Button onClick={() => window.location.reload()}>Reload application</Button></main>
    return this.props.children
  }
}
