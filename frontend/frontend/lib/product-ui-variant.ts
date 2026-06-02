/** Backend `GET /api/status` → `uiVariant` (`.env` `UI_VARIANT`). */
export type UiVariant = 'full' | 'messenger'

export function isMessengerProductUiVariant(uiVariant?: string | null): boolean {
  return (uiVariant || '').trim().toLowerCase() === 'messenger'
}

export function isProjektProductUiVariant(uiVariant?: string | null): boolean {
  return !isMessengerProductUiVariant(uiVariant)
}
