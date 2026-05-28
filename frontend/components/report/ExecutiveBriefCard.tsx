import { FileText } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function ExecutiveBriefCard({ summary }: { summary: string }) {
  return (
    <Card className="lg:col-span-3 bg-card border border-border/50 rounded-xl ring-0">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Executive Brief
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {summary}
        </p>
      </CardContent>
    </Card>
  )
}
