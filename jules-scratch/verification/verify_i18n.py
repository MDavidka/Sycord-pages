
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()

    # English
    page.goto("http://localhost:3000/en")
    page.screenshot(path="jules-scratch/verification/screenshot-en.png")

    # Hungarian
    page.goto("http://localhost:3000/hu")
    page.screenshot(path="jules-scratch/verification/screenshot-hu.png")

    # Romanian
    page.goto("http://localhost:3000/ro")
    page.screenshot(path="jules-scratch/verification/screenshot-ro.png")

    # Login
    page.goto("http://localhost:3000/en/login")
    page.screenshot(path="jules-scratch/verification/screenshot-login.png")

    # Dashboard
    page.goto("http://localhost:3000/en/dashboard")
    page.screenshot(path="jules-scratch/verification/screenshot-dashboard.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
