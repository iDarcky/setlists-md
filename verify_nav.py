import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Verify Mobile Layout with Smart FAB
        context_mobile = await browser.new_context(viewport={'width': 375, 'height': 667})
        page_mobile = await context_mobile.new_page()

        await page_mobile.goto("http://localhost:5175")
        await page_mobile.evaluate('localStorage.setItem("chordvault:settings", JSON.stringify({hasCompletedOnboarding: true, hasDismissedIntro: true}))')
        await page_mobile.goto("http://localhost:5175")
        await page_mobile.wait_for_selector('.sm\\:hidden')
        await page_mobile.screenshot(path="mobile_nav_smart_fab_fixed.png")
        print("Mobile screenshot taken.")
        await context_mobile.close()

        # Verify Desktop Navigation Component
        context_desktop = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page_desktop = await context_desktop.new_page()

        await page_desktop.goto("http://localhost:5175")
        await page_desktop.evaluate('localStorage.setItem("chordvault:settings", JSON.stringify({hasCompletedOnboarding: true, hasDismissedIntro: true}))')
        await page_desktop.goto("http://localhost:5175")
        await page_desktop.wait_for_selector('text="Dashboard"')
        await page_desktop.screenshot(path="desktop_nav.png")
        print("Desktop screenshot taken.")
        await context_desktop.close()

        await browser.close()

asyncio.run(main())
