import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()


def get_connection():
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return psycopg2.connect(database_url)
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        port=os.getenv("DB_PORT"),
    )


def run_migrations():
    """Add any missing columns to the jobs table."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        ALTER TABLE jobs
        ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''
    """)
    conn.commit()
    cursor.close()
    conn.close()


def save_job(job: dict) -> bool:
    """
    Validate then save a job. Returns True if inserted, False if skipped/invalid.
    Deduplication: URL first (strongest), then title+company+source.
    """
    from validator import validate

    is_valid, issues = validate(job)
    if not is_valid:
        print(f"Invalid record skipped [{', '.join(issues)}]: {job.get('title')} at {job.get('company')}")
        return False

    if issues:
        print(f"Quality warnings [{', '.join(issues)}]: {job.get('title')}")

    conn = get_connection()
    cursor = conn.cursor()

    # URL-based dedup
    if job.get("job_url"):
        cursor.execute("SELECT id FROM jobs WHERE job_url = %s", (job["job_url"],))
        if cursor.fetchone():
            print(f"Skipping URL duplicate: {job['title']} at {job['company']}")
            cursor.close()
            conn.close()
            return False

    # Title+company+source dedup
    cursor.execute(
        "SELECT id FROM jobs WHERE title = %s AND company = %s AND source = %s",
        (job["title"], job["company"], job["source"]),
    )
    if cursor.fetchone():
        print(f"Skipping duplicate: {job['title']} at {job['company']}")
        cursor.close()
        conn.close()
        return False

    cursor.execute(
        """
        INSERT INTO jobs
            (title, company, location, experience, salary, skills, job_url, source, description)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            job["title"],
            job["company"],
            job.get("location", "Not specified"),
            job.get("experience", "Not specified"),
            job.get("salary", "Not disclosed"),
            job.get("skills", ""),
            job.get("job_url", ""),
            job["source"],
            job.get("description", ""),
        ),
    )
    conn.commit()
    cursor.close()
    conn.close()
    return True
