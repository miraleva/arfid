const { test, expect } = require('@playwright/test');
const path = require('path');

const authFile = path.join(__dirname, '../../playwright/.auth/user.json'); //hazır giriş user

test.describe('03. Settings Modal, Profile, Password Rejection & Danger Zone', () => {
    test.use({ storageState: authFile });

    test.beforeEach(async ({ page }) => {
        await page.goto('/chat'); //chat sayfasına gidiyo
        await expect(page.locator('#openSettingsBtn')).toBeVisible();
        await page.click('#openSettingsBtn');
        await expect(page.locator('#settingsModal')).toBeVisible({ timeout: 5000 }); //settings penceresi açıldı mı kontrol
    });

    test('3.1 Profile Avatar Area shows user email and does NOT contain confusing "Profil Avatarı" label', async ({ page }) => {
        const modal = page.locator('#settingsModal');
        await expect(modal).toBeVisible(); //settings penceresi görünürlüğü 

        // 1. Verify user email is rendered cleanly in avatar sub-label
        const avatarSub = modal.locator('.settingsAvatarSub'); //pp resmi altındaki yazı 
        await expect(avatarSub).toBeVisible();
        await expect(avatarSub).toContainText('a@gmail.com'); //bu yazıyo mu

        // 2. Verify misleading old label "Profil Avatarı" is nowhere in the avatar section
        const avatarRow = modal.locator('.settingsAvatarRow'); //pp resmi satırı
        const textContent = await avatarRow.innerText();
        expect(textContent).not.toContain('Profil Avatarı');
    });

    test('3.2 Password Change rejects same password with error "Yeni şifre mevcut şifrenizle aynı olamaz."', async ({ page }) => {
        const modal = page.locator('#settingsModal');

        // Fill current password
        await modal.locator('#settingsCurrentPassword').fill('123456');

        // Fill the EXACT SAME password into new password fields
        await modal.locator('#settingsNewPassword').fill('123456');
        await modal.locator('#settingsConfirmNewPassword').fill('123456');

        // Click update password button
        await modal.locator('#settingsChangePasswordBtn').click();

        // Verify error feedback appears with the exact message
        const feedback = modal.locator('#settingsPasswordNotice');
        await expect(feedback).toBeVisible({ timeout: 5000 });
        await expect(feedback).toHaveText(/Yeni şifre mevcut şifrenizle aynı olamaz|New password cannot be the same as your current password/i);
    });

    test('3.3 "Tehlikeli Bölge" section header is removed, keeping only prominent red Delete Account button', async ({ page }) => {
        const modal = page.locator('#settingsModal');

        // 1. Verify "Tehlikeli Bölge" title does NOT exist in DOM
        const dangerTitle = modal.locator('.settingsDangerTitle');
        await expect(dangerTitle).toHaveCount(0);

        const modalText = await modal.innerText();
        expect(modalText).not.toContain('Tehlikeli Bölge');

        // 2. Verify the red "Hesabımı Sil" button is present and prominent
        const deleteBtn = modal.locator('#deleteAccountBtn');
        await expect(deleteBtn).toBeVisible();
        await expect(deleteBtn).toHaveText(/Hesabımı Sil|Delete Account/i);
    });

    test('3.4 Settings modal can be closed cleanly', async ({ page }) => {  //çarpı butonu kapama
        const closeBtn = page.locator('#closeSettingsBtn');
        await closeBtn.click();
        await expect(page.locator('#settingsModalOverlay')).not.toHaveClass(/active/);
    });
});
