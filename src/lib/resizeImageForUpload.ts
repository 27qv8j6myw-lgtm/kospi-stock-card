export type ResizedImagePayload = {
  data: string
  mediaType: 'image/jpeg'
}

/**
 * 클라이언트에서 업로드 전 리사이즈 (Vercel/API body 한도 대응)
 * @param file 원본 이미지
 * @param maxWidth 최대 너비(px)
 */
export async function resizeAndConvert(file: File, maxWidth = 1600): Promise<ResizedImagePayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('파일 읽기 실패'))

    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('이미지 로드 실패'))
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('캔버스 생성 실패'))
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        const base64 = dataUrl.split(',')[1]
        if (!base64) {
          reject(new Error('인코딩 실패'))
          return
        }
        resolve({ data: base64, mediaType: 'image/jpeg' })
      }
      img.src = String(e.target?.result ?? '')
    }

    reader.readAsDataURL(file)
  })
}
