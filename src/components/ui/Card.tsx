import type { HTMLAttributes } from 'react'

export type CardVariant = 'default' | 'elevated' | 'flat'
export type CardPadding = 'none' | 'sm' | 'md' | 'lg' | 'indicator'
export type CardRadius = 'md' | 'lg' | 'xl'

const paddingClass: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
  indicator: 'p-3.5',
}

const radiusClass: Record<CardRadius, string> = {
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
}

const variantClass: Record<CardVariant, string> = {
  default: 'border border-light bg-card shadow-card',
  elevated: 'border border-light bg-card shadow-lg',
  flat: 'border border-light bg-card shadow-none',
}

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant
  padding?: CardPadding
  radius?: CardRadius
}

export function Card({
  variant = 'default',
  padding = 'md',
  radius = 'lg',
  className = '',
  children,
  ...rest
}: CardProps) {
  const base = `${variantClass[variant]} ${radiusClass[radius]} ${paddingClass[padding]}`
  return (
    <div className={`${base} ${className}`.trim()} {...rest}>
      {children}
    </div>
  )
}
