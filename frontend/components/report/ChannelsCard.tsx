import { Radio } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function ChannelsCard({ items }: { items: string[] }) {
  return (
    <Card className="bg-card border border-border/50 rounded-xl ring-0">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Recommended Channels
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="text-xs font-normal cursor-default"
            >
              {item}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
