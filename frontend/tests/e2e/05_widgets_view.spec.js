const { test, expect } = require('@playwright/test');
const path = require('path');

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

test.describe('05. Widget Presentation & Open Food Facts Image Rendering (Mocked)', () => {
    test.use({ storageState: authFile });

    test('5.1 Recipe widget renders in DOM with real image and Open Food Facts attribution badge', async ({ page }) => {
        // Intercept POST /chat requests and return a mock recipe widget with Open Food Facts image
        await page.route('**/chat', async (route) => {
            if (route.request().method() === 'POST') {
                const mockResponse = {
                    response: "Harika ve çıtır bir patates tarifi hazırladım!",
                    conversation_id: 9999,
                    widget: {
                        type: "recipe",
                        title: "Fırında Çıtır Patates Dilimleri",
                        data: {
                            display_mode: "single",
                            prep_time_min: 10,
                            cook_time_min: 25,
                            servings: "2 Kişilik",
                            calories_approx: 220,
                            confidence_label: "Tahmini Değer (~)",
                            sensory_tags: ["Çıtır", "Kuru Doku"],
                            image_url: "https://images.openfoodfacts.org/images/products/868/090/front_tr.jpg",
                            image_placeholder: {
                                slot_key: "recipe_default",
                                alt_text: "Fırında Çıtır Patates Dilimleri",
                                image_url: "https://images.openfoodfacts.org/images/products/868/090/front_tr.jpg",
                                source_url: "https://world.openfoodfacts.org/product/868090",
                                source_name: "Open Food Facts"
                            },
                            ingredients: [
                                { name: "Patates", amount: 2, unit: "adet" },
                                { name: "Zeytinyağı", amount: 1, unit: "yemek kaşığı" }
                            ],
                            instructions: [
                                "Patatesleri yıkayıp elma dilimi şeklinde doğrayın.",
                                "Baharatlayıp fırında 200 derecede çıtırlaşana kadar pişirin."
                            ],
                            dietitian_note: "Dokusunun çıtır olması ARFID hassasiyetini hafifletir."
                        }
                    }
                };

                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(mockResponse)
                });
            } else {
                await route.continue();
            }
        });

        await page.goto('/chat');
        await expect(page.locator('#messageInput')).toBeVisible();

        // Send a trigger message
        await page.locator('#messageInput').fill('çıtır patates tarifi ver');
        await page.locator('#sendButton').click();

        // 1. Verify widget card is rendered in the chat area
        const widgetCard = page.locator('.widgetCard');
        await expect(widgetCard).toBeVisible({ timeout: 10000 });

        // 2. Verify widget title
        const widgetTitle = widgetCard.locator('.widgetTitle');
        await expect(widgetTitle).toContainText('Fırında Çıtır Patates Dilimleri');

        // 3. Verify widget image container has loaded status
        const imgContainer = widgetCard.locator('.widgetImageContainer');
        await expect(imgContainer).toBeVisible();
        await expect(imgContainer).toHaveAttribute('data-image-status', 'loaded');

        // 4. Verify real image element is populated with the Open Food Facts image URL
        const realImg = imgContainer.locator('img.widgetRealImage');
        await expect(realImg).toHaveAttribute('src', 'https://images.openfoodfacts.org/images/products/868/090/front_tr.jpg');

        // 5. Verify Open Food Facts attribution badge is present and contains link
        const attribution = imgContainer.locator('.widgetImageAttribution');
        await expect(attribution).toBeVisible();
        await expect(attribution).toContainText('Open Food Facts');
        await expect(attribution).toHaveAttribute('href', 'https://world.openfoodfacts.org/product/868090');
    });

    test('5.2 Sidebar "Tariflerim" tab can be activated', async ({ page }) => {
        await page.goto('/chat');
        const tabRecipesBtn = page.locator('#tabRecipesBtn');
        await expect(tabRecipesBtn).toBeVisible();

        await tabRecipesBtn.click();
        await expect(tabRecipesBtn).toHaveClass(/active/);

        // Switch back to chats tab
        const tabChatsBtn = page.locator('#tabChatsBtn');
        await tabChatsBtn.click();
        await expect(tabChatsBtn).toHaveClass(/active/);
    });
});
