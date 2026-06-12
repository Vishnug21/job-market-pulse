# Airflow — orchestration layer

Local [Apache Airflow](https://airflow.apache.org/) (LocalExecutor, Dockerized)
that runs the daily `job_market_pipeline` ETL:

```
extract_to_gcs -> transform -> upload_processed -> load_bigquery -> data_quality_check
```

The task graph is identical to a Cloud Composer deployment — only the
connection config differs — so the same DAG would lift-and-shift to GCP.

## What's in here

| File                  | Purpose                                                            |
| --------------------- | ----------------------------------------------------------------- |
| `Dockerfile`          | Airflow base image + Java 17 (PySpark), Google Cloud CLI, py deps |
| `docker-compose.yml`  | Metadata Postgres + init + scheduler + webserver (LocalExecutor)  |
| `dags/`               | The pipeline DAG                                                   |
| `.env.example`        | Template for credentials / connection config                      |

## Prerequisites

- **Docker Desktop running** (the engine, not just the CLI).
- The app's **source Postgres running on the host** with the scraped `jobs`
  table (`jobmarket` DB on `:5432`).
- **gcloud authenticated** on the host (`gcloud auth application-default login`)
  so the mounted credentials can reach GCS + BigQuery.

## Run it

```bash
cd airflow
cp .env.example .env          # then edit GCLOUD_CONFIG_DIR / DATABASE_URL
docker compose build          # first time only — builds the custom image (~few min)
docker compose up -d
```

Open <http://localhost:8080> (default login `admin` / `admin`), unpause
**job_market_pipeline**, and trigger it.

```bash
docker compose logs -f airflow-scheduler   # follow task logs
docker compose down                        # stop (add -v to wipe the metadata DB)
```

## How it connects to the host

- **Source DB:** containers reach the host Postgres via `host.docker.internal`;
  `DATABASE_URL` in `.env` overrides the repo's `.env` `DB_*` vars.
- **GCP auth:** the host gcloud config dir is bind-mounted read-only at
  `/home/airflow/.config/gcloud`, so `gcloud` / `gsutil` / `bq` are authenticated.
- **Code:** the repo root is mounted at `/opt/project`, so edits to the PySpark
  scripts take effect without rebuilding (only dependency changes need a rebuild).
