"""Run this to inspect Internshala's current card HTML and find correct selectors."""
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import time

options = webdriver.ChromeOptions()
options.add_argument("--no-sandbox")
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
options.add_experimental_option("excludeSwitches", ["enable-automation"])

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

driver.get("https://internshala.com/jobs/data-engineer-jobs-in-bangalore/")
WebDriverWait(driver, 20).until(
    EC.presence_of_element_located((By.CLASS_NAME, "individual_internship"))
)
time.sleep(3)

cards = driver.find_elements(By.CLASS_NAME, "individual_internship")
print(f"Found {len(cards)} cards total\n")

# Show first 5 non-header cards
shown = 0
for i, card in enumerate(cards):
    html = card.get_attribute("innerHTML")
    if "individual_internship_header" in html:
        print(f"Card {i}: HEADER — skipped")
        continue

    shown += 1
    print(f"\n{'='*60}")
    print(f"Card {i} (non-header #{shown}) — first 2000 chars:")
    print(html[:2000])

    # Also probe common selectors
    print(f"\n--- Selector probe for card {i} ---")
    for sel in [
        ".job-title-href", "a[class*='title']", "h3 a", ".title a",
        "a[class*='job']", ".profile", ".profile-name", ".company-name",
        "a[class*='company']", ".company", ".job_profile", ".profile a",
        "h3", ".heading", "a[href*='/job/']", "a[href*='/jobs/']",
    ]:
        try:
            el = card.find_element(By.CSS_SELECTOR, sel)
            print(f"  {sel:35s} → '{el.text.strip()[:60]}' | href={el.get_attribute('href') or ''}")
        except Exception:
            print(f"  {sel:35s} → (not found)")

    if shown >= 5:
        break

driver.quit()
