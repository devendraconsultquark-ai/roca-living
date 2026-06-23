import { test, expect} from "@playwright/test";

test("homepage load", async ({page}) => {
    await page.goto("http://localhost:5173/roca-living-2/client/login")

    await expect(page).toHaveTitle("client");
})