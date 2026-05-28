'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { Progress, ProgressTrack, ProgressIndicator } from '@/components/ui/progress'

type Step = {
  label: string
  sublabel: string
}

const STEPS: Step[] = [
  { label: 'Scraping competitor site', sublabel: 'Fetching content via Firecrawl' },
  { label: 'Researching competitors', sublabel: 'Mapping the competitive landscape' },
  { label: 'Building strategy', sublabel: 'Lyzr agents analyzing GTM gaps' },
  { label: 'Finalizing report', sublabel: 'Structuring your intelligence brief' },
]

const STEP_DURATION = 3200

export function AnalysisProgressLoader() {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev))
    }, STEP_DURATION)
    return () => clearInterval(interval)
  }, [])

  const progressValue = Math.round(((activeStep + 0.5) / STEPS.length) * 100)

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
          Analysis in progress
        </p>
        <p className="text-sm text-muted-foreground">
          This usually takes 10–15 seconds
        </p>
      </div>

      <div className="space-y-3">
        {STEPS.map((step, index) => {
          const isCompleted = index < activeStep
          const isActive = index === activeStep
          const isPending = index > activeStep

          return (
            <div
              key={index}
              className="flex items-start gap-3 transition-opacity duration-500"
              style={{ opacity: isPending ? 0.35 : 1 }}
            >
              <div className="mt-0.5 shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 text-emerald-500 animate-spin" />
                ) : (
                  <Circle className="h-4 w-4 text-slate-600" />
                )}
              </div>
              <div>
                <p
                  className={`text-sm font-medium leading-tight ${
                    isCompleted
                      ? 'text-slate-500 line-through'
                      : isActive
                        ? 'text-slate-50'
                        : 'text-slate-500'
                  }`}
                >
                  {step.label}
                </p>
                {isActive && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {step.sublabel}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="space-y-2">
        <Progress value={progressValue} className="gap-0">
          <ProgressTrack className="h-1.5 bg-slate-800">
            <ProgressIndicator className="bg-emerald-500 transition-all duration-700 ease-in-out" />
          </ProgressTrack>
        </Progress>
        <p className="text-xs text-muted-foreground tabular-nums">{progressValue}% complete</p>
      </div>
    </div>
  )
}
