'use client'

import { useEffect, useState } from 'react'

/** 예: 2026.05.13 15:33 KST */
function formatKstNowCompact(): string {
  const d = new Date()
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  const y = get('year')
  const m = get('month')
  const day = get('day')
  const h = get('hour')
  const min = get('minute')
  return `${y}.${m}.${day} ${h}:${min} KST`
}

type Props = {
  title?: string
}

export function PageHeader({ title = '종목 카드' }: Props) {
  const [now, setNow] = useState('')

  useEffect(() => {
    const updateTime = () => setNow(formatKstNowCompact())
    updateTime()
    const timer = window.setInterval(updateTime, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <header className="border-b border-default px-4 py-5 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-primary">{title}</h1>
      <p className="mt-1 text-sm text-secondary">{now}</p>
    </header>
  )
}
