/** Browser-TTS (de-DE). Erneuter Aufruf stoppt laufendes Vorlesen. */
export function speakOrStopGermanText(text: string, maxChars = 8000): void {
  if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') return
  const synth = window.speechSynthesis
  if (synth.speaking) {
    synth.cancel()
    return
  }
  const speakable = text.trim().slice(0, maxChars)
  if (!speakable) return
  if (typeof SpeechSynthesisUtterance === 'undefined') return
  const utter = new SpeechSynthesisUtterance(speakable)
  utter.lang = 'de-DE'
  synth.speak(utter)
}

export function canSpeakGermanText(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis !== 'undefined' &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  )
}
