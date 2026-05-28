import { Lightbulb } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function ContentRecommendationsCard({ items }: { items: string[] }) {
  return (
    <Card className="lg:col-span-3 bg-card border border-border/50 rounded-xl ring-0">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Content Recommendations
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-xs tabular-nums font-medium text-emerald-500 w-5 shrink-0 pt-0.5">
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="text-sm text-muted-foreground leading-snug">{item}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
