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


# ── Filter maps ───────────────────────────────────────────────────────────────

EXPERIENCE_LABELS = {
    "fresher": "Fresher",
    "0-1":     "0-1 years",
    "1-3":     "1-3 years",
    "3-5":     "3-5 years",
    "5+":      "5+ years",
}
SALARY_LABELS = {
    "200000":  "₹2,00,000",
    "300000":  "₹3,00,000",
    "500000":  "₹5,00,000",
    "800000":  "₹8,00,000",
    "1200000": "₹12,00,000",
}
POSTED_LABELS = {
    "1":  "Last 1 day",
    "3":  "Last 3 days",
    "7":  "Last 7 days",
    "30": "Last 30 days",
}
SORT_LABELS = {
    "recent":    "Most recent",
    "relevance": "Relevance",
}


def setup_driver():
    options = webdriver.ChromeOptions()
    # options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options,
    )
    return driver


def build_url(job_role, location, filters):
    role_slug = job_role.lower().replace(" ", "-")
    if filters.get("work_from_home"):
        return f"https://internshala.com/jobs/work-from-home-{role_slug}-jobs/"
    loc_slug = location.lower().replace(" ", "-")
    return f"https://internshala.com/jobs/{role_slug}-jobs-in-{loc_slug}/"


def _click_filter_label(driver, text_options):
    for text in text_options:
        # Try exact match first, then contains match
        xpaths = [
            f"//*[self::label or self::span or self::li or self::div or self::a]"
            f"[normalize-space(.)='{text}']",
            f"//*[self::label or self::span or self::li or self::div or self::a]"
            f"[contains(normalize-space(.), '{text}')]",
        ]
        for xpath in xpaths:
            try:
                el = driver.find_element(By.XPATH, xpath)
                driver.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
                time.sleep(0.5)
                driver.execute_script("arguments[0].click();", el)
                time.sleep(1.5)
                print(f"  Applied filter: {text}")
                return True
            except Exception:
                pass
    print(f"  Filter not found: {text_options}")
    return False


def apply_filters_on_page(driver, filters):
    time.sleep(2)
    exp = filters.get("experience", "any")
    if exp != "any" and exp in EXPERIENCE_LABELS:
        _click_filter_label(driver, [EXPERIENCE_LABELS[exp]])

    sal = filters.get("salary_min", "any")
    if sal != "any" and sal in SALARY_LABELS:
        label = SALARY_LABELS[sal]
        _click_filter_label(driver, [label, label + "+", f"Above {label}"])

    posted = filters.get("posted_within", "any")
    if posted != "any" and posted in POSTED_LABELS:
        _click_filter_label(driver, [POSTED_LABELS[posted]])

    sort = filters.get("sort_by", "any")
    if sort != "any" and sort in SORT_LABELS:
        _click_filter_label(driver, [SORT_LABELS[sort]])

    time.sleep(3)


# ── JD extraction ─────────────────────────────────────────────────────────────

JD_SELECTORS = [
    ".detail-container",
    ".about-job",
    "#about-job",
    ".job-description",
    "[class*='description']",
    ".internship-heading ~ div",
    ".section-heading ~ div",
]


def extract_jd(driver, job_url: str) -> str:
    """
    Open a new tab, grab the JD from the job detail page, close the tab.
    The listings page stays intact in the background tab.
    """
    if not job_url or not job_url.startswith("http"):
        return ""

    try:
        driver.execute_script("window.open('');")
        driver.switch_to.window(driver.window_handles[-1])
        driver.get(job_url)
        time.sleep(3)

        raw = ""
        for sel in JD_SELECTORS:
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

def scrape_internshala(job_role, location="Bangalore", max_jobs=None, filters=None, skip_jd=False):
    """
    Two-pass scraper:
      Pass 1 — collect basic info from the listings page
      Pass 2 — visit each job URL for the JD description
    Then saves everything to DB.
    """
    if filters is None:
        filters = {}

    driver = setup_driver()
    jobs_scraped = 0

    try:
        url = build_url(job_role, location, filters)
        print(f"\nSearching: {url}")
        if filters:
            active = {k: v for k, v in filters.items() if v not in ("any", False, None, "")}
            if active:
                print(f"Filters: {active}")
        print()

        driver.get(url)
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.CLASS_NAME, "individual_internship"))
        )
        time.sleep(4)

        # Apply sidebar filters if needed
        non_url = {k: v for k, v in filters.items()
                   if k != "work_from_home" and v not in (None, False, "any", "")}
        if non_url:
            print("Applying sidebar filters...")
            apply_filters_on_page(driver, filters)
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.CLASS_NAME, "individual_internship"))
            )
            time.sleep(2)

        cards = driver.find_elements(By.CLASS_NAME, "individual_internship")
        print(f"Found {len(cards)} listings — collecting basic info...\n")

        # ── Pass 1: basic info ────────────────────────────────────────────────
        jobs_basic = []
        for card in cards:
            if max_jobs is not None and len(jobs_basic) >= max_jobs:
                break
            if "individual_internship_header" in card.get_attribute("innerHTML"):
                continue
            try:
                def get(selectors, attr=None):
                    if isinstance(selectors, str):
                        selectors = [selectors]
                    for sel in selectors:
                        try:
                            el = card.find_element(By.CSS_SELECTOR, sel)
                            if attr:
                                val = el.get_attribute(attr) or ""
                            else:
                                # .text requires viewport visibility; textContent always works
                                val = el.get_attribute("textContent") or el.text or ""
                            val = val.strip()
                            if val:
                                return val
                        except Exception:
                            pass
                    return ""

                title = get([
                    ".job-title-href",
                    "a[class*='title']",
                    "h3 a", ".title a",
                    "a[class*='job']",
                ]) or "N/A"

                company = get([
                    ".company-name",
                    "a[class*='company']",
                    "[class*='company-name']",
                ]) or "N/A"

                location_text = get([
                    ".locations",
                    "[class*='location']",
                    ".location",
                ]) or location

                job_url = get([
                    ".job-title-href",
                    "a[class*='title']",
                    "h3 a",
                ], attr="href")

                def txt(el):
                    return (el.get_attribute("textContent") or el.text or "").strip()

                try:
                    exp_el     = card.find_element(By.CSS_SELECTOR, ".row-1-item .ic-16-briefcase")
                    experience = txt(exp_el.find_element(By.XPATH, "following-sibling::span"))
                except Exception:
                    experience = "Not specified"

                try:
                    sal_el = card.find_element(By.CSS_SELECTOR, ".row-1-item .ic-16-money")
                    salary = txt(sal_el.find_element(By.XPATH, "following-sibling::*"))
                except Exception:
                    try:
                        salary = txt(card.find_element(By.CSS_SELECTOR, "[class*='salary']"))
                    except Exception:
                        salary = "Not disclosed"

                try:
                    skills = txt(card.find_element(By.CLASS_NAME, "job_skills"))
                except Exception:
                    skills = ""

                if title == "N/A":
                    continue

                jobs_basic.append({
                    "title": title, "company": company,
                    "location": location_text, "experience": experience,
                    "salary": salary, "skills": skills,
                    "job_url": job_url, "source": "Internshala",
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
        print(f"\nDone! Total Internshala jobs scraped: {jobs_scraped}")

    return jobs_scraped


if __name__ == "__main__":
    role = input("Enter job role (default: Data Analyst): ").strip() or "Data Analyst"
    scrape_internshala(role, max_jobs=5)
