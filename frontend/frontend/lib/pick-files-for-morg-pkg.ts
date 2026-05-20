/** Dateiauswahl für .morg-pkg-Export — zuerst native API (bleibt an Nutzer-Geste gekoppelt). */
export async function pickFilesForMorgPkgExport(
  fallbackInput: HTMLInputElement | null
): Promise<File[]> {
  const w = window as Window & {
    showOpenFilePicker?: (options?: {
      multiple?: boolean
      types?: { description: string; accept: Record<string, string[]> }[]
    }) => Promise<FileSystemFileHandle[]>
  }

  if (typeof w.showOpenFilePicker === 'function') {
    try {
      const handles = await w.showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: 'Bilder, Text, Opus',
            accept: {
              'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
              'text/plain': ['.txt'],
              'audio/ogg': ['.opus', '.ogg'],
              'application/ogg': ['.opus', '.ogg'],
            },
          },
        ],
      })
      return await Promise.all(handles.map((h) => h.getFile()))
    } catch (e) {
      const name = (e as DOMException)?.name
      if (name === 'AbortError') return []
      throw e
    }
  }

  if (!fallbackInput) return []

  return new Promise((resolve) => {
    const onChange = () => {
      fallbackInput.removeEventListener('change', onChange)
      const files = Array.from(fallbackInput.files ?? [])
      fallbackInput.value = ''
      resolve(files)
    }
    fallbackInput.addEventListener('change', onChange)
    fallbackInput.click()
  })
}
