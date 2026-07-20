import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import {
  addProMemory,
  deleteProMemory,
  fetchProMemories,
  type ProMemory,
} from '@/lib/proChatApi'

type ProMemoryModalProps = {
  open: boolean
  onClose: () => void
}

export function ProMemoryModal({ open, onClose }: ProMemoryModalProps) {
  const [items, setItems] = useState<ProMemory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchProMemories())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const handleAdd = useCallback(async () => {
    const content = draft.trim()
    if (!content || saving) return
    setSaving(true)
    setError(null)
    try {
      const item = await addProMemory(content)
      if (item) setItems((prev) => [item, ...prev])
      setDraft('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [draft, saving])

  const handleDelete = useCallback(async (id: string) => {
    setError(null)
    try {
      await deleteProMemory(id)
      setItems((prev) => prev.filter((m) => m.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">기억 관리</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              AI가 모든 대화에서 반영할 매매 원칙·선호입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleAdd()
                }
              }}
              placeholder="예: 손절은 -7% 고정"
              maxLength={200}
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-[13px] outline-none focus:border-gray-900"
            />
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={!draft.trim() || saving}
              className="flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-[12px] font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              <span>추가</span>
            </button>
          </div>
        </div>

        {error ? (
          <p className="px-4 pt-2 text-[11px] text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex justify-center py-8 text-gray-400">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-gray-400">
              저장된 기억이 없습니다.
              <br />
              채팅에서 “…를 기억해줘”라고 하면 자동으로 저장됩니다.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {items.map((m) => (
                <li
                  key={m.id}
                  className="group flex items-start justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 text-[13px] leading-snug text-gray-800">
                    {m.content}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(m.id)}
                    className="mt-0.5 text-gray-400 hover:text-red-500"
                    aria-label="기억 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
