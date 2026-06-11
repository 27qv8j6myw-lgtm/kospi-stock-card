import { FileText } from 'lucide-react'
import { proDesign } from '@/lib/proStockDesign'
import { ProSectionHeader } from './ProSectionHeader'

type DisclosureItem = { date: string; report: string; link: string }

type Props = {
  disclosures: DisclosureItem[]
}

/** 주가 영향이 큰 공시 제목 키워드 (서버 isMajorDisclosure 와 동일 기준) */
const MAJOR_RE =
  /유상증자|무상증자|감자|합병|분할|액면|자기주식|전환사채|신주인수권|교환사채|상장폐지|거래정지|관리종목|불성실공시|횡령|배임|파산|회생|최대주주\s*변경|영업양수|영업양도|단일판매|공급계약|영업\s*\(?잠정\)?\s*실적|소송/

function formatDartDate(date?: string): string {
  if (!date || date.length < 8) return '—'
  return `${date.slice(4, 6)}/${date.slice(6, 8)}`
}

export function ProDisclosuresSection({ disclosures }: Props) {
  if (!disclosures.length) return null

  return (
    <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
      <ProSectionHeader
        icon={<FileText size={24} className="text-sky-600" strokeWidth={1.8} />}
        title="최근 공시"
        meta={`${disclosures.length}건 · DART`}
      />

      <div className="space-y-1.5">
        {disclosures.slice(0, 5).map((item, i) => {
          const isMajor = MAJOR_RE.test(item.report)
          return (
            <a
              key={`${item.link}-${i}`}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`block ${proDesign.whiteBoxSm} ${
                isMajor ? 'border-amber-200 bg-amber-50 hover:bg-amber-100/80' : ''
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="w-8 shrink-0 text-[11px] tabular-nums text-gray-400">
                  {formatDartDate(item.date)}
                </span>
                <div className="min-w-0 flex-1">
                  <span className={`text-[13px] leading-tight text-gray-900 ${isMajor ? 'font-bold' : ''}`}>
                    {item.report}
                  </span>
                </div>
                {isMajor ? (
                  <span className="shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    중요
                  </span>
                ) : null}
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
