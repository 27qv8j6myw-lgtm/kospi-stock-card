import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import {
  enrichStockLinkNames,
  extractStocksFromToolCalls,
  type ProToolCallUi,
} from '@/lib/proChatApi'

type ProChatStockLinksProps = {
  toolCalls?: ProToolCallUi[] | null
}

export function ProChatStockLinks({ toolCalls }: ProChatStockLinksProps) {
  const { navigate } = useAppNavigation()
  const base = useMemo(() => extractStocksFromToolCalls(toolCalls), [toolCalls])
  const [links, setLinks] = useState(base)

  useEffect(() => {
    setLinks(base)
    let cancelled = false
    void enrichStockLinkNames(base).then((enriched) => {
      if (!cancelled) setLinks(enriched)
    })
    return () => {
      cancelled = true
    }
  }, [base])

  if (!links.length) return null

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {links.slice(0, 5).map((m) => (
        <button
          key={m.code}
          type="button"
          onClick={() => navigate(`/pro/stock/${m.code}?name=${encodeURIComponent(m.name)}`)}
          className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-[10px] font-semibold text-amber-800 hover:border-amber-500"
        >
          <span>
            {m.name} ({m.code})
          </span>
          <ArrowRight size={11} />
        </button>
      ))}
    </div>
  )
}
