const { test, expect } = require('@playwright/test');
const path = require('path');

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

test.describe('04. Settings Modal - Nutrition Profile "Edit Mode" Flow', () => {
    test.use({ storageState: authFile });

    test.beforeEach(async ({ page }) => {
        await page.goto('/chat');
        await expect(page.locator('#openSettingsBtn')).toBeVisible();
        await page.click('#openSettingsBtn');
        await expect(page.locator('#settingsModal')).toBeVisible();

        // Switch to "Beslenme Profilim" tab
        const dietaryTab = page.locator('#settingsTabDietary');
        await dietaryTab.click();
        await page.waitForTimeout(300);
    });

    test('4.1 Default state: edit mode is OFF and container does not have editMode class', async ({ page }) => {
        const modal = page.locator('#settingsModal');

        // Verify edit mode toggle button is present and displays "Düzenle"
        const toggleBtn = modal.locator('#dietaryEditBtn');
        const toggleText = modal.locator('#dietaryEditBtnText');
        await expect(toggleBtn).toBeVisible();
        await expect(toggleText).toHaveText(/Düzenle|Edit/i);

        // Content container should NOT have editMode class
        const container = modal.locator('#dietaryContentContainer');
        await expect(container).not.toHaveClass(/editMode/);
    });

    test('4.2 Clicking "Düzenle" enters editMode and toggles button text to "Bitti"', async ({ page }) => {
        const modal = page.locator('#settingsModal');
        const toggleBtn = modal.locator('#dietaryEditBtn');
        const toggleText = modal.locator('#dietaryEditBtnText');
        const container = modal.locator('#dietaryContentContainer');

        // 1. Enter edit mode
        await toggleBtn.click();
        await expect(toggleText).toHaveText(/Bitti|Done/i);
        await expect(container).toHaveClass(/editMode/);

        // 2. Exit edit mode
        await toggleBtn.click();
        await expect(toggleText).toHaveText(/Düzenle|Edit/i);
        await expect(container).not.toHaveClass(/editMode/);
    });
});
