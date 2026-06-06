"""
Data quality and validation layer for job records before DB insertion.
Called by save_job() in db.py to enforce schema integrity.
"""
import re


REQUIRED_FIELDS = ["title", "company", "source"]

SALARY_PATTERNS = [
    # "₹4 LPA", "4-6 LPA", "4,00,000"
    re.compile(r"(\d[\d,\.]*)\s*[-–to]*\s*(\d[\d,\.]*)\s*(LPA|lpa|L|lakh)", re.IGNORECASE),
    re.compile(r"₹\s*(\d[\d,\.]+)"),
    re.compile(r"(\d[\d,\.]+)\s*per\s*(month|annum|year)", re.IGNORECASE),
]


def validate(job: dict) -> tuple[bool, list[str]]:
    """
    Validate a job dict. Returns (is_valid, list_of_issues).
    A job with issues is still saved but issues are logged.
    Only returns is_valid=False for records that must be discarded.
    """
    issues = []

    # --- Required fields ---
    for field in REQUIRED_FIELDS:
        if not job.get(field) or str(job[field]).strip() in ("", "N/A", "None"):
            issues.append(f"missing_required:{field}")

    # Discard if required fields are absent
    if any("missing_required" in i for i in issues):
        return False, issues

    # --- Title quality ---
    title = job.get("title", "")
    if len(title) < 3:
        issues.append("title_too_short")
    if re.search(r"[<>{}]", title):
        issues.append("title_contains_html")

    # --- URL quality ---
    url = job.get("job_url", "")
    if not url or not url.startswith("http"):
        issues.append("invalid_url")
        job["job_url"] = ""

    # --- Salary normalization ---
    salary_raw = job.get("salary", "")
    job["salary"] = normalize_salary(salary_raw)

    # --- Location normalization ---
    loc = job.get("location", "")
    job["location"] = normalize_location(loc)

    # --- Skills cleanup ---
    skills = job.get("skills", "")
    job["skills"] = skills.strip() if skills else ""

    return True, issues


def normalize_salary(raw: str) -> str:
    if not raw or raw.strip() in ("", "N/A", "Not disclosed", "Not Disclosed"):
        return "Not disclosed"
    raw = raw.strip()
    # Already clean-looking
    if any(p.search(raw) for p in SALARY_PATTERNS):
        return raw
    # Remove stray HTML/special chars
    cleaned = re.sub(r"<[^>]+>", "", raw).strip()
    return cleaned if cleaned else "Not disclosed"


def normalize_location(raw: str) -> str:
    if not raw or raw.strip() in ("", "N/A"):
        return "Not specified"
    raw = raw.strip()
    # Collapse multiple spaces/newlines into single space
    return re.sub(r"\s+", " ", raw)


def run_quality_report(conn) -> dict:
    """
    Run data quality checks against the existing jobs table.
    Returns a summary dict suitable for logging or the /api/analytics endpoint.
    """
    cursor = conn.cursor()
    report = {}

    cursor.execute("SELECT COUNT(*) FROM jobs")
    report["total"] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM jobs WHERE title IS NULL OR title = '' OR title = 'N/A'")
    report["missing_title"] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM jobs WHERE company IS NULL OR company = '' OR company = 'N/A'")
    report["missing_company"] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM jobs WHERE salary = 'Not disclosed' OR salary IS NULL")
    report["no_salary"] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM jobs WHERE job_url IS NULL OR job_url = ''")
    report["no_url"] = cursor.fetchone()[0]

    # URL-based duplicates (same URL from different sources counts as one listing)
    cursor.execute("""
        SELECT COUNT(*) FROM (
            SELECT job_url
            FROM jobs
            WHERE job_url IS NOT NULL AND job_url != ''
            GROUP BY job_url
            HAVING COUNT(*) > 1
        ) dupes
    """)
    report["url_duplicates"] = cursor.fetchone()[0]

    # Title+company duplicates across sources
    cursor.execute("""
        SELECT COUNT(*) FROM (
            SELECT title, company
            FROM jobs
            GROUP BY title, company
            HAVING COUNT(*) > 1
        ) dupes
    """)
    report["cross_source_duplicates"] = cursor.fetchone()[0]

    cursor.execute("""
        SELECT source, COUNT(*) FROM jobs GROUP BY source ORDER BY COUNT(*) DESC
    """)
    report["by_source"] = {row[0]: row[1] for row in cursor.fetchall()}

    cursor.close()
    return report


def deduplicate_by_url(conn) -> int:
    """
    Remove duplicate rows that share the same job_url, keeping the earliest insert.
    Returns number of rows deleted.
    """
    cursor = conn.cursor()
    cursor.execute("""
        DELETE FROM jobs
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (PARTITION BY job_url ORDER BY scraped_at ASC) AS rn
                FROM jobs
                WHERE job_url IS NOT NULL AND job_url != ''
            ) ranked
            WHERE rn > 1
        )
    """)
    deleted = cursor.rowcount
    conn.commit()
    cursor.close()
    return deleted
