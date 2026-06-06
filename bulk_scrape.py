"""
Bulk scraper — seeds the database with a broad CS/IT dataset for Power BI analysis.

Covers 14 roles across all major CS/IT domains × 4 cities × 2 sources.
max_jobs=None → grabs every card on the listings page per combo (fast since skip_jd=True).
Deduplication in db.py handles overlapping results between roles/locations.

Run with: python bulk_scrape.py
"""

import sys
import os
import time

sys.path.append(os.path.join(os.path.dirname(__file__), 'scraper'))
from scraper.naukri import scrape_naukri

# ── Roles — broad CS/IT coverage ───────────────────────────────────────────────
# Keep terms generic enough that each returns 20-40 results per city.
# More specific sub-roles are naturally captured within these broader searches.

ROLES = [
    # ── Software Development ────────────────────────────────
    "Software Engineer",          # SDE I/II, general software roles
    "Full Stack Developer",       # web fullstack
    "Frontend Developer",         # React, Angular, Vue
    "Backend Developer",          # Node, Java, Python, Go APIs
    "Android Developer",          # mobile — Android specific
    # ── Data & Analytics ────────────────────────────────────
    "Data Analyst",               # BI, reporting, dashboards
    "Data Scientist",             # ML modeling, stats
    "Data Engineer",              # pipelines, ETL, warehousing
    # ── AI / ML ─────────────────────────────────────────────
    "Machine Learning Engineer",  # MLOps, model deployment
    # ── Infrastructure & Cloud ──────────────────────────────
    "DevOps Engineer",            # CI/CD, Kubernetes, infra
    "Cloud Engineer",             # AWS, Azure, GCP
    # ── Quality & Security ──────────────────────────────────
    "QA Engineer",                # test automation, SDET
    "Cybersecurity Analyst",      # infosec, SOC, pen testing
    # ── Business & Product ──────────────────────────────────
    "Business Analyst",           # tech-facing BA, requirements
]

LOCATIONS = [
    "Bangalore",
    "Hyderabad",
    "Mumbai",
    "Delhi",                      # covers Delhi-NCR, Gurgaon, Noida results
]

SOURCES = [
    ("Naukri", scrape_naukri),
]

TOTAL_LIMIT        = 500
COOLDOWN_SECONDS   = 8

# ── Runner ─────────────────────────────────────────────────────────────────────

def run_bulk():
    total_combos  = len(ROLES) * len(LOCATIONS) * len(SOURCES)
    total_scraped = 0
    failed        = []
    combo_num     = 0

    print("=" * 65)
    print("  Job Market Pulse — Bulk Scraper")
    print(f"  {len(ROLES)} roles  ×  {len(LOCATIONS)} locations  ×  {len(SOURCES)} sources")
    print(f"  {total_combos} combinations  |  no per-combo cap  |  skip_jd=True")
    print("=" * 65)

    for source_name, scrape_fn in SOURCES:
        for role in ROLES:
            for location in LOCATIONS:
                combo_num += 1
                print(f"\n[{combo_num}/{total_combos}] {source_name} → {role} in {location}")
                print("-" * 55)

                try:
                    scraped = scrape_fn(
                        job_role=role,
                        location=location,
                        max_jobs=None,
                        skip_jd=True,
                    )
                    total_scraped += scraped
                    print(f"  Saved: {scraped}  |  Running total: {total_scraped}")

                except Exception as e:
                    print(f"  FAILED: {e}")
                    failed.append(f"{source_name} | {role} | {location}: {e}")

                if combo_num < total_combos:
                    print(f"  Cooling down {COOLDOWN_SECONDS}s...")
                    time.sleep(COOLDOWN_SECONDS)

    print("\n" + "=" * 65)
    print("  BULK SCRAPE COMPLETE")
    print(f"  Total jobs saved to DB : {total_scraped}")
    print(f"  Combinations run       : {combo_num}/{total_combos}")
    print(f"  Failed combinations    : {len(failed)}")
    if failed:
        print("\n  Failures:")
        for f in failed:
            print(f"    • {f}")
    print("=" * 65)


if __name__ == "__main__":
    run_bulk()
