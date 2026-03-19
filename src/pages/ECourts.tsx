import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, AlertCircle } from 'lucide-react'
import { searchECourts } from '@/lib/api-additions'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/FormFields'
import { INDIAN_STATES } from '@/lib/utils'

interface CaseResult {
  source: string
  note?: string
  case?: {
    cnr_number: string
    case_type: string
    filing_number: string
    filing_date: string
    registration_number: string
    registration_date: string
    next_hearing_date: string
    purpose_of_next_hearing: string
    stage: string
    court_number_and_judge: string
    petitioner: string
    respondent: string
    acts: string[]
    history: Array<{ date: string; purpose: string; judge: string }>
    status: string
  }
}

export default function ECourtsPage() {
  const [cnr, setCnr] = useState('')
  const [caseNo, setCaseNo] = useState('')
  const [court, setCourt] = useState('')
  const [state, setState] = useState('')
  const [year, setYear] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CaseResult | null>(null)
  const [error, setError] = useState('')

  const years = Array.from({ length: 15 }, (_, i) => String(new Date().getFullYear() - i))

  async function handleSearch() {
    if (!cnr && !caseNo) { setError('Please enter a CNR number or case number.'); return }
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const data = await searchECourts({ cnr, caseNo, court, state, year }) as CaseResult
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-[1000px]">
      <div className="mb-8">
        <h1 className="text-[32px] text-foreground mb-1" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}>
          eCourts Case Status
        </h1>
        <p className="text-[12px] text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
          Search Indian court case status via CNR number or case details
        </p>
      </div>

      <div className="gold-line-solid mb-8" />

      {/* Search form */}
      <div className="bg-surface border border-border/40 p-5 mb-6">
        <p className="text-[11px] tracking-widest text-gold/70 mb-4" style={{ fontFamily: 'DM Mono, monospace' }}>
          SEARCH BY CNR NUMBER (RECOMMENDED)
        </p>
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <FormField label="CNR Number">
              <Input
                value={cnr}
                onChange={e => setCnr(e.target.value.toUpperCase())}
                placeholder="e.g. MHNS010012342024"
              />
            </FormField>
          </div>
          <div className="flex items-end">
            <p className="text-[11px] text-muted pb-3 px-2" style={{ fontFamily: 'DM Mono, monospace' }}>OR</p>
          </div>
          <div className="flex-1">
            <FormField label="Case Number">
              <Input
                value={caseNo}
                onChange={e => setCaseNo(e.target.value)}
                placeholder="e.g. CS/1234/2024"
              />
            </FormField>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <FormField label="State">
            <Select
              value={state}
              onChange={e => setState(e.target.value)}
              placeholder="Select state..."
              options={INDIAN_STATES.map(s => ({ value: s, label: s }))}
            />
          </FormField>
          <FormField label="Court Number">
            <Input
              value={court}
              onChange={e => setCourt(e.target.value)}
              placeholder="e.g. 12"
            />
          </FormField>
          <FormField label="Year">
            <Select
              value={year}
              onChange={e => setYear(e.target.value)}
              placeholder="Select year..."
              options={years.map(y => ({ value: y, label: y }))}
            />
          </FormField>
        </div>

        {error && (
          <p className="text-[11px] text-red-400 mb-3" style={{ fontFamily: 'DM Mono, monospace' }}>{error}</p>
        )}

        <Button variant="primary" onClick={handleSearch} loading={loading} icon={<Search size={13} />}>
          SEARCH CASE
        </Button>
      </div>

      {/* Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {result.note && (
            <div className="flex items-start gap-3 p-4 border border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.06)]">
              <AlertCircle size={15} className="text-[#fbbf24] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#fbbf24]" style={{ fontFamily: 'DM Mono, monospace' }}>{result.note}</p>
            </div>
          )}

          {result.case && (
            <div className="bg-surface border border-border/40 p-5 space-y-4">
              {/* Case identity */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'CNR NUMBER', value: result.case.cnr_number },
                  { label: 'CASE TYPE', value: result.case.case_type },
                  { label: 'FILING NO', value: result.case.filing_number },
                  { label: 'FILING DATE', value: result.case.filing_date },
                  { label: 'REGISTRATION', value: result.case.registration_number },
                  { label: 'STATUS', value: result.case.status },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[9px] tracking-widest text-muted mb-0.5" style={{ fontFamily: 'DM Mono, monospace' }}>{label}</p>
                    <p className="text-[13px] text-foreground" style={{ fontFamily: 'DM Mono, monospace' }}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="gold-line-solid" />

              {/* Parties */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] tracking-widest text-muted mb-1" style={{ fontFamily: 'DM Mono, monospace' }}>PARTIES</p>
                  <p className="text-[14px] text-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>
                    {result.case.petitioner} {result.case.respondent}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] tracking-widest text-muted mb-1" style={{ fontFamily: 'DM Mono, monospace' }}>COURT</p>
                  <p className="text-[13px] text-foreground" style={{ fontFamily: 'Lora, serif' }}>{result.case.court_number_and_judge}</p>
                </div>
              </div>

              {/* Next hearing */}
              <div className="bg-surface-2 border border-gold/20 p-3">
                <p className="text-[9px] tracking-widest text-gold/70 mb-1" style={{ fontFamily: 'DM Mono, monospace' }}>NEXT HEARING DATE</p>
                <p className="text-[18px] text-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>
                  {result.case.next_hearing_date}
                </p>
                <p className="text-[11px] text-muted mt-0.5" style={{ fontFamily: 'DM Mono, monospace' }}>
                  Purpose: {result.case.purpose_of_next_hearing}
                </p>
              </div>

              {/* Acts */}
              {result.case.acts.length > 0 && (
                <div>
                  <p className="text-[9px] tracking-widest text-muted mb-2" style={{ fontFamily: 'DM Mono, monospace' }}>ACTS / SECTIONS</p>
                  <div className="flex flex-wrap gap-2">
                    {result.case.acts.map(act => (
                      <span key={act} className="text-[10px] border border-border/40 px-2 py-0.5 text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
                        {act}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* History */}
              {result.case.history.length > 0 && (
                <div>
                  <p className="text-[9px] tracking-widest text-muted mb-3" style={{ fontFamily: 'DM Mono, monospace' }}>CASE HISTORY</p>
                  <div className="border border-border/30 overflow-x-auto">
                    <table className="w-full text-[11px]" style={{ fontFamily: 'DM Mono, monospace' }}>
                      <thead>
                        <tr className="border-b border-border/30 bg-surface">
                          <th className="text-left px-3 py-2 text-muted font-normal">DATE</th>
                          <th className="text-left px-3 py-2 text-muted font-normal">PURPOSE</th>
                          <th className="text-left px-3 py-2 text-muted font-normal">JUDGE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.case.history.map((h, i) => (
                          <tr key={i} className="border-b border-border/20 last:border-0 hover:bg-surface-2">
                            <td className="px-3 py-2 text-foreground">{h.date}</td>
                            <td className="px-3 py-2 text-muted">{h.purpose}</td>
                            <td className="px-3 py-2 text-muted">{h.judge}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
