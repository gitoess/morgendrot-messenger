/**
 * E2E-Tests für die Lite-UI (6 Kacheln).
 * Voraussetzung: API + Lite-UI laufen (npm run dev:lite oder start:secrets), Port 3342.
 * Ausführung: npx playwright test e2e/lite-ui.spec.ts --project=lite-ui
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const LITE_UI_BASE = process.env.UI_BASE_URL || 'http://127.0.0.1:3342';

async function openLiteUiPage(page: Page): Promise<void> {
    try {
        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch {
        test.skip(true, 'Kein Server unter UI_BASE_URL (z. B. npm run dev:lite → 3342)');
    }
}

test.describe('Lite-UI E2E', () => {
    test.use({ baseURL: LITE_UI_BASE });

    test('Startseite lädt und zeigt Morgendrot-Header', async ({ page }) => {
        await openLiteUiPage(page);
        await expect(page.locator('header h1')).toHaveText(/Morgendrot/, { timeout: 10000 });
    });

    test.describe('Volle Kachel-Oberfläche', () => {
        test.beforeEach(async ({ page }) => {
            await openLiteUiPage(page);
            await expect(page.locator('header h1')).toHaveText(/Morgendrot/, { timeout: 10000 });
            const t = await page.locator('header h1').textContent();
            test.skip((t ?? '').includes('Messenger'), 'Messenger-Modus: npm run test:ui:messenger');
        });

    test('Dashboard: Übersicht und Kacheln sichtbar', async ({ page }) => {
        await openLiteUiPage(page);
        await expect(page.locator('header h1')).toHaveText(/Morgendrot/, { timeout: 10000 });
        await expect(page.getByText('Was möchtest du tun?')).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole('button', { name: /Nachrichten/i }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: /Schlüssel/i }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: /Streams/i }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: /Steuerung/i }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: /Überwachung/i }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: /Tresor/i }).first()).toBeVisible();
    });

    test('Kachel Schlüssel & Tickets öffnen: Lock-View mit Key erstellen', async ({ page }) => {
        await openLiteUiPage(page);
        await page.getByRole('button', { name: /Schlüssel/i }).first().click();
        await expect(page.getByPlaceholder('Lock-Adresse 0x…')).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('heading', { name: 'Key erstellen' })).toBeVisible();
        const keySection = page.locator('div.glass').filter({ has: page.getByRole('heading', { name: 'Key erstellen' }) });
        await expect(keySection.getByPlaceholder('Empfänger 0x…')).toBeVisible();
    });

    test('Lock-Flow: Key erstellen mit Feedback', async ({ page }) => {
        await openLiteUiPage(page);
        await page.getByRole('button', { name: /Schlüssel/i }).first().click();
        await expect(page.getByPlaceholder('Lock-Adresse 0x…')).toBeVisible({ timeout: 10000 });
        const keySection = page.locator('div.glass').filter({ has: page.getByRole('heading', { name: 'Key erstellen' }) });
        await keySection.getByPlaceholder('Lock-Adresse 0x…').fill('0x' + 'a'.repeat(64));
        await keySection.getByPlaceholder('Empfänger 0x…').fill('0x' + 'b'.repeat(64));
        await keySection.getByPlaceholder('TTL Tage').fill('7');
        await keySection.getByRole('button', { name: 'Erstellen' }).click();
        const lockView = keySection.locator('..');
        await expect(lockView.locator('p').filter({ hasText: /OK|Fehler|Adresse|Key|gesendet|Veto|LOCK_ID|Lock-ID/i })).toBeVisible({ timeout: 15000 });
    });

    test('Lock-View: Key übertragen Felder sichtbar', async ({ page }) => {
        await openLiteUiPage(page);
        await page.getByRole('button', { name: /Schlüssel/i }).first().click();
        await expect(page.getByRole('heading', { name: 'Key übertragen' })).toBeVisible({ timeout: 10000 });
        await expect(page.getByPlaceholder('Neuer Besitzer 0x…').first()).toBeVisible();
    });

    test('Kachel Nachrichten öffnen: Handshake, Partner, Nachricht senden', async ({ page }) => {
        await openLiteUiPage(page);
        await page.getByRole('button', { name: /Nachrichten/i }).first().click();
        await expect(page.getByText('Handshake & Connect')).toBeVisible({ timeout: 5000 });
        await expect(page.getByPlaceholder(/Partner 0x/)).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Nachricht senden' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Senden' })).toBeVisible();
    });

    test('Chat: Inbox-Aktualisieren zeigt Lade-/Ergebnis-Feedback', async ({ page }) => {
        await openLiteUiPage(page);
        await page.getByRole('button', { name: /Nachrichten/i }).first().click();
        await expect(page.getByRole('heading', { name: 'Posteingang', level: 4 })).toBeVisible({ timeout: 5000 });
        const inboxSection = page.getByRole('heading', { name: 'Posteingang', level: 4 }).locator('..').locator('..');
        const btn = inboxSection.getByRole('button', { name: 'Aktualisieren' });
        await btn.click();
        await expect(inboxSection.locator('p').filter({ hasText: /Backend:\s*\d|Keine Nachricht|Lade/i })).toBeVisible({ timeout: 10000 });
    });

    test('Kachel Überwachung öffnen: Heartbeat und Geräte sichtbar', async ({ page }) => {
        await openLiteUiPage(page);
        await page.getByRole('button', { name: /Überwachung/i }).first().click();
        await expect(page.getByRole('heading', { name: /Ich sende Heartbeat/ })).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole('button', { name: 'Heartbeat senden' })).toBeVisible();
        await expect(page.getByText('ENABLE_HEARTBEAT')).toBeVisible();
    });

    test('Kachel Tresor öffnen: Vault-Buttons sichtbar', async ({ page }) => {
        await openLiteUiPage(page);
        await page.getByRole('button', { name: /Tresor/i }).first().click();
        await expect(page.getByText('Lokaler Vault')).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole('button', { name: 'Lokal sichern' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Lokal laden' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'On-Chain speichern' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Notfall' })).toBeVisible();
    });

    test('Kachel Steuerung öffnen: Geräte, Profile, Provisioning sichtbar', async ({ page }) => {
        await openLiteUiPage(page);
        await page.getByRole('button', { name: /Steuerung/i }).first().click();
        await expect(page.getByRole('heading', { name: 'Registrierte Geräte' })).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole('heading', { name: 'Rollen-Parameter' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Rollen-Profile' })).toBeVisible();
        await expect(page.getByRole('heading', { name: /Code ausgeben/ })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Rolle setzen' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Befehl an Geräte' })).toBeVisible();
    });

    test('Kachel Streams öffnen: Config + Publish sichtbar', async ({ page }) => {
        await openLiteUiPage(page);
        await page.getByRole('button', { name: /Streams/i }).first().click();
        await expect(page.getByText('Streams-Konfiguration')).toBeVisible({ timeout: 5000 });
        await expect(page.getByPlaceholder('STREAMS_BRIDGE_URL')).toBeVisible();
        await expect(page.getByPlaceholder('STREAMS_ANCHOR_ID')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Status' })).toBeVisible();
    });

    test('Zurück-Button: von Lock-View zurück zum Dashboard', async ({ page }) => {
        await openLiteUiPage(page);
        await page.getByRole('button', { name: /Schlüssel/i }).first().click();
        await expect(page.getByPlaceholder('Lock-Adresse 0x…')).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: 'Zurück' }).click();
        await expect(page.getByText('Was möchtest du tun?')).toBeVisible({ timeout: 3000 });
    });

    test('Setup: Package-ID + Generate Address sichtbar', async ({ page }) => {
        await openLiteUiPage(page);
        await page.getByRole('button', { name: /Setup/i }).first().click();
        await expect(page.getByRole('heading', { name: /Package-ID/ })).toBeVisible({ timeout: 5000 });
        await expect(page.getByText('Neue Adresse generieren')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Adresse generieren' })).toBeVisible();
    });
    });
});
