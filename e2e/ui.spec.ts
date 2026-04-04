/**
 * UI-Browser-Tests (Playwright).
 * Standard: statisches UI via webServer (npx serve ui, Port 3341) – ohne laufendes Backend.
 * Mit Backend: gleiche Seite; ggf. Wallet-Overlay sichtbar.
 */
import { test, expect } from '@playwright/test';

test.describe('Morgendrot UI (Lite)', () => {
    test('Startseite: Header und Hauptbereich', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('header h1')).toHaveText(/Morgendrot/, { timeout: 15000 });
        await expect(page.locator('main')).toBeVisible();
        const dashboard = page.getByText('Was möchtest du tun?');
        const unlock = page.getByRole('heading', { name: 'Wallet entsperren' });
        await expect(dashboard.or(unlock).first()).toBeVisible({ timeout: 10000 });
    });

    test('Passwort-Overlay oder Dashboard sichtbar', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('main')).toBeVisible({ timeout: 15000 });
        const dashboard = page.getByText('Was möchtest du tun?');
        const unlock = page.getByRole('heading', { name: 'Wallet entsperren' });
        const dashVis = await dashboard.isVisible().catch(() => false);
        const unlockVis = await unlock.isVisible().catch(() => false);
        expect(dashVis || unlockVis).toBe(true);
        if (unlockVis) {
            await expect(page.getByPlaceholder('Passwort eingeben')).toBeVisible();
            await expect(page.getByRole('button', { name: /Entsperren/i })).toBeVisible();
        }
    });

    test('Kachel Nachrichten öffnet Chat-Ansicht', async ({ page }) => {
        await page.goto('/');
        const dashboard = page.getByText('Was möchtest du tun?');
        await expect(dashboard.or(page.getByRole('heading', { name: 'Wallet entsperren' })).first()).toBeVisible({
            timeout: 15000,
        });
        if (await page.getByRole('heading', { name: 'Wallet entsperren' }).isVisible().catch(() => false)) {
            test.skip(true, 'Dashboard hinter Entsperr-Overlay – statischer Smoke nur mit offenem Dashboard');
            return;
        }
        await page.getByRole('button', { name: /Nachrichten/i }).first().click();
        await expect(page.getByText('Handshake & Connect')).toBeVisible({ timeout: 8000 });
    });

    test('Hilfe-Button öffnet Dialog', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('header h1')).toHaveText(/Morgendrot/, { timeout: 15000 });
        await page.locator('header button[title="Hilfe"]').click();
        await expect(page.getByRole('heading', { name: 'Hilfe' })).toBeVisible();
        await expect(page.getByText(/Lade|Befehl|help|Hilfe|Fehler|API/i).first()).toBeVisible({ timeout: 10000 });
    });
});
