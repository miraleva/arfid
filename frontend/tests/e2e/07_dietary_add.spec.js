const { test, expect } = require('@playwright/test');

test.describe('07. Settings Modal - Dietary Profile Manual Add & Status Shift Flow (Ephemeral Account)', () => {
    let tempUser = null;

    test.beforeAll(async ({ browser }) => {
        const page = await browser.newPage();
        const timestamp = Date.now();
        const tempEmail = `e2e_diet_${timestamp}@temp.local`;
        const tempPassword = `TempPass${timestamp}`;
        const tempUsername = `DietUser${timestamp.toString().slice(-4)}`;

        await page.goto('/signup');
        await expect(page.locator('#signUpForm')).toBeVisible();

        await page.fill('#email', tempEmail);
        await page.fill('#username', tempUsername);
        await page.fill('#password', tempPassword);
        await page.fill('#passwordAgain', tempPassword);

        await page.click('button.signButton');

        await page.waitForURL(/\/(chat|signin)/, { timeout: 10000 });

        if (page.url().includes('/signin')) {
            await page.fill('#email', tempEmail);
            await page.fill('#password', tempPassword);
            await page.click('button.signButton');
            await page.waitForURL('**/chat', { timeout: 10000 });
        }

        tempUser = { email: tempEmail, password: tempPassword, username: tempUsername };
        await page.close();
    });

    test.afterAll(async ({ browser }) => {
        if (!tempUser) return;
        try {
            const page = await browser.newPage();
            await page.goto('/signin');
            await page.fill('#email', tempUser.email);
            await page.fill('#password', tempUser.password);
            await page.click('button.signButton');
            await page.waitForURL('**/chat', { timeout: 10000 });

            await page.click('#openSettingsBtn');
            await expect(page.locator('#settingsModal')).toBeVisible();
            await page.click('#deleteAccountBtn');
            await page.click('#accountDeleteConfirmBtn');
            await page.waitForURL('**/signin', { timeout: 10000 });
            await page.close();
            console.log(`[Dietary Add E2E] Cleaned up ephemeral user: ${tempUser.email}`);
        } catch (e) {
            console.warn('[Dietary Add E2E] Ephemeral cleanup warning:', e.message);
        }
    });

    test.beforeEach(async ({ page }) => {
        await page.goto('/signin');
        await page.fill('#email', tempUser.email);
        await page.fill('#password', tempUser.password);
        await page.click('button.signButton');
        await page.waitForURL('**/chat', { timeout: 10000 });

        await expect(page.locator('#openSettingsBtn')).toBeVisible();
        await page.click('#openSettingsBtn');
        await expect(page.locator('#settingsModal')).toBeVisible();

        const dietaryTab = page.locator('#settingsTabDietary');
        await dietaryTab.click();
        await expect(page.locator('#settingsPaneDietary[data-loaded="true"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#dietaryContentContainer')).toBeVisible();
    });

    test('7.1 Input security & format validation: empty, pure numbers, and invalid characters are blocked', async ({ page }) => {
        const modal = page.locator('#settingsModal');
        await expect(modal.locator('#settingsPaneDietary')).toBeVisible();

        const safeInput = modal.locator('#safeFoodInput');
        const safeAddBtn = modal.locator('#safeFoodAddBtn');
        const safeNotice = modal.locator('#safeFoodNotice');

        // 1. Empty input
        await safeInput.fill('   ');
        await safeAddBtn.click();
        await expect(safeNotice).toBeVisible();
        await expect(safeNotice).toContainText(/2 ile 40 karakter/i);

        // 2. Pure numbers ('8888')
        await safeInput.fill('8888');
        await safeAddBtn.click();
        await expect(safeNotice).toBeVisible();
        await expect(safeNotice).toContainText(/en az 1 harf/i);

        // 3. Dot character ('Pirin.')
        await safeInput.fill('Pirin.');
        await safeAddBtn.click();
        await expect(safeNotice).toBeVisible();
        await expect(safeNotice).toContainText(/Nokta veya özel karakter/i);
    });

    test('7.2 Adding valid safe food and sensory trigger updates UI dynamically', async ({ page }) => {
        const modal = page.locator('#settingsModal');

        // 1. Add valid safe food with Turkish characters & spaces
        const safeFoodName = 'Kırmızı Elma';
        const safeInput = modal.locator('#safeFoodInput');
        const safeAddBtn = modal.locator('#safeFoodAddBtn');

        const initialSafeCount = parseInt((await modal.locator('#safeFoodsCount').innerText()) || '0', 10);
        await safeInput.fill(safeFoodName);
        await safeAddBtn.click();

        // Verify tag appears in safe list and count increases
        const addedSafeTag = modal.locator('#safeFoodsList .dietaryTag', { hasText: safeFoodName });
        await expect(addedSafeTag).toBeVisible({ timeout: 5000 });
        const newSafeCount = parseInt((await modal.locator('#safeFoodsCount').innerText()) || '0', 10);
        expect(newSafeCount).toBe(initialSafeCount + 1);

        // 2. Add sensory trigger
        const triggerName = 'Püremsi Kıvam';
        const triggerInput = modal.locator('#sensoryTriggerInput');
        const triggerAddBtn = modal.locator('#sensoryTriggerAddBtn');

        const initialTriggerCount = parseInt((await modal.locator('#sensoryTriggersCount').innerText()) || '0', 10);
        await triggerInput.fill(triggerName);
        await triggerAddBtn.click();

        const addedTriggerTag = modal.locator('#sensoryTriggersList .dietaryTag', { hasText: triggerName });
        await expect(addedTriggerTag).toBeVisible({ timeout: 5000 });
        const newTriggerCount = parseInt((await modal.locator('#sensoryTriggersCount').innerText()) || '0', 10);
        expect(newTriggerCount).toBe(initialTriggerCount + 1);
    });

    test('7.3 Cross-category status shift: moving food from Avoided to Safe transfers tag without duplicates', async ({ page }) => {
        const modal = page.locator('#settingsModal');
        const transitionFood = 'Omega-3 Balık';

        // 1. Add to Avoided (Kaçınılan) list first
        const unsafeInput = modal.locator('#unsafeFoodInput');
        const unsafeAddBtn = modal.locator('#unsafeFoodAddBtn');
        await unsafeInput.fill(transitionFood);
        await unsafeAddBtn.click();

        const unsafeTag = modal.locator('#unsafeFoodsList .dietaryTag', { hasText: transitionFood });
        await expect(unsafeTag).toBeVisible({ timeout: 5000 });

        const countUnsafeBefore = parseInt((await modal.locator('#unsafeFoodsCount').innerText()) || '0', 10);
        const countSafeBefore = parseInt((await modal.locator('#safeFoodsCount').innerText()) || '0', 10);

        // 2. Now add the SAME food into Safe (Güvenli) list
        const safeInput = modal.locator('#safeFoodInput');
        const safeAddBtn = modal.locator('#safeFoodAddBtn');
        await safeInput.fill(transitionFood);
        await safeAddBtn.click();

        // 3. Verify food is REMOVED from Avoided list
        await expect(modal.locator('#unsafeFoodsList .dietaryTag', { hasText: transitionFood })).toBeHidden();
        const countUnsafeAfter = parseInt((await modal.locator('#unsafeFoodsCount').innerText()) || '0', 10);
        expect(countUnsafeAfter).toBe(countUnsafeBefore - 1);

        // 4. Verify food is ADDED to Safe list
        const safeTag = modal.locator('#safeFoodsList .dietaryTag', { hasText: transitionFood });
        await expect(safeTag).toBeVisible();
        const countSafeAfter = parseInt((await modal.locator('#safeFoodsCount').innerText()) || '0', 10);
        expect(countSafeAfter).toBe(countSafeBefore + 1);

        // 5. Duplicate protection test: adding same food again to safe list
        await safeInput.fill(transitionFood);
        await safeAddBtn.click();
        const notice = modal.locator('#safeFoodNotice');
        await expect(notice).toContainText(/zaten.*mevcut/i);
    });
});
