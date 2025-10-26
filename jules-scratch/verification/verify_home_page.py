from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:3000/en")
    page.screenshot(path="jules-scratch/verification/verification-en.png")
    page.goto("http://localhost:3000/hu")
    page.screenshot(path="jules-scratch/verification/verification-hu.png")
    page.goto("http://localhost:3000/ro")
    page.screenshot(path="jules-scratch/verification/verification-ro.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
