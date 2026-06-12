"""
Job Market Pulse — daily batch ETL pipeline.

Orchestrates the data flow:

    extract_to_gcs  ->  transform  ->  upload_processed  ->  load_bigquery  ->  data_quality_check

  1. extract_to_gcs     Pull jobs from PostgreSQL, write raw parquet, land in GCS raw bucket.
  2. transform          PySpark: dedupe, enrich, data-quality gate -> processed parquet.
  3. upload_processed   Push processed parquet to the GCS processed bucket (data lake).
  4. load_bigquery      Free batch load (hive-partitioned) into the BigQuery warehouse.
  5. data_quality_check Assert the warehouse table is non-empty after load.

Runs locally in free-tier Airflow (Docker / WSL), but the task graph is
identical to a Cloud Composer deployment — only connection config differs.

Schedule: daily at 06:00. catchup disabled (we only care about the latest snapshot).
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator

# Project root inside the Airflow worker. Override with an Airflow Variable / env
# var when the repo lives somewhere other than /opt/project (e.g. a bind mount).
PROJECT_DIR = os.environ.get("JOB_MARKET_PROJECT_DIR", "/opt/project")
PYTHON = os.environ.get("JOB_MARKET_PYTHON", "python")

RAW_BUCKET       = "job-market-pulse-raw"
PROCESSED_BUCKET = "job-market-pulse-processed"
BQ_DATASET       = "job_market_warehouse"
BQ_TABLE         = "jobs"

default_args = {
    "owner": "vishnu",
    "retries": 1,
    "retry_delay": timedelta(minutes=2),
    "depends_on_past": False,
}

with DAG(
    dag_id="job_market_pipeline",
    description="Daily ETL: PostgreSQL -> GCS -> PySpark -> BigQuery",
    default_args=default_args,
    start_date=datetime(2026, 6, 1),
    schedule="0 6 * * *",          # every day at 06:00
    catchup=False,
    max_active_runs=1,
    tags=["data-engineering", "gcp", "spark", "bigquery"],
) as dag:

    # 1. Extract from PostgreSQL -> raw parquet -> GCS raw bucket
    extract_to_gcs = BashOperator(
        task_id="extract_to_gcs",
        bash_command=f"cd {PROJECT_DIR} && {PYTHON} pyspark/extract_to_gcs.py",
    )

    # 2. PySpark transform -> processed parquet (partitioned by source)
    transform = BashOperator(
        task_id="transform",
        bash_command=f"cd {PROJECT_DIR} && {PYTHON} pyspark/transform_local.py",
    )

    # 3. Upload processed layer to GCS, stripping Spark sidecar files (_SUCCESS, *.crc)
    upload_processed = BashOperator(
        task_id="upload_processed",
        bash_command=(
            f"cd {PROJECT_DIR}/pyspark/out && "
            f"gcloud storage cp --recursive processed/* gs://{PROCESSED_BUCKET}/jobs/ && "
            f"gcloud storage rm gs://{PROCESSED_BUCKET}/jobs/_SUCCESS "
            f"gs://{PROCESSED_BUCKET}/jobs/**/*.crc || true"
        ),
    )

    # 4. Free batch load into BigQuery; hive partitioning recovers the `source` column
    load_bigquery = BashOperator(
        task_id="load_bigquery",
        bash_command=(
            "bq load --source_format=PARQUET "
            "--hive_partitioning_mode=AUTO "
            f"--hive_partitioning_source_uri_prefix=gs://{PROCESSED_BUCKET}/jobs "
            "--replace "
            f"{BQ_DATASET}.{BQ_TABLE} "
            f"'gs://{PROCESSED_BUCKET}/jobs/*'"
        ),
    )

    # 5. Data-quality gate: fail the run if the table came back empty
    data_quality_check = BashOperator(
        task_id="data_quality_check",
        bash_command=(
            "ROWS=$(bq query --use_legacy_sql=false --format=csv --quiet "
            f"'SELECT COUNT(*) FROM {BQ_DATASET}.{BQ_TABLE}' | tail -n1); "
            'echo "row count = $ROWS"; '
            'if [ "$ROWS" -gt 0 ]; then echo "DQ PASS"; else echo "DQ FAIL: empty table"; exit 1; fi'
        ),
    )

    extract_to_gcs >> transform >> upload_processed >> load_bigquery >> data_quality_check
