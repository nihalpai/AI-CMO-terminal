import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

type InsightCardProps = {
  title: string
  items: string[]
  icon: LucideIcon
}

export function InsightCard({ title, icon: Icon, items }: InsightCardProps) {
  const shouldScroll = items.length > 6

  const list = (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="shrink-0 w-5 text-xs font-semibold tabular-nums text-emerald-500 pt-0.5">
            {String(i + 1).padStart(2, '0')}
          </span>
          <span className="text-sm text-slate-300 leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  )

  return (
    <Card className="bg-card border-border rounded-xl ring-0 border">
      <CardHeader className="pb-0">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
            {title}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {shouldScroll ? (
          <ScrollArea className="h-56 pr-2">{list}</ScrollArea>
        ) : (
          list
        )}
      </CardContent>
    </Card>
  )
}
