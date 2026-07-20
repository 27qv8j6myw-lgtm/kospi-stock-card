import { domToBlob } from 'modern-screenshot'

export type ShareResult = 'shared' | 'downloaded' | 'copied'

/**
 * 캡처 대상 DOM 노드를 고해상도 PNG Blob 으로 변환.
 */
export async function captureToBlob(node: HTMLElement): Promise<Blob> {
  return domToBlob(node, {
    scale: 2,
    backgroundColor: '#ffffff',
    style: { overflow: 'hidden' },
  })
}

/** 브라우저 다운로드 트리거 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/** 클립보드 이미지 복사 (best-effort) */
async function copyToClipboard(blob: Blob): Promise<boolean> {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined
    const ClipboardItemCtor = (
      window as unknown as { ClipboardItem?: typeof ClipboardItem }
    ).ClipboardItem
    if (nav?.clipboard?.write && ClipboardItemCtor) {
      await nav.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })])
      return true
    }
  } catch {
    // 무시
  }
  return false
}

/**
 * 캡처된 이미지를 공유한다.
 * - 모바일(navigator.share + files 지원): 네이티브 공유 시트
 * - 데스크탑/윈도우: 클립보드 이미지 복사 → 실패 시 다운로드
 */
export async function shareStockImage(
  blob: Blob,
  opts: { filename: string; title?: string; text?: string },
): Promise<ShareResult> {
  const file = new File([blob], opts.filename, { type: 'image/png' })

  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  if (nav?.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: opts.title, text: opts.text })
      return 'shared'
    } catch (e) {
      // 사용자가 공유 시트를 취소한 경우는 조용히 종료
      if (e instanceof DOMException && e.name === 'AbortError') {
        return 'shared'
      }
      // 그 외 공유 실패는 폴백으로 진행
    }
  }

  // 데스크탑/윈도우: 클립보드 복사 우선 (채팅·문서에 바로 붙여넣기)
  if (await copyToClipboard(blob)) {
    return 'copied'
  }

  // 클립보드 미지원/실패 시 다운로드
  triggerDownload(blob, opts.filename)
  return 'downloaded'
}

/**
 * 캡처된 이미지를 항상 PNG 파일로 저장(다운로드)한다.
 */
export function downloadImage(blob: Blob, filename: string): ShareResult {
  triggerDownload(blob, filename)
  return 'downloaded'
}
