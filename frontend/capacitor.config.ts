import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Minimaler Startpunkt fuer den Android-Readiness-Track.
 * Web-Assets kommen aus dem statischen Next-Export (`out`) fuer den APK-Track.
 */
const config: CapacitorConfig = {
  appId: 'de.morgendrot.messenger',
  appName: 'Morgendrot Messenger',
  webDir: 'out',
}

export default config
