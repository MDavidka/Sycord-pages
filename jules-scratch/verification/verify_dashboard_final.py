from playwright.sync_api import sync_playwright
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    time.sleep(10) # Wait for the server to start
    page.goto("http://localhost:3000/dashboard")
    page.screenshot(path="jules-scratch/verification/dashboard-final.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
