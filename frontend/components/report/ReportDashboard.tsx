import { ReportHeader } from './ReportHeader'
import { ExecutiveBriefCard } from './ExecutiveBriefCard'
import { CompetitorMatrix } from './CompetitorMatrix'
import { HiringSignalsCard } from './HiringSignalsCard'
import { ChannelsCard } from './ChannelsCard'
import { WhiteSpaceCard } from './WhiteSpaceCard'
import { ContentRecommendationsCard } from './ContentRecommendationsCard'

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
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-7xl mx-auto space-y-5">
        <ReportHeader analyzedUrl={analyzedUrl} onReset={onReset} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <ExecutiveBriefCard summary={report.summary} />
          <CompetitorMatrix competitors={report.competitors} />
          <HiringSignalsCard items={report.hiring_signals} />
          <ChannelsCard items={report.recommended_channels} />
          <WhiteSpaceCard items={report.white_space_opportunities} />
          <ContentRecommendationsCard items={report.content_recommendations} />
        </div>
      </div>
    </main>
  )
}
