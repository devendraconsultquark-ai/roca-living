import { test, expect} from "@playwright/test";

test("homepage load", async ({page}) => {
    await page.goto("http://localhost:5173/login")

    await expect(page).toHaveTitle("client");
})