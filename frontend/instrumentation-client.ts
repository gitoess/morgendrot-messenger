/**
 * Läuft vor Hydration (Next ≥15.3) — Meshtastic-Plain-Object-Rejects dürfen
 * nicht erst nach `use-meshtastic-ble`-Import den Next-Overlay erreichen.
 */
import { installMeshtasticConsoleErrorFilter } from '@/frontend/lib/meshtastic-console-error-filter'

installMeshtasticConsoleErrorFilter()
