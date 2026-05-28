import { FileText } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

type ExecutiveSummaryCardProps = {
  summary: string
}

export function ExecutiveSummaryCard({ summary }: ExecutiveSummaryCardProps) {
  return (
    <Card className="bg-card border-border rounded-xl ring-0 border">
      <CardHeader className="pb-0">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
            Executive Summary
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap max-w-prose">
          {summary}
        </p>
      </CardContent>
    </Card>
  )
}
