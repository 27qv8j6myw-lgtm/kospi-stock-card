import type { ReactNode } from 'react'

type Props = {
  icon: ReactNode
  title: string
  meta?: string
  titleClassName?: string
}

export function ProSectionHeader({ icon, title, meta, titleClassName }: Props) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      {icon}
      <span className={titleClassName ?? 'text-[18px] font-bold text-gray-900'}>{title}</span>
      {meta ? <span className="ml-auto text-[12px] text-gray-400">{meta}</span> : null}
    </div>
  )
}
