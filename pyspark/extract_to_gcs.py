"""
Extraction (local) — Stage 1 of the pipeline.

Pulls all jobs from the local PostgreSQL, writes a snapshot parquet file,
and uploads it to the GCS raw bucket (data lake landing zone).

Pure pandas + pyarrow: no local Spark needed (avoids Windows winutils issues).
Heavy transformation happens in the cloud on Dataproc (transform_jobs.py).

Run with: python pyspark/extract_to_gcs.py
"""

import os
import sys
import subprocess
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from scraper.db import get_connection

RAW_BUCKET = "gs://job-market-pulse-raw"
LOCAL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")


def extract():
    conn = get_connection()
    df = pd.read_sql("SELECT * FROM jobs", conn)
    conn.close()
    print(f"[OK] Extracted {len(df)} jobs from PostgreSQL")
    return df


def write_parquet(df: pd.DataFrame) -> str:
    os.makedirs(LOCAL_DIR, exist_ok=True)
    snapshot_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    local_path = os.path.join(LOCAL_DIR, f"jobs_{snapshot_date}.parquet")
    df.to_parquet(local_path, index=False)
    size_mb = os.path.getsize(local_path) / 1024 / 1024
    print(f"[OK] Wrote {local_path} ({size_mb:.2f} MB)")
    return local_path, snapshot_date


def upload(local_path: str, snapshot_date: str):
    # Partition raw zone by ingestion date: raw/jobs/ingest_date=YYYY-MM-DD/
    dest = f"{RAW_BUCKET}/jobs/ingest_date={snapshot_date}/jobs.parquet"
    # shell=True is required on Windows to resolve gsutil.cmd; on POSIX it must be
    # False, otherwise only the first list element ("gsutil") is executed.
    subprocess.run(["gsutil", "cp", local_path, dest], check=True, shell=(os.name == "nt"))
    print(f"[OK] Uploaded to {dest}")


if __name__ == "__main__":
    df = extract()
    local_path, snapshot_date = write_parquet(df)
    upload(local_path, snapshot_date)
    print("[DONE] Raw layer updated in GCS")
