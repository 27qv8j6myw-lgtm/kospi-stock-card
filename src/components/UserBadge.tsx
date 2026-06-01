type UserBadgeProps = {
  name: string
  email?: string
  avatar?: string | null
  size?: number
  showName?: boolean
}

export function UserBadge({
  name,
  email,
  avatar,
  size = 32,
  showName = true,
}: UserBadgeProps) {
  const px = size
  const initials = (name.slice(0, 2) || email?.[0] || '?').toUpperCase()
  const avatarEl = avatar ? (
    <img
      src={avatar}
      alt=""
      width={px}
      height={px}
      className="shrink-0 rounded-full bg-gray-100 object-cover"
      style={{ width: px, height: px }}
      referrerPolicy="no-referrer"
    />
  ) : (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-500"
      style={{ width: px, height: px, fontSize: Math.max(10, Math.round(px * 0.38)) }}
    >
      {initials}
    </div>
  )

  if (!showName) {
    return avatarEl
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {avatarEl}
      <div className="min-w-0">
        <div className="truncate text-[12px] font-medium text-gray-800">{name}</div>
        {email ? <div className="truncate text-[10px] text-gray-400">{email}</div> : null}
      </div>
    </div>
  )
}
