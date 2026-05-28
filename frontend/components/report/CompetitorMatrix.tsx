import { Target } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function parseCompetitor(raw: string): { name: string; signal: string } {
  const delimIdx = raw.search(/ [-–:] /)
  if (delimIdx !== -1) {
    return {
      name: raw.slice(0, delimIdx).trim(),
      signal: raw.slice(delimIdx).replace(/^[ \-–:]+/, '').trim(),
    }
  }
  return { name: raw.trim(), signal: '' }
}

export function CompetitorMatrix({ competitors }: { competitors: string[] }) {
  const rows = competitors.map(parseCompetitor)

  return (
    <Card className="lg:col-span-3 bg-card border border-border/50 rounded-xl ring-0">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Competitor Matrix
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0 pb-1">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="w-10 text-xs font-medium uppercase tracking-wider text-muted-foreground pl-4">
                #
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground w-48">
                Competitor
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Signal
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow
                key={i}
                className="border-border/50 hover:bg-muted/30 transition-colors"
              >
                <TableCell className="text-xs tabular-nums text-emerald-500 font-medium pl-4">
                  {String(i + 1).padStart(2, '0')}
                </TableCell>
                <TableCell className="text-sm font-medium text-foreground">
                  {row.name}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.signal || <span className="text-muted-foreground/40">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
