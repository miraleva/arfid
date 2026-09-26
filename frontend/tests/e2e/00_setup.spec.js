const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

test.describe('Global Auth Setup', () => {
    test('Authenticate Golden User a@gmail.com and save storage state', async ({ page }) => {

        const dir = path.dirname(authFile); //auth klasörü var mı
        if (!fs.existsSync(dir)) { //daha önce oluşturulmamışsa 
            fs.mkdirSync(dir, { recursive: true }); //oluştur
        }

        await page.goto('/signin');
        await expect(page).toHaveTitle(/Giriş Yap|Sign In/i);

        // Fill in Golden Account credentials
        await page.fill('#email', 'a@gmail.com');
        await page.fill('#password', '123456');

        // Submit form
        await page.click('button.signButton');

        // Verify successful redirection to /chat
        await page.waitForURL('**/chat', { timeout: 15000 });
        await expect(page.locator('#messageInput')).toBeVisible();

        // Save session storage state for subsequent tests
        await page.context().storageState({ path: authFile });
        console.log(`[Setup] Storage state successfully saved to ${authFile}`);
    });
});
