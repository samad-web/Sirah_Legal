import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'

const DEMO_NOTICE = `IN THE MATTER OF RECOVERY OF DUES

To,
Mr. Ramesh Kumar
123, MG Road, Chennai - 600001

Dear Sir,

NOTICE UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881

I write to you on behalf of my client, Ms. Priya Sharma, 
to bring to your urgent notice the following facts...`

function TypewriterDemo() {
  const [displayed, setDisplayed] = useState('')
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (index < DEMO_NOTICE.length) {
      const timeout = setTimeout(() => {
        setDisplayed(DEMO_NOTICE.slice(0, index + 1))
        setIndex(i => i + 1)
      }, 18)
      return () => clearTimeout(timeout)
    } else {
      const reset = setTimeout(() => {
        setDisplayed('')
        setIndex(0)
      }, 4000)
      return () => clearTimeout(reset)
    }
  }, [index])

  return (
    <div className="document-preview p-6 h-[320px] overflow-hidden">
      <pre
        className="text-[12px] text-[#2a1f0d] whitespace-pre-wrap leading-relaxed"
        style={{ fontFamily: 'Cormorant Garamond, serif' }}
      >
        {displayed}
        <span className="inline-block w-[2px] h-[14px] bg-[#8b7355] animate-pulse align-middle ml-0.5" />
      </pre>
    </div>
  )
}

// Custom SVG icons (not lucide)
function ScaleIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="square" strokeLinejoin="miter">
      <line x1="14" y1="3" x2="14" y2="25" />
      <line x1="7" y1="25" x2="21" y2="25" />
      <polyline points="6,9 14,6 22,9" />
      <path d="M6,9 L3,16 H9 Z" />
      <path d="M22,9 L19,16 H25 Z" />
    </svg>
  )
}

function QuillIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="square">
      <path d="M24 4 C20 4 12 8 8 20 L6 24 L10 22 C14 18 20 14 24 4Z" />
      <line x1="8" y1="20" x2="12" y2="16" />
      <line x1="6" y1="24" x2="9" y2="18" />
    </svg>
  )
}

function PropertyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="square">
      <path d="M14 4 L14 10 M14 10 C14 10 8 14 8 18 C8 22 14 26 14 26 C14 26 20 22 20 18 C20 14 14 10 14 10Z" />
      <circle cx="14" cy="18" r="2" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="square">
      <path d="M14 3 L6 7 V14 C6 19 14 25 14 25 C14 25 22 19 22 14 V7 Z" />
      <polyline points="10,14 13,17 18,11" />
    </svg>
  )
}

const features = [
  {
    icon: <ScaleIcon />,
    title: 'Legal Notice & Rejoinder Drafting',
    desc: 'Draft authoritative notices and rejoinders under CPC, NI Act, and consumer protection laws.',
  },
  {
    icon: <QuillIcon />,
    title: 'Contract Drafting & Risk Review',
    desc: 'Generate NDAs, employment contracts, and vendor agreements. Identify risk clauses instantly.',
  },
  {
    icon: <PropertyIcon />,
    title: 'Property Title Research Reports',
    desc: 'Produce structured title opinions with chain of title, encumbrances, and clear marketability verdicts.',
  },
  {
    icon: <ShieldIcon />,
    title: 'Tamil · Hindi · English',
    desc: 'Generate documents in the language of your client. Multilingual output with full legal accuracy.',
  },
]

