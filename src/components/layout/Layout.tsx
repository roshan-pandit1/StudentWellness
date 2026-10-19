import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ArrowUpRight, Leaf, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return <><NavLink to="/" end onClick={onNavigate}>Home</NavLink><Link to="/#how-it-works" onClick={onNavigate}>How It Works</Link><NavLink to="/about" onClick={onNavigate}>About</NavLink><Button asChild size="sm"><Link to="/assessment" onClick={onNavigate}>Get Started <ArrowUpRight size={16} aria-hidden="true" /></Link></Button></>
}
export function Layout() {
  const [menuLocation, setMenuLocation] = useState<string | null>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const { pathname, hash, key } = useLocation()
  // Reset a disclosure from a previous history entry, including browser Back/Forward.
  if (menuLocation !== null && menuLocation !== key) setMenuLocation(null)
  const open = menuLocation === key
  const closeMenu = () => setMenuLocation(null)
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 601px)')
    const closeOnDesktop = () => { if (desktop.matches) setMenuLocation(null) }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])
  const firstRender = useRef(true)
  useEffect(() => {
    const titles: Record<string, string> = { '/': 'A little insight. A little more balance.', '/assessment': 'Your assessment', '/results': 'Your wellness insights', '/about': 'About this project' }
    document.title = `${titles[pathname] || 'Page not found'} | Student Wellness Insights`
    if (hash) {
      const target = document.getElementById(hash.slice(1))
      target?.scrollIntoView(); target?.focus()
    } else if (!firstRender.current) {
      window.scrollTo(0, 0)
      document.querySelector<HTMLElement>('main')?.focus()
    }
    firstRender.current = false
  }, [pathname, hash])
  return <>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand" aria-label="Student Wellness Insights home" onClick={() => closeMenu()}><span className="brand-icon"><Leaf size={23} aria-hidden="true" /></span><span>Student Wellness<span className="brand-sub">INSIGHTS</span></span></Link>
        <nav className="desktop-nav" aria-label="Main navigation"><Navigation /></nav>
        <Button ref={toggleRef} variant="ghost" size="icon" className="menu-toggle" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setMenuLocation(open ? null : key)} onKeyDown={event => { if (event.key === 'Escape') closeMenu() }}>{open ? <X /> : <Menu />}</Button>
      </div>
      {open && <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation" onKeyDown={event => { if (event.key === 'Escape') { closeMenu(); toggleRef.current?.focus() } }}><Navigation onNavigate={() => closeMenu()} /></nav>}
    </header>
    <main id="main-content" tabIndex={-1}><Outlet /></main>
    <footer className="site-footer"><div className="container footer-top"><div><Link to="/" className="footer-brand"><Leaf size={20} aria-hidden="true" /> Student Wellness Insights</Link><p>Small reflections. Meaningful everyday habits.</p></div><nav aria-label="Footer navigation"><Link to="/assessment">Assessment</Link><Link to="/about">About & privacy</Link><a href="https://github.com/tanishq-latent/Mental-Health-Score" target="_blank" rel="noreferrer">Project inspiration <ArrowUpRight size={13} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a></nav></div><div className="container footer-bottom"><span>Made with care, for student life.</span><span>Educational use only. Not a medical diagnostic tool.</span></div></footer>
  </>
}
