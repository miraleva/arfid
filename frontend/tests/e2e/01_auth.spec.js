const { test, expect } = require('@playwright/test');

test.describe('01. Authentication & Security Regressions', () => {

    test('1.1 Login with non-existent email shows error warning without silent refresh', async ({ page }) => {
        await page.goto('/signin');
        await expect(page.locator('#loginForm')).toBeVisible();

        // Enter a non-existent email
        await page.fill('#email', 'nonexistent_test_account_999@domain.com');
        await page.fill('#password', 'wrongPassword123');
        await page.click('button.signButton');

        // Verify warning is displayed and user remains on signin page
        const warning = page.locator('#emailWarning');
        await expect(warning).toBeVisible({ timeout: 5000 });
        await expect(warning).toHaveText(/E-posta veya şifre yanlış|Invalid email or password/i); //i case insensitive demek 
        expect(page.url()).toContain('/signin'); //sayfa hala signin sayfasında mı
    });

    test('1.2 Login with wrong password for existing user shows error warning', async ({ page }) => {
        await page.goto('/signin');

        await page.fill('#email', 'a@gmail.com');
        await page.fill('#password', 'definitelyWrongPassword999');
        await page.click('button.signButton');

        const warning = page.locator('#emailWarning');
        await expect(warning).toBeVisible({ timeout: 5000 });
        await expect(warning).toHaveText(/E-posta veya şifre yanlış|Invalid email or password/i);
        expect(page.url()).toContain('/signin');
    });

    test('1.3 Sign Up form validates password confirmation mismatch on client', async ({ page }) => {
        await page.goto('/signup');
        await expect(page.locator('#signUpForm')).toBeVisible();

        await page.fill('#email', 'new_valid_email@test.com');
        await page.fill('#username', 'TestUser');
        await page.fill('#password', 'SecurePass123');
        await page.fill('#passwordAgain', 'MismatchPass456');

        await page.click('button.signButton');

        const warning = page.locator('#passwordAgainWarning');
        await expect(warning).toBeVisible({ timeout: 5000 });
        await expect(warning).toHaveText(/eşleşmiyor|do not match/i);
        expect(page.url()).toContain('/signup');
    });

    test('1.4 Protected route redirects unauthenticated user to /signin', async ({ page }) => {
        // Clear all cookies
        await page.context().clearCookies();

        await page.goto('/chat');
        await page.waitForURL('**/signin', { timeout: 10000 });
        expect(page.url()).toContain('/signin');
    });
});
