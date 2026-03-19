import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calculator } from 'lucide-react'
import { FormField, Input, Select } from '@/components/ui/FormFields'
import { INDIAN_STATES } from '@/lib/utils'

type DeedType = 'sale' | 'gift' | 'lease' | 'mortgage' | 'poa' | 'partition'

interface StateRates {
  sale: { duty: number; regFee: number }
  gift: { duty: number; regFee: number }
  lease: { duty: number; regFee: number }
  mortgage: { duty: number; regFee: number }
  poa: { duty: number; regFee: number }      // flat amounts for POA (in rupees)
  partition: { duty: number; regFee: number }
  isPOAFlat?: boolean
}

// Approximate rates (duty %, registration fee %) for major states
const STATE_RATES: Record<string, StateRates> = {
  'Tamil Nadu':      { sale: { duty: 7, regFee: 1 }, gift: { duty: 7, regFee: 1 }, lease: { duty: 1, regFee: 1 }, mortgage: { duty: 1, regFee: 0.5 }, poa: { duty: 100, regFee: 10 }, partition: { duty: 1, regFee: 1 }, isPOAFlat: true },
  'Maharashtra':     { sale: { duty: 6, regFee: 1 }, gift: { duty: 3, regFee: 1 }, lease: { duty: 0.25, regFee: 1 }, mortgage: { duty: 0.5, regFee: 1 }, poa: { duty: 500, regFee: 100 }, partition: { duty: 2, regFee: 1 }, isPOAFlat: true },
  'Delhi':           { sale: { duty: 6, regFee: 1 }, gift: { duty: 6, regFee: 1 }, lease: { duty: 2, regFee: 1 }, mortgage: { duty: 2, regFee: 1 }, poa: { duty: 1000, regFee: 200 }, partition: { duty: 2, regFee: 1 }, isPOAFlat: true },
  'Karnataka':       { sale: { duty: 5.6, regFee: 1 }, gift: { duty: 5.6, regFee: 1 }, lease: { duty: 0.5, regFee: 1 }, mortgage: { duty: 0.5, regFee: 1 }, poa: { duty: 500, regFee: 200 }, partition: { duty: 1, regFee: 1 }, isPOAFlat: true },
  'Gujarat':         { sale: { duty: 4.9, regFee: 1 }, gift: { duty: 3.5, regFee: 1 }, lease: { duty: 1, regFee: 1 }, mortgage: { duty: 0.5, regFee: 1 }, poa: { duty: 100, regFee: 20 }, partition: { duty: 0.6, regFee: 1 }, isPOAFlat: true },
  'Uttar Pradesh':   { sale: { duty: 7, regFee: 1 }, gift: { duty: 7, regFee: 1 }, lease: { duty: 2, regFee: 1 }, mortgage: { duty: 1, regFee: 1 }, poa: { duty: 100, regFee: 50 }, partition: { duty: 2, regFee: 1 }, isPOAFlat: true },
  'West Bengal':     { sale: { duty: 6, regFee: 1 }, gift: { duty: 6, regFee: 1 }, lease: { duty: 1, regFee: 1 }, mortgage: { duty: 0.5, regFee: 1 }, poa: { duty: 200, regFee: 50 }, partition: { duty: 1, regFee: 1 }, isPOAFlat: true },
  'Kerala':          { sale: { duty: 8, regFee: 2 }, gift: { duty: 8, regFee: 2 }, lease: { duty: 0.5, regFee: 1 }, mortgage: { duty: 0.5, regFee: 1 }, poa: { duty: 200, regFee: 100 }, partition: { duty: 2, regFee: 1 }, isPOAFlat: true },
  'Andhra Pradesh':  { sale: { duty: 5, regFee: 0.5 }, gift: { duty: 5, regFee: 0.5 }, lease: { duty: 0.5, regFee: 0.5 }, mortgage: { duty: 0.5, regFee: 0.5 }, poa: { duty: 200, regFee: 100 }, partition: { duty: 1, regFee: 0.5 }, isPOAFlat: true },
  'Telangana':       { sale: { duty: 5, regFee: 0.5 }, gift: { duty: 5, regFee: 0.5 }, lease: { duty: 0.5, regFee: 0.5 }, mortgage: { duty: 0.5, regFee: 0.5 }, poa: { duty: 200, regFee: 100 }, partition: { duty: 1, regFee: 0.5 }, isPOAFlat: true },
}

const DEFAULT_RATES: StateRates = { sale: { duty: 6, regFee: 1 }, gift: { duty: 5, regFee: 1 }, lease: { duty: 1, regFee: 1 }, mortgage: { duty: 0.5, regFee: 1 }, poa: { duty: 500, regFee: 100 }, partition: { duty: 2, regFee: 1 }, isPOAFlat: true }

const DEED_LABELS: Record<DeedType, string> = {
  sale: 'Sale Deed',
  gift: 'Gift Deed',
  lease: 'Lease Deed',
  mortgage: 'Mortgage Deed',
  poa: 'Power of Attorney',
  partition: 'Partition Deed',
}