const pricing = [
  {
    name: 'Solo',
    price: '₹999',
    period: '/mo',
    features: ['50 documents/month', 'All 3 modules', 'PDF & DOCX export', 'Email support'],
    recommended: false,
  },
  {
    name: 'Firm',
    price: '₹3,999',
    period: '/mo',
    features: ['Unlimited documents', 'All 3 modules', '5 user seats', 'Priority support', 'Letterhead branding'],
    recommended: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    features: ['Unlimited seats', 'Custom integrations', 'SLA guarantee', 'Dedicated account manager'],
    recommended: false,
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0E0E0E]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-[rgba(201,168,76,0.15)] bg-[rgba(14,14,14,0.95)] backdrop-blur-sm">
        <div className="h-[1px] bg-[rgba(201,168,76,0.4)]" />
        <div className="max-w-7xl mx-auto px-8 h-14 flex items-center justify-between">
          <span
            className="text-xl text-[#FAF7F0]"
            style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}
          >
            LexDraft
          </span>
          <div className="flex items-center gap-6">
            <Link to="/#features" className="nav-hover-gold text-[11px] text-[rgba(250,247,240,0.6)] hover:text-[#FAF7F0] transition-colors" style={{ fontFamily: 'DM Mono, monospace' }}>
              FEATURES
            </Link>
            <Link to="/#pricing" className="nav-hover-gold text-[11px] text-[rgba(250,247,240,0.6)] hover:text-[#FAF7F0] transition-colors" style={{ fontFamily: 'DM Mono, monospace' }}>
              PRICING
            </Link>
            <Link to="/login">
              <Button variant="outline" size="sm">SIGN IN</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="min-h-screen flex items-center pt-14">
        <div className="max-w-7xl mx-auto px-8 w-full">
          <div className="grid grid-cols-2 gap-12 items-center">
            {/* Left */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <p
                className="text-[11px] tracking-[0.2em] text-[#C9A84C] mb-6 uppercase"
                style={{ fontFamily: 'DM Mono, monospace' }}
              >
                AI-Powered Legal Drafting
              </p>
              <h1
                className="text-[76px] leading-[1.05] text-[#FAF7F0] mb-6"
                style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 300 }}
              >
                Legal documents,{' '}
                <span className="text-[#F5EDD6]">drafted</span>{' '}
                in minutes.
              </h1>
              <p
                className="text-[13px] text-[rgba(250,247,240,0.5)] mb-10 leading-relaxed"
                style={{ fontFamily: 'DM Mono, monospace' }}
              >
                AI-powered drafting for Indian advocates.
                <br />
                Notices. Contracts. Title Reports.
              </p>
              <div className="flex items-center gap-4">
                <Link to="/login">
                  <Button
                    variant="primary"
                    size="lg"
                    className="text-[12px]"
                    style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', letterSpacing: '0.04em' }}
                  >
                    Start Drafting — Free
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-[#C9A84C] text-[#C9A84C] text-[12px]"
                  style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px' }}
                >
                  See Demo
                </Button>
              </div>

              {/* Social proof */}
              <div className="mt-12 flex items-center gap-6">
                <div className="h-px flex-1 bg-[rgba(201,168,76,0.15)]" />
                <span className="text-[10px] text-[rgba(250,247,240,0.3)] whitespace-nowrap" style={{ fontFamily: 'DM Mono, monospace' }}>
                  TRUSTED BY ADVOCATES ACROSS INDIA
                </span>
                <div className="h-px flex-1 bg-[rgba(201,168,76,0.15)]" />
              </div>
            </motion.div>

            {/* Right — typewriter demo */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="border border-[rgba(201,168,76,0.25)] shadow-2xl">
                {/* Mock toolbar */}
                <div className="bg-[#161616] border-b border-[rgba(201,168,76,0.15)] px-4 py-2 flex items-center justify-between">
                  <span className="text-[10px] text-[rgba(250,247,240,0.5)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                    LEGAL NOTICE — MONEY RECOVERY
                  </span>
                  <span className="w-2 h-2 bg-[#C9A84C] animate-pulse" />
                </div>
                <TypewriterDemo />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Gold divider */}
      <div className="gold-line-solid max-w-7xl mx-auto" />

      {/* Features */}
      <section id="features" className="py-24 max-w-7xl mx-auto px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[11px] tracking-[0.2em] text-[#C9A84C] mb-3 uppercase" style={{ fontFamily: 'DM Mono, monospace' }}>
            WHAT LEXDRAFT DOES
          </p>
          <h2
            className="text-[48px] text-[#FAF7F0] mb-16"
            style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}
          >
            Every document, done right.
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="p-8 bg-[#161616] border border-[rgba(201,168,76,0.15)] hover:border-[rgba(201,168,76,0.35)] transition-all group"
            >
              <div className="mb-5">{f.icon}</div>
              <h3
                className="text-[22px] text-[#FAF7F0] mb-3"
                style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}
              >
                {f.title}
              </h3>
              <p
                className="text-[13px] text-[rgba(250,247,240,0.5)] leading-relaxed"
                style={{ fontFamily: 'Lora, serif' }}
              >
                {f.desc}
              </p>
              <div className="mt-5 h-[1px] w-0 bg-[#C9A84C] group-hover:w-full transition-all duration-500" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Gold divider */}
      <div className="gold-line-solid max-w-7xl mx-auto" />

      {/* Pricing */}
      <section id="pricing" className="py-24 max-w-7xl mx-auto px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[11px] tracking-[0.2em] text-[#C9A84C] mb-3 uppercase" style={{ fontFamily: 'DM Mono, monospace' }}>
            PRICING
          </p>
          <h2
            className="text-[48px] text-[#FAF7F0] mb-16"
            style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}
          >
            Simple, transparent pricing.
          </h2>
        </motion.div>

        <div className="grid grid-cols-3 gap-0 border border-[rgba(201,168,76,0.2)]">
          {pricing.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`p-8 relative ${
                plan.recommended
                  ? 'border-x border-[#C9A84C] bg-[#0f1a14]'
                  : 'bg-[#0E0E0E]'
              } ${i < pricing.length - 1 ? 'border-r border-[rgba(201,168,76,0.1)]' : ''}`}
            >
              {plan.recommended && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full bg-[#C9A84C] px-4 py-1 text-[10px] text-[#0E0E0E] font-medium"
                  style={{ fontFamily: 'DM Mono, monospace' }}
                >
                  RECOMMENDED
                </div>
              )}
              <p
                className="text-[11px] tracking-widest text-[rgba(250,247,240,0.5)] mb-4"
                style={{ fontFamily: 'DM Mono, monospace' }}
              >
                {plan.name.toUpperCase()}
              </p>
              <div className="flex items-baseline gap-1 mb-8">
                <span
                  className="text-[42px] text-[#FAF7F0]"
                  style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}
                >
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-[13px] text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                    {plan.period}
                  </span>
                )}
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-[12px] text-[rgba(250,247,240,0.65)]" style={{ fontFamily: 'Lora, serif' }}>
                    <span className="w-1 h-1 bg-[#C9A84C]" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/login">
                <Button
                  variant={plan.recommended ? 'primary' : 'outline'}
                  className="w-full justify-center"
                >
                  {plan.name === 'Enterprise' ? 'CONTACT US' : 'GET STARTED'}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[rgba(201,168,76,0.15)] py-8 max-w-7xl mx-auto px-8">
        <div className="flex items-center justify-between">
          <span
            className="text-[18px] text-[#FAF7F0]"
            style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}
          >
            LexDraft
          </span>
          <div className="flex items-center gap-8">
            <Link to="#" className="text-[11px] text-[rgba(250,247,240,0.4)] hover:text-[rgba(250,247,240,0.8)] nav-hover-gold" style={{ fontFamily: 'DM Mono, monospace' }}>
              PRIVACY
            </Link>
            <Link to="#" className="text-[11px] text-[rgba(250,247,240,0.4)] hover:text-[rgba(250,247,240,0.8)] nav-hover-gold" style={{ fontFamily: 'DM Mono, monospace' }}>
              TERMS
            </Link>
            <Link to="#" className="text-[11px] text-[rgba(250,247,240,0.4)] hover:text-[rgba(250,247,240,0.8)] nav-hover-gold" style={{ fontFamily: 'DM Mono, monospace' }}>
              CONTACT
            </Link>
          </div>
          <span className="text-[11px] text-[rgba(250,247,240,0.3)]" style={{ fontFamily: 'DM Mono, monospace' }}>
            MADE FOR INDIAN ADVOCATES
          </span>
        </div>
      </footer>
    </div>
  )
}
