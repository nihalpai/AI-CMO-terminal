import { TrendingUp, UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

export function HiringSignalsCard({ items }: { items: string[] }) {
  return (
    <Card className="bg-card border border-border/50 rounded-xl ring-0">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Hiring Signals
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-0 pb-1">
        <ScrollArea className="h-64 px-4">
          <div className="space-y-0">
            {items.map((item, i) => (
              <div key={i}>
                <div className="flex items-start gap-2.5 py-2.5">
                  <UserPlus className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground leading-snug">{item}</p>
                </div>
                {i < items.length - 1 && <Separator className="bg-border/50" />}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
