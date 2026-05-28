import { Crosshair, Lightbulb, Radio, TrendingUp, Users } from 'lucide-react'
import { ReportHeader } from './ReportHeader'
import { ExecutiveSummaryCard } from './ExecutiveSummaryCard'
import { InsightCard } from './InsightCard'

type AnalysisReport = {
  summary: string
  competitors: string[]
  white_space_opportunities: string[]
  recommended_channels: string[]
  content_recommendations: string[]
  hiring_signals: string[]
}

type ReportDashboardProps = {
  report: AnalysisReport
  analyzedUrl: string
  onReset: () => void
}

export function ReportDashboard({ report, analyzedUrl, onReset }: ReportDashboardProps) {
  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <ReportHeader analyzedUrl={analyzedUrl} onReset={onReset} />

        <ExecutiveSummaryCard summary={report.summary} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InsightCard
            title="Target Competitors"
            icon={Users}
            items={report.competitors}
          />
          <InsightCard
            title="White Space Opportunities"
            icon={Crosshair}
            items={report.white_space_opportunities}
          />
          <InsightCard
            title="Recommended Channels"
            icon={Radio}
            items={report.recommended_channels}
          />
          <InsightCard
            title="Hiring Signals"
            icon={TrendingUp}
            items={report.hiring_signals}
          />
        </div>

        <InsightCard
          title="Content Recommendations"
          icon={Lightbulb}
          items={report.content_recommendations}
        />
      </div>
    </main>
  )
}
