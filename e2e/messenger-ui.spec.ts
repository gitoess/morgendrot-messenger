/**
 * Messenger-Modus (UI_VARIANT=messenger). Port wie Lite-UI (3342) oder UI_BASE_URL.
 * Ausführung: npm run test:ui:messenger
 * Ohne Messenger-Modus werden alle Tests übersprungen (volle UI).
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function requireMessenger(page: Page): Promise<void> {
    try {
        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 25000 });
    } catch {
        test.skip(true, 'Kein UI unter UI_BASE_URL (z. B. npm run dev:lite → 3342)');
        return;
    }
    await expect(page.locator('header h1')).toHaveText(/Morgendrot/, { timeout: 15000 });
    const t = await page.locator('header h1').textContent();
    test.skip(!(t ?? '').includes('Messenger'), 'Nur mit Messenger-Modus (UI_VARIANT=messenger, z. B. Port 3342)');
}

test.describe('Messenger-Modus UI', () => {
    test('Erste Schritte + Fortschritt-Checkboxen sichtbar', async ({ page }) => {
        await requireMessenger(page);
        await expect(page.getByRole('heading', { name: /Erste Schritte/i })).toBeVisible();
        await expect(page.getByText(/Fortschritt.*lokal im Browser/i)).toBeVisible();
        await expect(page.getByRole('checkbox', { name: /RPC.*Netzwerk/i })).toBeVisible();
        await expect(page.getByRole('checkbox', { name: /PACKAGE_ID/i })).toBeVisible();
    });

    test('Setup: Transparenz & Schutz per Hash', async ({ page }) => {
        await requireMessenger(page);
        await page.goto('/#setup');
        await expect(page.getByRole('heading', { name: 'Transparenz & Schutz' })).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/öffentlich sichtbar/i).first()).toBeVisible();
    });

    test('Chat: Link zu Transparenz / Setup', async ({ page }) => {
        await requireMessenger(page);
        await page.goto('/#chat');
        await expect(page.getByRole('link', { name: /Transparenz.*Öffentlichkeit/i })).toBeVisible({ timeout: 10000 });
    });

    test('Fortschritt persistiert nach Reload', async ({ page }) => {
        await requireMessenger(page);
        await page.goto('/');
        const net = page.getByRole('checkbox', { name: /RPC.*Netzwerk/i });
        await net.setChecked(true);
        await page.reload();
        await expect(net).toBeChecked({ timeout: 10000 });
        await net.setChecked(false);
        await page.reload();
        await expect(net).not.toBeChecked();
    });

    test('Setup: Streams-Hilfe optional ausklappbar', async ({ page }) => {
        await requireMessenger(page);
        await page.goto('/#setup');
        const toggle = page.getByRole('button', { name: /Streams.*optional.*erweitert/i });
        await expect(toggle).toBeVisible({ timeout: 10000 });
        await toggle.click();
        await expect(page.getByText(/Nicht der Chat-Kanal/i)).toBeVisible();
    });
});
