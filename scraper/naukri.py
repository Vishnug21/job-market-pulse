from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import time
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from db import save_job
from jd_parser import parse_jd


# ── Filter URL param maps ─────────────────────────────────────────────────────

EXPERIENCE_PARAMS = {
    "fresher": "0",
    "0-1":     "0,1",
    "1-3":     "1,2,3",
    "3-5":     "3,4,5",
    "5+":      "5,6,7,8,9,10",
}

SALARY_PARAMS = {          # annual CTC in Lakhs
    "300000":  "3",
    "500000":  "5",
    "800000":  "8",
    "1000000": "10",
    "1500000": "15",
}

POSTED_PARAMS = {          # jobAge = days since posted
    "1":  "1",
    "3":  "3",
    "7":  "7",
    "15": "15",
    "30": "30",
}


def setup_driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-infobars")
    options.add_argument("--start-maximized")
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options,
    )

    # Mask navigator.webdriver so Naukri doesn't detect Selenium
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": """
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        """
    })

    return driver


def search_on_naukri(driver, job_role, location):
    """
    Navigate to Naukri homepage and use the search form directly —
    types the job role and location, then clicks Search.
    Returns the page URL after search completes.
    """
    driver.get("https://www.naukri.com")
    time.sleep(4)

    # Clear and fill keyword field
    keyword_input = None
    try:
        keyword_input = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR,
                "input[placeholder*='skills'], input[placeholder*='Skills'], "
                "input[placeholder*='designation'], #qsb-keyword-sugg, "
                ".nI-gNb-sb__keyword input, input[type='search']"
            ))
        )
        keyword_input.clear()
        keyword_input.send_keys(job_role)
        time.sleep(1)
    except Exception as e:
        print(f"  Keyword input not found: {e}")

    # Clear and fill location field
    try:
        location_input = driver.find_element(By.CSS_SELECTOR,
            "input[placeholder*='location'], input[placeholder*='Location'], "
            "#qsb-location-sugg, .nI-gNb-sb__location input"
        )
        location_input.clear()
        location_input.send_keys(location)
        time.sleep(1)
    except Exception as e:
        print(f"  Location input not found: {e}")

    # Click the Search button
    try:
        search_btn = driver.find_element(By.CSS_SELECTOR,
            "button[type='submit'], .qsbSubmit, [class*='qsb-submit'], "
            "button.nI-gNb-sb__icon, [class*='search-btn']"
        )
        search_btn.click()
    except Exception as e:
        print(f"  Search button not found, pressing Enter: {e}")
        if keyword_input:
            from selenium.webdriver.common.keys import Keys
            keyword_input.send_keys(Keys.RETURN)

    time.sleep(5)
    print(f"  Searching Naukri for: {job_role} in {location}")
    return driver.current_url


def _get_text(card, selectors, default=""):
    for sel in selectors:
        try:
            return card.find_element(By.CSS_SELECTOR, sel).text.strip()
        except Exception:
            pass
    return default


# ── JD extraction ─────────────────────────────────────────────────────────────

NAUKRI_JD_SELECTORS = [
    ".job-desc",
    "[class*='job-desc']",
    "[class*='jobDescBox']",
    "[class*='description']",
    ".jd-container",
    "[class*='jd-']",
    "section.styles_job-desc-container__txpYf",
]


def extract_jd(driver, job_url: str) -> str:
    """
    Open a new tab, grab the JD from the Naukri job detail page, close the tab.
    """
    if not job_url or not job_url.startswith("http"):
        return ""

    try:
        driver.execute_script("window.open('');")
        driver.switch_to.window(driver.window_handles[-1])
        driver.get(job_url)
        time.sleep(3)

        raw = ""
        for sel in NAUKRI_JD_SELECTORS:
            try:
                elem = driver.find_element(By.CSS_SELECTOR, sel)
                raw = elem.text.strip()
                if len(raw) > 100:
                    break
            except Exception:
                pass

        return parse_jd(raw)

    except Exception as e:
        print(f"  JD extraction failed: {e}")
        return ""

    finally:
        driver.close()
        driver.switch_to.window(driver.window_handles[0])


# ── Main scraper ──────────────────────────────────────────────────────────────

def scrape_naukri(job_role="Data Analyst", location="Bangalore", max_jobs=None, filters=None, skip_jd=False):
    """
    Two-pass scraper:
      Pass 1 — collect basic info from Naukri listings page
      Pass 2 — visit each job URL for the full JD description
    Then saves everything to DB.
    """
    if filters is None:
        filters = {}

    driver = setup_driver()
    jobs_scraped = 0

    try:
        if filters:
            active = {k: v for k, v in filters.items() if v not in ("any", False, None, "")}
            if active:
                print(f"\nFilters applied: {active}")

        print(f"\nOpening Naukri and searching for '{job_role}' in '{location}'...")
        search_on_naukri(driver, job_role, location)

        try:
            WebDriverWait(driver, 20).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, ".srp-jobtuple-wrapper, article.jobTuple, [class*='jobTuple']")
                )
            )
        except Exception:
            print("Timed out — no job cards found. Check if the search ran correctly.")
            return 0

        time.sleep(3)

        def get_cards():
            return (
                driver.find_elements(By.CSS_SELECTOR, ".srp-jobtuple-wrapper")
                or driver.find_elements(By.CSS_SELECTOR, "article.jobTuple")
                or driver.find_elements(By.CSS_SELECTOR, "[class*='jobTuple']")
            )

        cards = get_cards()

        # Try page 2 if no cap and more results likely exist
        if max_jobs is None and len(cards) >= 15:
            try:
                next_btn = driver.find_element(By.CSS_SELECTOR,
                    "a[class*='next'], button[class*='next'], [aria-label='Next']"
                )
                next_btn.click()
                time.sleep(4)
                cards += get_cards()
                print(f"  Loaded page 2 — total cards: {len(cards)}")
            except Exception:
                pass

        print(f"Found {len(cards)} listings — collecting basic info...\n")

        # ── Pass 1: basic info ────────────────────────────────────────────────
        jobs_basic = []
        for card in cards:
            if max_jobs is not None and len(jobs_basic) >= max_jobs:
                break
            try:
                title = _get_text(card, ["a.title", "a[class*='title']", ".title"], "N/A")
                if title == "N/A":
                    continue

                company    = _get_text(card, ["a.comp-name", ".comp-name", "a[class*='comp']"], "N/A")
                location_t = _get_text(card, [".locWdth", "span.locWdth", "[class*='location']"], location)
                experience = _get_text(card, [".expwdth", "span.expwdth", "[class*='exp']"], "Not specified")
                salary     = _get_text(card, [".salary", "span.salary", "[class*='salary']"], "Not disclosed")
                skills     = _get_text(card, [".tags-gt", ".skill-tags", "[class*='skill']", "[class*='tag']"], "")

                try:
                    job_url = card.find_element(
                        By.CSS_SELECTOR, "a.title, a[class*='title']"
                    ).get_attribute("href") or ""
                except Exception:
                    job_url = ""

                jobs_basic.append({
                    "title": title, "company": company,
                    "location": location_t, "experience": experience,
                    "salary": salary, "skills": skills,
                    "job_url": job_url, "source": "Naukri",
                })

            except Exception as e:
                print(f"Error on card: {e}")
                continue

        print(f"Collected {len(jobs_basic)} jobs. Fetching job descriptions...\n")

        # ── Pass 2: JD extraction (skipped in bulk mode) ─────────────────────
        for i, job in enumerate(jobs_basic, 1):
            if skip_jd:
                job["description"] = ""
            else:
                print(f"  [{i}/{len(jobs_basic)}] JD → {job['title']} at {job['company']}")
                job["description"] = extract_jd(driver, job["job_url"])
            saved = save_job(job)
            if saved:
                jobs_scraped += 1
                if not skip_jd:
                    print(f"  ✓ Saved")
            time.sleep(0.5 if skip_jd else 1)

    except KeyboardInterrupt:
        print(f"\nStopped by user. Scraped {jobs_scraped} jobs.")

    finally:
        driver.quit()
        print(f"\nDone! Total Naukri jobs scraped: {jobs_scraped}")

    return jobs_scraped


if __name__ == "__main__":
    role     = input("Enter job role (default: Data Analyst): ").strip() or "Data Analyst"
    location = input("Enter location (default: Bangalore): ").strip() or "Bangalore"
    scrape_naukri(role, location, max_jobs=10)
