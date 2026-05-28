import { Globe } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type ReportHeaderProps = {
  analyzedUrl: string
  onReset: () => void
}

export function ReportHeader({ analyzedUrl, onReset }: ReportHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">
          GTM Intelligence Report
        </h1>
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          <Badge
            variant="outline"
            className="max-w-xs truncate border-slate-700 text-slate-400 text-xs font-normal"
          >
            {analyzedUrl}
          </Badge>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        className="shrink-0 text-slate-400 hover:text-slate-50 hover:bg-slate-800 cursor-pointer"
      >
        New Analysis
      </Button>
    </div>
  )
}
