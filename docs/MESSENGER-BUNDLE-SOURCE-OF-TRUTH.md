# Messenger-Bundles (`exports/Morgendrot-Messenger-*`) – Quelle der Wahrheit

## Kurzfassung

| Ort | Rolle |
|-----|--------|
| **`src/`**, **`ui/`**, **`move-test/`** im **Haupt-Repo** | **Einzige** Bearbeitungsquelle für Backend-/Messenger-Logik und Lite-UI. |
| **`exports/Morgendrot-Messenger-standalone/`** | **Kopie**, erzeugt durch **`npm run bundle:messenger`** (`scripts/bundle-messenger-standalone.ts`). |
| **`exports/Morgendrot-Messenger-verkauf/`** | **Kopie** (Edition `sales`), derselbe Build. |

**Regel:** Änderungen **nie** dauerhaft nur im Bundle-Ordner machen – sie gehen beim nächsten Bundle-Lauf verloren. Immer **`src/`** (und ggf. `frontend/` für Next) anpassen, dann **`npm run bundle:messenger`** ausführen, bevor ein Kundenordner ausgeliefert wird.

## Was der Bundle-Script macht

Siehe **`scripts/bundle-messenger-standalone.ts`**:

- Rekursiv **`src/`** → `exports/…/src/`
- Rekursiv **`ui/`** → `exports/…/ui/`
- Rekursiv **`move-test/`** → `exports/…/move-test/`
- Auswahl **`scripts/*.ts`** (Tests, Mock, validate-ui) → `exports/…/scripts/`
- Eigene **`package.json`** (gekürzte Scripts), **`main.cjs`** (Desktop), **`.env.example`**, **`README.md`**

Das **Next.js-Frontend** (`frontend/`) liegt **nicht** in diesen ZIP-fähigen Bundles; die Messenger-Lite-Oberfläche nutzt **`ui/`**.

## Vergleich „exports vs. src“

Es gibt **keine** automatische bidirektionale Synchronisation. **Diff** zwischen `exports/…/src/chain-access.ts` und `src/chain-access.ts` sollte nach einem frischen Bundle **leer** sein. Weicht der Export ab, wurde entweder das Bundle nicht neu gebaut oder jemand hat **fälschlich im Export editiert**.

## Cleanup-Strategie

1. **Canonical:** immer `src/` pflegen.  
2. **Nach größeren Refactors:** `npm run bundle:messenger` und ggf. Diff prüfen.  
3. **Keine** „Leichen“ im Export löschen, ohne zu prüfen, ob die Datei im Haupt-`src/` noch existiert – sonst driftet der Kunde vom Entwicklungsstand.

---

*Ergänzt die gezielte Aufräum-Strategie: kleine Schritte, keine blinden Massen-Löschungen in Bundles.*
