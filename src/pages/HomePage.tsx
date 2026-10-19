import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Check, Clock3, HeartHandshake, Leaf, Moon, ShieldCheck, Smartphone, Sparkles } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { WellnessArtwork } from '@/components/shared/WellnessArtwork'
import { Disclaimer, PrivacyNote } from '@/components/shared/Disclaimer'

const features = [
  { icon: Smartphone, title: 'Digital Habit Awareness', body: 'Make space to notice how social media fits into your day.', tone: 'sage' },
  { icon: Moon, title: 'Sleep & Lifestyle Insights', body: 'See your daily rhythms together, from rest to movement.', tone: 'lavender' },
  { icon: HeartHandshake, title: 'Personalized Wellness Suggestions', body: 'Find small, practical ideas inspired by the habits you share.', tone: 'peach' },
  { icon: ShieldCheck, title: 'Privacy-First Experience', body: 'Your reflection is yours. No account, tracking, or saved answers.', tone: 'sage' },
]
export default function HomePage() {
  const reduceMotion = useReducedMotion()
  const live = import.meta.env.VITE_ASSESSMENT_MODE === 'live'
  return <>
    <section className="hero container">
      <motion.div initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.45 }} className="hero-copy">
        <span className="eyebrow"><span className="status-dot" /> A LITTLE INSIGHT. A LITTLE MORE BALANCE.</span>
        <h1>Understand Your Habits.<br /><span>Improve Your<br className="desktop-break" /> Well-being.</span></h1>
        <p className="hero-description">Student life is a lot to balance. Take a moment to explore your everyday habits and discover small steps toward a more balanced you.</p>
        <div className="hero-actions"><Button asChild><Link to="/assessment">Start Your Assessment <ArrowUpRight size={19} aria-hidden="true" /></Link></Button><Button asChild variant="ghost"><Link to="/#how-it-works">How It Works <ArrowRight size={17} aria-hidden="true" /></Link></Button></div>
        <div className="hero-meta"><span><Clock3 size={15} aria-hidden="true" /> About 3 minutes</span><span><Check size={15} aria-hidden="true" /> Free to explore</span><span><ShieldCheck size={15} aria-hidden="true" /> Private by design</span></div>
      </motion.div>
      <div className="hero-visual"><WellnessArtwork /><div className="art-caption"><span className="mini-icon"><Leaf size={19} aria-hidden="true" /></span><div><strong>Small habits. A gentler day.</strong><span>Progress starts with awareness.</span></div></div><div className="art-label"><Sparkles size={15} aria-hidden="true" /> Your pace. Your path.</div></div>
    </section>
    <div className="demo-strip"><div className="container"><span className="badge">{live ? 'EXPERIMENTAL · LIVE' : 'DEMO EXPERIENCE'}</span><p>{live ? 'An experimental model estimate, with clear limits. Not a medical assessment.' : 'A space to reflect, with a sample result. No real prediction or medical assessment.'}</p><Link to="/about">Learn more <ArrowRight size={15} aria-hidden="true" /></Link></div></div>
    <section className="section container" aria-labelledby="features-title"><div className="section-heading"><div><span className="eyebrow">SEE THE BIGGER PICTURE</span><h2 id="features-title">A little awareness goes a long way.</h2></div><p>Your habits are connected.<br />Let’s make them easier to understand.</p></div><div className="feature-grid">{features.map(({ icon: Icon, title, body, tone }) => <Card key={title} className="feature-card"><span className={`icon-tile ${tone}`}><Icon size={23} aria-hidden="true" /></span><h3>{title}</h3><p>{body}</p></Card>)}</div></section>
    <section id="how-it-works" tabIndex={-1} className="how-section section" aria-labelledby="how-title"><div className="container"><div className="section-heading centered"><span className="eyebrow">SIMPLE, THOUGHTFUL, AND ALL ABOUT YOU</span><h2 id="how-title">A few minutes. A fresh perspective.</h2><p>No perfect answers needed. Just a little honesty with yourself.</p></div><ol className="steps-grid">{[['Answer a few questions', 'Tell us about your digital habits, daily routine, and how things have been feeling.'], ['Review your wellness insights', 'Explore a snapshot of your reported habits alongside a clearly labeled educational indicator.'], ['Explore healthier daily habits', 'Choose a practical suggestion that feels right for your life. Start small.']].map(([title, body], index) => <li key={title}><span className="step-number">0{index + 1}</span><h3>{title}</h3><p>{body}</p></li>)}</ol></div></section>
    <section className="container section"><div className="closing-card"><div><span className="eyebrow">A MOMENT FOR YOURSELF</span><h2>You don’t have to figure<br />everything out at once.</h2><p>Start by getting to know your daily habits a little better.</p></div><div><Button asChild><Link to="/assessment">Let’s take the first step <ArrowRight size={18} aria-hidden="true" /></Link></Button><PrivacyNote /></div></div><Disclaimer /></section>
  </>
}
