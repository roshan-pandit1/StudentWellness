import { useEffect, useState } from 'react'
import { fetchModelInfo, type ServiceConfig } from '@/services/assessmentService'
import type { ModelInfo } from '@/services/modelContract'

export function useModelInfo(config: ServiceConfig | null) {
  const [state, setState] = useState<{ info: ModelInfo | null; error: string }>({ info: null, error: '' })
  const [attempt, setAttempt] = useState(0)
  const mode = config?.mode
  const baseUrl = config?.baseUrl
  useEffect(() => {
    if (mode !== 'live') return
    let active = true
    void fetchModelInfo({ mode, baseUrl }).then(info => {
      if (active) setState({ info, error: '' })
    }).catch((error: unknown) => {
      if (active) setState({ info: null, error: error instanceof Error ? error.message : 'Model information is unavailable.' })
    })
    return () => { active = false }
  }, [mode, baseUrl, attempt])
  function retry() { setState({ info: null, error: '' }); setAttempt(value => value + 1) }
  return { ...state, loading: mode === 'live' && !state.info && !state.error, retry }
}
