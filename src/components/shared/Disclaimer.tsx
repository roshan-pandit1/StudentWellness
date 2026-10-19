import { Info, ShieldCheck } from 'lucide-react'
export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return <aside className={`notice ${compact ? 'notice-compact' : ''}`} aria-label="Educational use disclaimer">
    <Info size={20} aria-hidden="true" />
    <div><strong>A moment of reflection, not a medical assessment.</strong><p>This tool is for educational use only. It cannot diagnose conditions or replace advice from a qualified professional.{!compact && ' A number cannot capture your whole well-being. If you are concerned about how you feel, consider talking with a trusted person or a qualified counselor.'}</p></div>
  </aside>
}
export function PrivacyNote() {
  return <p className="privacy-note"><ShieldCheck size={16} aria-hidden="true" /> No account. No tracking. Answers stay in this tab in demo mode.</p>
}
