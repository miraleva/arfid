const { test, expect } = require('@playwright/test');

test.describe('06. Isolated Account Deletion Life Cycle (Ephemeral User)', () => {
    // Run without storage state (clean context)
    test('6.1 Register new temporary user, delete account, and verify deleted user cannot sign in', async ({ page }) => {
        const timestamp = Date.now();
        const tempEmail = `e2e_del_${timestamp}@temp.local`;
        const tempPassword = `TempPass${timestamp}`;
        const tempUsername = `DelUser${timestamp.toString().slice(-4)}`;

        // 1. Sign Up new ephemeral user
        await page.goto('/signup');
        await expect(page.locator('#signUpForm')).toBeVisible();

        await page.fill('#email', tempEmail);
        await page.fill('#username', tempUsername);
        await page.fill('#password', tempPassword);
        await page.fill('#passwordAgain', tempPassword);

        await page.click('button.signButton');

        // Should redirect to /signin (or /chat if auto-login)
        await page.waitForURL(/\/(signin|chat)/, { timeout: 10000 });

        // If on /signin, perform login
        if (page.url().includes('/signin')) {
            await page.fill('#email', tempEmail);
            await page.fill('#password', tempPassword);
            await page.click('button.signButton');
            await page.waitForURL('**/chat', { timeout: 10000 });
        }

        expect(page.url()).toContain('/chat');
        await expect(page.locator('#openSettingsBtn')).toBeVisible();

        // 2. Open Settings modal
        await page.click('#openSettingsBtn');
        await expect(page.locator('#settingsModal')).toBeVisible();

        // 3. Click "Hesabımı Sil" button
        const deleteBtn = page.locator('#deleteAccountBtn');
        await expect(deleteBtn).toBeVisible();
        await deleteBtn.click();

        // 4. Confirm in the danger zone confirmation overlay
        const confirmOverlay = page.locator('#accountDeleteConfirmOverlay');
        await expect(confirmOverlay).toBeVisible();

        const confirmBtn = page.locator('#accountDeleteConfirmBtn');
        await expect(confirmBtn).toBeVisible();
        await confirmBtn.click();

        // 5. Verify redirection back to /signin
        await page.waitForURL('**/signin', { timeout: 10000 });
        expect(page.url()).toContain('/signin');

        // 6. Verify that the deleted account can NO LONGER log in (demonstrating full deletion)
        await page.fill('#email', tempEmail);
        await page.fill('#password', tempPassword);
        await page.click('button.signButton');

        const warning = page.locator('#emailWarning');
        await expect(warning).toBeVisible({ timeout: 5000 });
        await expect(warning).toHaveText(/E-posta veya şifre yanlış|Invalid email or password/i);
        console.log(`[Account Delete Test] Ephemeral account ${tempEmail} successfully created, deleted, and verified gone.`);
    });
});
