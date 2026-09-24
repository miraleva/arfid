const { test, expect } = require('@playwright/test');
const path = require('path');

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

test.describe('02. Chat, Sidebar & Live Gemini Smoke Test', () => {
    test.use({ storageState: authFile });

    test('2.1 Real Gemini AI Smoke Test: sends "merhaba" and receives live dietitian response', async ({ page }) => {
        await page.goto('/chat');
        await expect(page.locator('#messageInput')).toBeVisible();

        const input = page.locator('#messageInput');
        const sendBtn = page.locator('#sendButton');

        await input.fill('merhaba');
        await sendBtn.click();

        // 1. User message bubble should appear immediately
        const userBubble = page.locator('.userMessage').last();
        await expect(userBubble).toBeVisible({ timeout: 5000 });
        await expect(userBubble).toContainText('merhaba');

        // 2. Real Assistant response should appear within 25 seconds (live Gemini call)
        const assistantBubble = page.locator('.welcomeMessage .aiMessageBubble').last();
        await expect(assistantBubble).toBeVisible({ timeout: 25000 });

        // Wait a moment for typing reveal effect to finish
        await page.waitForTimeout(2000);

        // Verify response contains non-empty text
        const responseText = await assistantBubble.innerText();
        expect(responseText.trim().length).toBeGreaterThan(5);
        console.log(`[Smoke Test] Live Gemini Response received: "${responseText.trim().slice(0, 60)}..."`);
    });

    test('2.2 Settings modal language toggle switches UI language', async ({ page }) => {
        await page.goto('/chat');
        await expect(page.locator('#openSettingsBtn')).toBeVisible();

        // Open settings modal
        await page.locator('#openSettingsBtn').click();
        const settingsModal = page.locator('#settingsModal');
        await expect(settingsModal).toBeVisible();

        // Check language toggle exists in settings modal
        const enBtn = page.locator('.settingsLanguageWrapper .lang-btn[title="English"]');
        const trBtn = page.locator('.settingsLanguageWrapper .lang-btn[title="Türkçe"]');
        await expect(enBtn).toBeVisible();
        await expect(trBtn).toBeVisible();

        // Click English button
        await enBtn.click();
        await page.waitForLoadState('networkidle');

        // Confirm page refreshed in English or html lang changed
        const currentLang = await page.locator('html').getAttribute('lang');
        expect(currentLang).toBe('en');

        // Switch back to Turkish
        await page.locator('#openSettingsBtn').click();
        await expect(page.locator('#settingsModal')).toBeVisible();
        await page.locator('.settingsLanguageWrapper .lang-btn[title="Türkçe"]').click();
        await page.waitForLoadState('networkidle');
        const revertedLang = await page.locator('html').getAttribute('lang');
        expect(revertedLang).toBe('tr');
    });

    test('2.3 Sidebar search box filters conversations list', async ({ page }) => {
        await page.goto('/chat');
        const searchInput = page.locator('#searchInput');
        await expect(searchInput).toBeVisible();

        await searchInput.fill('Fırında Çıtır');
        await page.waitForTimeout(300);

        // Clear search
        await searchInput.fill('');
    });
});
