import type { OnboardingPath, OnboardingStepId } from '@/frontend/lib/onboarding-progress-store'

/** Eine Zeile — was der Nutzer jetzt tun soll (kein Fachjargon-Dump). */
export function onboardingStepHint(path: OnboardingPath, stepId: OnboardingStepId): string {
  if (path === 'boss') {
    switch (stepId) {
      case 'wallet':
        return 'Wallet anlegen oder entsperren — deine Adresse siehst du oben im Messenger.'
      case 'network-plan':
        return 'Testnet zum Üben, Mainnet zum Verankern — oder nur eines von beiden.'
      case 'einsatz-rules':
        return 'Aufbewahrung und Löschen festlegen — ohne neuen Blockchain-Contract.'
      case 'chain':
      case 'package':
        return 'Testnet-Token besorgen, dann Messenger-Contract anlegen.'
      case 'mailboxes':
        return 'Postfächer prüfen — meist schon vom Chain-Schritt da; Namen für Helfer später.'
      case 'telegram':
        return 'Optional — Bot-Alarme; überspringbar wenn du kein Telegram brauchst.'
      case 'meshtastic':
        return 'Optional — Heltec-Stick koppeln; Node-ID optional für Team-Funk.'
      case 'done':
        return 'Mit Fertig schließt du den Wizard — jederzeit wieder unter Einstellungen.'
      default:
        return ''
    }
  }
  if (path === 'helper') {
    switch (stepId) {
      case 'handoff':
        return 'ZIP vom Boss importieren — enthält alle Einsatz-IDs.'
      case 'telegram':
        return 'Optional — Link aus dem Handoff.'
      case 'wallet':
        return 'Seed vom Boss scannen oder eingeben.'
      case 'team-self':
        return 'Dein Einsatz-Name und optional Funk.'
      case 'peering':
        return 'Boss-Adresse aus dem Handoff — für verschlüsselten Chat.'
      case 'done':
        return 'Mit Fertig schließt du den Wizard — Chat und Posteingang nutzen.'
      default:
        return ''
    }
  }
  switch (stepId) {
    case 'wallet':
      return 'Wallet anlegen — bleibt nur auf diesem Gerät.'
    case 'address':
      return 'Adresse bestätigen.'
    case 'private-mailbox':
      return 'Optional — Postfächer für dich allein.'
    case 'meshtastic':
      return 'Optional — Funk-Stick.'
    case 'done':
      return 'Mit Fertig schließt du den Wizard — jederzeit wieder unter Einstellungen.'
    default:
      return ''
  }
}
