'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { resizeAndConvert } from '@/lib/resizeImageForUpload'

type SearchRow = { code: string; name: string }

type OcrRow = {
  name: string
  code: string | null
  matchedName: string | null
  quantity: number | string
  avgPrice: number | string
  checked: boolean
}

type Props = {
  groupId: string
  groupName?: string
  onClose: () => void
  onAdded: () => void
}

export function AddHoldingModal({ groupId, groupName, onClose, onAdded }: Props) {
  const [tab, setTab] = useState<'manual' | 'ocr'>('manual')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchRow[]>([])
  const [selected, setSelected] = useState<SearchRow | null>(null)
  const [quantity, setQuantity] = useState('')
  const [avgPrice, setAvgPrice] = useState('')

  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResults, setOcrResults] = useState<OcrRow[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (tab !== 'manual' || query.trim().length < 1) {
      setResults([])
      return
    }
    const timer = setTimeout(() => {
      void authFetch(apiUrl(`/api/stocks-search?q=${encodeURIComponent(query.trim())}`))
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results?: SearchRow[]; items?: SearchRow[] }) => {
          const rows = Array.isArray(d.results)
            ? d.results
            : Array.isArray(d.items)
              ? d.items
              : []
          setResults(rows)
        })
        .catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [query, tab])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setOcrLoading(true)
    setOcrResults([])

    try {
      const base64 = await resizeAndConvert(file, 1600)
      const r = await authFetch(apiUrl('/api/pro-holdings-ocr'), {
        method: 'POST',
        body: JSON.stringify({
          imageBase64: base64.data,
          mediaType: base64.mediaType,
        }),
      })

      if (r.ok) {
        const d = (await r.json()) as {
          stocks?: Array<{
            name: string
            code: string | null
            matchedName: string | null
            quantity: number
            avgPrice: number
          }>
        }
        setOcrResults(
          (d.stocks || []).map((s) => ({
            ...s,
            checked: Boolean(s.code),
          })),
        )
        if (!d.stocks?.length) {
          alert('추출된 종목이 없습니다. 다른 캡처로 다시 시도해 주세요.')
        }
      } else {
        const err = (await r.json().catch(() => ({}))) as { error?: string }
        alert(err.error || '이미지 분석 실패')
      }
    } catch (err) {
      console.error('[Holdings OCR]', err)
      alert('이미지 처리 실패')
    } finally {
      setOcrLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const saveOcrResults = async () => {
    const toSave = ocrResults.filter(
      (s) => s.checked && s.code && s.quantity && s.avgPrice,
    )
    if (toSave.length === 0) {
      alert('저장할 종목이 없습니다 (코드 매칭·수량·평단가 확인)')
      return
    }

    setSaving(true)
    try {
      for (const s of toSave) {
        const r = await authFetch(apiUrl('/api/pro-holdings'), {
          method: 'POST',
          body: JSON.stringify({
            code: s.code,
            name: s.matchedName || s.name,
            quantity: parseFloat(String(s.quantity)),
            avg_price: parseFloat(String(s.avgPrice)),
            group_id: groupId,
          }),
        })
        if (!r.ok) {
          const d = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(d.error || '저장 실패')
        }
      }
      onAdded()
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const saveManual = async () => {
    if (!selected || !quantity || !avgPrice) return
    setSaving(true)
    try {
      const r = await authFetch(apiUrl('/api/pro-holdings'), {
        method: 'POST',
        body: JSON.stringify({
          code: selected.code,
          name: selected.name,
          quantity: parseFloat(quantity),
          avg_price: parseFloat(avgPrice),
          group_id: groupId,
        }),
      })
      if (r.ok) onAdded()
      else {
        const d = (await r.json().catch(() => ({}))) as { error?: string }
        alert(d.error || '저장 실패')
      }
    } catch {
      alert('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const resetOcr = () => {
    setOcrResults([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const savableOcrCount = ocrResults.filter((s) => s.checked && s.code).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="add-holding-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id="add-holding-title" className="text-[16px] font-bold text-gray-900">
            보유종목 추가{groupName ? ` · ${groupName}` : ''}
          </h3>
          <button type="button" onClick={onClose} aria-label="닫기">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setTab('manual')}
            className={`flex-1 rounded-md py-2 text-[13px] font-bold ${
              tab === 'manual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            직접 입력
          </button>
          <button
            type="button"
            onClick={() => setTab('ocr')}
            className={`flex-1 rounded-md py-2 text-[13px] font-bold ${
              tab === 'ocr' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            캡처 분석
          </button>
        </div>

        {tab === 'manual' ? (
          <>
            {!selected ? (
              <>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="종목 검색 (예: 산일전기, 062040)"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  name="holding-search-query"
                  className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-[14px]"
                />
                <div className="max-h-48 overflow-y-auto">
                  {results.map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => setSelected(s)}
                      className="w-full rounded px-3 py-2 text-left text-[14px] hover:bg-gray-50"
                    >
                      <span className="font-bold">{s.name}</span>
                      <span className="ml-2 text-[12px] text-gray-400">{s.code}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <span className="text-[14px] font-bold">{selected.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="text-[12px] text-gray-500"
                  >
                    변경
                  </button>
                </div>
                <label className="mb-1 block text-[12px] font-semibold text-gray-500">
                  보유 수량
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="10"
                  className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-[14px] tabular-nums"
                />
                <label className="mb-1 block text-[12px] font-semibold text-gray-500">
                  평균 단가 (원)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={avgPrice}
                  onChange={(e) => setAvgPrice(e.target.value)}
                  placeholder="195000"
                  className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-[14px] tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => void saveManual()}
                  disabled={saving || !quantity || !avgPrice}
                  className="w-full rounded-lg bg-gray-900 py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '추가'}
                </button>
              </>
            )}
          </>
        ) : (
          <>
            {ocrResults.length === 0 ? (
              <div>
                <p className="mb-3 text-[12px] leading-relaxed text-gray-500">
                  증권사 앱의 보유종목(잔고) 화면을 캡처해서 올려주세요. AI가 종목명, 수량,
                  평단가를 자동으로 읽어냅니다.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleImageUpload(e)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={ocrLoading}
                  className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-8 hover:border-gray-400 disabled:opacity-50"
                >
                  {ocrLoading ? (
                    <span className="text-[13px] text-gray-500">분석 중...</span>
                  ) : (
                    <>
                      <Upload size={28} className="text-gray-400" strokeWidth={1.5} />
                      <span className="text-[13px] font-bold text-gray-600">이미지 선택</span>
                    </>
                  )}
                </button>
                <p className="mt-2 text-center text-[10px] text-gray-400">
                  이미지는 분석 후 저장되지 않습니다
                </p>
              </div>
            ) : (
              <div>
                <p className="mb-3 text-[12px] text-gray-500">추출된 종목 (확인 후 저장)</p>
                <div className="mb-4 max-h-64 space-y-2 overflow-y-auto">
                  {ocrResults.map((s, idx) => (
                    <div
                      key={`${s.name}-${idx}`}
                      className={`rounded-lg border p-3 ${
                        s.code ? 'border-gray-200' : 'border-amber-200 bg-amber-50'
                      }`}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={s.checked}
                          onChange={(e) => {
                            const next = [...ocrResults]
                            next[idx] = { ...next[idx], checked: e.target.checked }
                            setOcrResults(next)
                          }}
                        />
                        <span className="text-[14px] font-bold">{s.matchedName || s.name}</span>
                        {!s.code ? (
                          <span className="text-[10px] text-amber-600">종목 매칭 안됨</span>
                        ) : (
                          <span className="text-[10px] tabular-nums text-gray-400">{s.code}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-500">수량</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={s.quantity}
                            onChange={(e) => {
                              const next = [...ocrResults]
                              next[idx] = { ...next[idx], quantity: e.target.value }
                              setOcrResults(next)
                            }}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-[13px] tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500">평단가</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={s.avgPrice}
                            onChange={(e) => {
                              const next = [...ocrResults]
                              next[idx] = { ...next[idx], avgPrice: e.target.value }
                              setOcrResults(next)
                            }}
                            className="w-full rounded border border-gray-200 px-2 py-1 text-[13px] tabular-nums"
                          />
                        </div>
                      </div>
                      {!s.code ? (
                        <OcrCodeSearch
                          name={s.name}
                          onPick={(row) => {
                            const next = [...ocrResults]
                            next[idx] = {
                              ...next[idx],
                              code: row.code,
                              matchedName: row.name,
                              checked: true,
                            }
                            setOcrResults(next)
                          }}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void saveOcrResults()}
                  disabled={saving || savableOcrCount === 0}
                  className="w-full rounded-lg bg-gray-900 py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
                >
                  {saving ? '저장 중...' : `${savableOcrCount}개 종목 저장`}
                </button>
                <button
                  type="button"
                  onClick={resetOcr}
                  className="mt-2 w-full py-2 text-[12px] text-gray-500"
                >
                  다시 캡처
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function OcrCodeSearch({
  name,
  onPick,
}: {
  name: string
  onPick: (row: SearchRow) => void
}) {
  const [q, setQ] = useState(name)
  const [rows, setRows] = useState<SearchRow[]>([])

  useEffect(() => {
    if (q.trim().length < 1) {
      setRows([])
      return
    }
    const timer = setTimeout(() => {
      void authFetch(apiUrl(`/api/stocks-search?q=${encodeURIComponent(q.trim())}`))
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results?: SearchRow[]; items?: SearchRow[] }) => {
          const list = Array.isArray(d.results)
            ? d.results
            : Array.isArray(d.items)
              ? d.items
              : []
          setRows(list.slice(0, 5))
        })
        .catch(() => setRows([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  return (
    <div className="mt-2 border-t border-amber-200 pt-2">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="종목 검색으로 코드 지정"
        className="mb-1 w-full rounded border border-amber-200 px-2 py-1 text-[12px]"
      />
      {rows.map((r) => (
        <button
          key={r.code}
          type="button"
          onClick={() => onPick(r)}
          className="block w-full rounded px-2 py-1 text-left text-[12px] hover:bg-amber-100"
        >
          {r.name} <span className="text-gray-400">{r.code}</span>
        </button>
      ))}
    </div>
  )
}
