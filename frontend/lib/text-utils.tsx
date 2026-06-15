import React from 'react'

export function cleanUrls(text: string): string {
  return text
    .replace(/!\[[^\]]*\](\([^)]*\)?)?/g, '')   // image markdown — complete or truncated
    .replace(/\[([^\]]*)\](\([^)]*\)?)?/g, '$1') // link markdown — keep text, drop URL
    .replace(/https?:\/\/\S+/g, '')              // bare URLs
    .replace(/[\[\]]/g, '')                      // leftover [ ] from linked-image patterns
    .replace(/\s[×x]\s?/g, ' ')                 // lone × or x from link alt-text artifacts
    .replace(/\bsignals\s*$/, '')               // trailing "signals" with no implication after it
    .replace(/\s+/g, ' ')
    .trim()
}

export function renderInline(text: string, strongClassName = 'font-semibold'): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className={strongClassName}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}>{part.slice(1, -1)}</em>
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

export function renderBlocks(text: string): React.ReactNode {
  const blocks = text.split(/\n{2,}/)
  return blocks.map((block, i) => {
    const lines = block.split('\n')
    const isList = lines.every(l => /^[-•*]\s/.test(l.trim()) || l.trim() === '')
    if (isList) {
      return (
        <ul key={i} className="list-disc list-inside space-y-1 my-1">
          {lines.filter(l => l.trim()).map((line, j) => (
            <li key={j}>{renderInline(line.replace(/^[-•*]\s*/, ''))}</li>
          ))}
        </ul>
      )
    }
    return (
      <p key={i} className="mb-2 last:mb-0">
        {lines.map((line, j) => (
          <React.Fragment key={j}>
            {j > 0 && <br />}
            {renderInline(line)}
          </React.Fragment>
        ))}
      </p>
    )
  })
}
