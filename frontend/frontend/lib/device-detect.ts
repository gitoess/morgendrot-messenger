/** Grobe Erkennung: Handy/Tablet-Browser → `<input capture>`; sonst Webcam (`getUserMedia`). */

export function prefersFileCameraCapture(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true
  // iPadOS 13+ kann als Macintosh maskieren – Touch = eher Kamera-App über Datei-Picker
  if (navigator.maxTouchPoints > 1 && !/Mobi/i.test(ua)) return true
  return false
}
