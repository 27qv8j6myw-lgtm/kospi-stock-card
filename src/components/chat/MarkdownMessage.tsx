import { memo } from 'react'
import type { Components } from 'react-markdown'
import type { ReactNode } from 'react'
import { AlertCircle, BarChart3, Lightbulb, Newspaper, ShieldAlert, Target } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function childText(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(childText).join('')
  return ''
}

function getHeaderIcon(text: string) {
  if (text.includes('결론')) return <Target size={14} className="text-amber-700" strokeWidth={2} />
  if (text.includes('지표') || text.includes('핵심'))
    return <BarChart3 size={14} className="text-amber-700" strokeWidth={2} />
  if (text.includes('전략') || text.includes('매매'))
    return <ShieldAlert size={14} className="text-amber-700" strokeWidth={2} />
  if (text.includes('리스크') || text.includes('주의'))
    return <AlertCircle size={14} className="text-amber-700" strokeWidth={2} />
  if (text.includes('이슈') || text.includes('뉴스'))
    return <Newspaper size={14} className="text-amber-700" strokeWidth={2} />
  if (text.includes('호재') || text.includes('악재'))
    return <Lightbulb size={14} className="text-amber-700" strokeWidth={2} />
  return null
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-3 mb-2 break-words text-[15px] font-bold tracking-tight text-gray-900">
      {children}
    </h1>
  ),
  h2: ({ children }) => {
    const text = childText(children)
    const icon = getHeaderIcon(text)
    return (
      <h2 className="mt-3 mb-2 flex items-center gap-1.5 break-words text-[14px] font-bold tracking-tight text-gray-900">
        {icon ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-100">
            {icon}
          </span>
        ) : null}
        {children}
      </h2>
    )
  },
  h3: ({ children }) => {
    const text = childText(children)
    const icon = getHeaderIcon(text)
    return (
      <h3 className="mt-3 mb-1.5 flex items-center gap-1.5 break-words text-[13px] font-bold tracking-tight text-gray-900">
        {icon ? (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-100">
            {icon}
          </span>
        ) : null}
        {children}
      </h3>
    )
  },
  p: ({ children }) => (
    <p className="mb-2 break-words text-[13px] leading-relaxed tracking-tight text-gray-900">
      {children}
    </p>
  ),
  strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="text-gray-700 italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 text-[13px] text-gray-900">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 text-[13px] text-gray-900">{children}</ol>
  ),
  li: ({ children }) => <li className="break-words leading-relaxed">{children}</li>,
  table: ({ children }) => (
    <div className="-mx-1 my-3 overflow-x-auto rounded-lg border border-amber-200">
      <table className="w-full border-collapse bg-white text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-amber-100">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-amber-200 px-2.5 py-2 text-left text-[11px] font-bold text-amber-900">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-amber-100 bg-white px-2.5 py-2 tabular-nums">{children}</td>
  ),
  tr: ({ children }) => <tr className="hover:bg-amber-50">{children}</tr>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-[3px] border-amber-500 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const inline = !className
    if (inline) {
      return (
        <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-red-600">
          {children}
        </code>
      )
    }
    return (
      <pre className="my-2 overflow-x-auto rounded-lg bg-gray-900 p-3 text-white">
        <code className="font-mono text-[12px]">{children}</code>
      </pre>
    )
  },
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline hover:text-blue-700"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-gray-200" />,
}

type MarkdownMessageProps = {
  content: string
}

/** 모델이 `###제목` 처럼 공백 없이 출력할 때 헤더가 파싱되도록 보정 */
function normalizeMarkdown(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/^(#{1,6})([^\s#\n])/gm, '$1 $2')
}

export const MarkdownMessage = memo(function MarkdownMessage({ content }: MarkdownMessageProps) {
  if (!content) return null
  const normalized = normalizeMarkdown(content)
  return (
    <div className="prose-chat min-w-0 max-w-none break-words">
      <ReactMarkdown
        remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
        components={components}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  )
})
