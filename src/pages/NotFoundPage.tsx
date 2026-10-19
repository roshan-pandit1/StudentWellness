import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
export default function NotFoundPage() {
  return <div className="container empty-page"><span className="eyebrow">404 · A LITTLE OFF THE PATH</span><h1>Let’s find your way back.</h1><p>This page doesn’t exist. Your in-memory assessment is still available in this tab.</p><Button asChild><Link to="/">Return Home</Link></Button></div>
}
