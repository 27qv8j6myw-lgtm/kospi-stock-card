import { useEffect, useState } from 'react'
import { Bookmark, Check, MessageCircle } from 'lucide-react'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

export function ProActionButtons({ code, name }: { code: string; name: string }) {
  const { navigate } = useAppNavigation()
  const [inWatchlist, setInWatchlist] = useState(false)

  useEffect(() => {
    void authFetch(apiUrl('/api/pro-watchlist'))
      .then((r) => (r.ok ? r.json() : { watchlist: [] }))
      .then((d: { watchlist?: Array<{ code: string }> }) => {
        setInWatchlist(!!d.watchlist?.find((w) => w.code === code))
      })
      .catch(() => setInWatchlist(false))
  }, [code])

  const toggleWatchlist = async () => {
    if (inWatchlist) {
      await authFetch(apiUrl(`/api/pro-watchlist?code=${code}`), { method: 'DELETE' })
      setInWatchlist(false)
    } else {
      await authFetch(apiUrl('/api/pro-watchlist'), {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
      setInWatchlist(true)
    }
  }

  return (
    <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
      <button
        type="button"
        onClick={() => navigate(`/pro/chat?stock=${code}&name=${encodeURIComponent(name)}`)}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-gray-900 py-2.5 text-[13px] font-bold text-white hover:bg-gray-800"
      >
        <MessageCircle size={16} strokeWidth={1.8} />
        <span>채팅 분석</span>
      </button>
      <button
        type="button"
        onClick={() => void toggleWatchlist()}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2.5 text-[13px] font-bold transition-colors ${
          inWatchlist
            ? 'border border-amber-200 bg-amber-50 text-amber-800'
            : 'border border-gray-300 bg-white text-gray-900 hover:border-gray-400'
        }`}
      >
        {inWatchlist ? (
          <Check size={16} strokeWidth={2} />
        ) : (
          <Bookmark size={16} strokeWidth={1.8} className="text-amber-600" />
        )}
        <span>{inWatchlist ? '등록됨' : '즐겨찾기'}</span>
      </button>
    </div>
  )
}