function formatINR(amount: number): string {
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function StampDutyPage() {
  const [state, setState] = useState('')
  const [deedType, setDeedType] = useState<DeedType>('sale')
  const [value, setValue] = useState('')

  const numValue = parseFloat(value.replace(/,/g, '')) || 0
  const rates = (state && STATE_RATES[state]) ? STATE_RATES[state] : null
  const stateRates = rates ?? DEFAULT_RATES

  const rateEntry = stateRates[deedType]
  const isPOAFlat = deedType === 'poa' && stateRates.isPOAFlat

  let stampDuty = 0
  let regFee = 0

  if (numValue > 0) {
    if (isPOAFlat) {
      stampDuty = rateEntry.duty
      regFee = rateEntry.regFee
    } else {
      stampDuty = (numValue * rateEntry.duty) / 100
      regFee = (numValue * rateEntry.regFee) / 100
    }
  }

  const total = stampDuty + regFee
  const hasResult = numValue > 0

  return (
    <div className="p-4 md:p-8 max-w-[800px]">
      <div className="mb-8">
        <h1 className="text-[32px] text-foreground mb-1" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}>
          Stamp Duty Calculator
        </h1>
        <p className="text-[12px] text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
          Approximate stamp duty and registration fee for Indian states
        </p>
      </div>

      <div className="gold-line-solid mb-8" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-4">
          <FormField label="State" required>
            <Select
              value={state}
              onChange={e => setState(e.target.value)}
              placeholder="Select state..."
              options={INDIAN_STATES.map(s => ({ value: s, label: s }))}
            />
          </FormField>

          <FormField label="Deed / Instrument Type" required>
            <div className="grid grid-cols-2 gap-1">
              {(Object.keys(DEED_LABELS) as DeedType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setDeedType(type)}
                  className={`py-2 px-3 text-[11px] border text-left transition-all ${
                    deedType === type
                      ? 'bg-forest border-gold/40 text-parchment'
                      : 'bg-surface-2 border-border text-muted hover:text-foreground'
                  }`}
                  style={{ fontFamily: 'DM Mono, monospace' }}
                >
                  {DEED_LABELS[type]}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Transaction / Property Value (₹)" required>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-[13px]">₹</span>
              <Input
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="e.g. 5000000"
                className="pl-7"
                type="number"
                min="0"
              />
            </div>
          </FormField>

          {!state && (
            <p className="text-[11px] text-muted/60 bg-surface-2 border border-border/40 px-3 py-2" style={{ fontFamily: 'DM Mono, monospace' }}>
              Note: Select a state for accurate rates. Default rates shown when state not selected.
            </p>
          )}
        </div>

        {/* Result */}
        <div>
          {hasResult ? (
            <motion.div
              key={`${state}-${deedType}-${value}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface border border-gold/25 p-5 space-y-4"
            >
              <div>
                <p className="text-[10px] tracking-widest text-gold/70 mb-1" style={{ fontFamily: 'DM Mono, monospace' }}>
                  CALCULATION RESULT
                </p>
                <p className="text-[18px] text-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}>
                  {DEED_LABELS[deedType]} — {state || 'Default Rates'}
                </p>
              </div>

              <div className="gold-line-solid" />

              <div className="space-y-3">
                <div className="flex justify-between">
                  <div>
                    <p className="text-[11px] text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
                      TRANSACTION VALUE
                    </p>
                  </div>
                  <p className="text-[14px] text-foreground" style={{ fontFamily: 'DM Mono, monospace' }}>
                    ₹{formatINR(numValue)}
                  </p>
                </div>

                <div className="flex justify-between">
                  <div>
                    <p className="text-[11px] text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
                      STAMP DUTY
                    </p>
                    <p className="text-[10px] text-muted/60" style={{ fontFamily: 'DM Mono, monospace' }}>
                      {isPOAFlat ? 'Flat amount' : `${rateEntry.duty}%`}
                    </p>
                  </div>
                  <p className="text-[16px] text-gold" style={{ fontFamily: 'DM Mono, monospace' }}>
                    ₹{formatINR(stampDuty)}
                  </p>
                </div>

                <div className="flex justify-between">
                  <div>
                    <p className="text-[11px] text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
                      REGISTRATION FEE
                    </p>
                    <p className="text-[10px] text-muted/60" style={{ fontFamily: 'DM Mono, monospace' }}>
                      {isPOAFlat ? 'Flat amount' : `${rateEntry.regFee}%`}
                    </p>
                  </div>
                  <p className="text-[16px] text-gold" style={{ fontFamily: 'DM Mono, monospace' }}>
                    ₹{formatINR(regFee)}
                  </p>
                </div>

                <div className="border-t border-border/40 pt-3 flex justify-between items-center">
                  <p className="text-[13px] text-foreground" style={{ fontFamily: 'DM Mono, monospace' }}>
                    TOTAL PAYABLE
                  </p>
                  <p className="text-[22px] text-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
                    ₹{formatINR(total)}
                  </p>
                </div>
              </div>

              <p className="text-[10px] text-muted/50 border-t border-border/30 pt-3" style={{ fontFamily: 'DM Mono, monospace' }}>
                * These are approximate rates. Actual amounts may vary based on property location, gender of buyer, applicable surcharges, and current state notifications. Consult the official sub-registrar office for confirmed amounts.
              </p>
            </motion.div>
          ) : (
            <div className="border border-border/30 p-12 flex flex-col items-center justify-center text-center h-full">
              <Calculator size={32} className="text-muted/20 mb-4" />
              <p className="text-[14px] text-muted" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                Enter a transaction value to calculate stamp duty.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
