'use client'

import React, { useState } from 'react'
import Image from 'next/image'

/**
 * Shared company/competitor favicon logo (Google s2 favicon service).
 * Renders `fallback` if the image fails to load. Used by CompanyPanel,
 * TerminalHeader, and AgentCard.
 */
export function CompanyLogo({
  domain,
  size,
  fallback,
  className = 'rounded object-contain',
  alt,
}: {
  domain: string
  size: number
  fallback: React.ReactNode
  className?: string
  alt?: string
}) {
  const [failed, setFailed] = useState(false)
  if (failed) return <>{fallback}</>
  return (
    <Image
      src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
      alt={alt ?? domain}
      width={size}
      height={size}
      className={className}
      onError={() => setFailed(true)}
      unoptimized
    />
  )
}
