"""
Transformation (Dataproc) — Stage 2 of the pipeline.

Reads raw job snapshots from the GCS data lake, applies cleaning and
enrichment transformations, writes the processed layer back to GCS,
and loads the final table into BigQuery.

Transformations:
  - Deduplicate on job_url (fallback: title+company+source)
  - skills:        newline-separated string  -> trimmed array<string>
  - experience:    free text                 -> exp_min/exp_max years + bucket
  - salary:        free text                 -> salary_disclosed flag + LPA range
  - location:      "Hybrid - Noida" etc.     -> cleaned city + remote/hybrid flag
  - Adds processed_at audit column
  - Row-level data quality checks (null/blank title or company are rejected
    and counted, not silently dropped)

Submit with:
  gcloud dataproc jobs submit pyspark pyspark/transform_jobs.py \
    --cluster=job-market-cluster --region=asia-south1 \
    --jars=gs://spark-lib/bigquery/spark-bigquery-with-dependencies_2.12-0.36.1.jar
"""

from pyspark.sql import SparkSession, functions as F
from pyspark.sql.window import Window

RAW_PATH       = "gs://job-market-pulse-raw/jobs/*/jobs.parquet"
PROCESSED_PATH = "gs://job-market-pulse-processed/jobs"
STAGING_BUCKET = "job-market-pulse-staging"
BQ_TABLE       = "job-market-pulse.job_market_warehouse.jobs"

spark = SparkSession.builder.appName("JobMarketETL-Transform").getOrCreate()

# ── Extract ────────────────────────────────────────────────────────────────
raw = spark.read.parquet(RAW_PATH)
raw_count = raw.count()
print(f"[INFO] Raw records read: {raw_count}")

# ── Data quality gate ──────────────────────────────────────────────────────
# Reject rows missing the minimum viable fields; count them for the report.
valid = raw.filter(
    F.col("title").isNotNull() & (F.trim("title") != "") &
    F.col("company").isNotNull() & (F.trim("company") != "")
)
rejected_count = raw_count - valid.count()
print(f"[DQ] Rejected rows (blank title/company): {rejected_count}")

# ── Deduplicate ────────────────────────────────────────────────────────────
# Latest scrape wins. URL is the strongest key; fall back to title+company+source.
dedupe_key = F.coalesce(F.col("job_url"), F.concat_ws("|", "title", "company", "source"))
w = Window.partitionBy(dedupe_key).orderBy(F.col("scraped_at").desc())
deduped = (valid
    .withColumn("_rn", F.row_number().over(w))
    .filter(F.col("_rn") == 1)
    .drop("_rn"))
print(f"[DQ] Duplicates removed: {valid.count() - deduped.count()}")

# ── Transform ──────────────────────────────────────────────────────────────
# skills: newline-separated -> array<string>, empty -> []
skills_arr = F.when(
    F.col("skills").isNotNull() & (F.trim("skills") != ""),
    F.expr("filter(transform(split(skills, '\\n'), x -> trim(x)), x -> x != '')")
).otherwise(F.array().cast("array<string>"))

# experience: pull the first one/two numbers out of the text
exp_min = F.regexp_extract(F.col("experience"), r"(\d+)", 1).cast("int")
exp_max = F.regexp_extract(F.col("experience"), r"\d+\s*[-to]+\s*(\d+)", 1).cast("int")
is_fresher = F.lower(F.coalesce("experience", F.lit(""))).rlike("fresher|no experience")

exp_bucket = (
    F.when(is_fresher | (F.coalesce(exp_min, F.lit(99)) == 0), "Fresher")
     .when(exp_min.between(1, 2), "1-2 yr")
     .when(exp_min.between(3, 5), "3-5 yr")
     .when(exp_min >= 6, "6+ yr")
     .otherwise("Unspecified")
)

# salary: disclosed flag + numeric LPA range where the text contains it
sal_lower = F.lower(F.coalesce("salary", F.lit("")))
salary_disclosed = ~sal_lower.rlike("not disclosed|competitive|unpaid|^$")
sal_min = F.regexp_extract(sal_lower, r"(\d+(?:\.\d+)?)\s*(?:-|to)?", 1).cast("double")
sal_max = F.regexp_extract(sal_lower, r"(?:-|to)\s*(\d+(?:\.\d+)?)", 1).cast("double")

# location: flags + cleaned city
loc = F.coalesce("location", F.lit(""))
is_remote = F.lower(loc).rlike("remote|work from home")
is_hybrid = F.lower(loc).rlike("hybrid")
city = F.initcap(F.trim(F.regexp_replace(loc, r"(?i)hybrid\s*-\s*|remote\s*-?\s*|work from home", "")))

transformed = (deduped
    .withColumn("skills",           skills_arr)
    .withColumn("exp_min_years",    exp_min)
    .withColumn("exp_max_years",    F.coalesce(exp_max, exp_min))
    .withColumn("exp_bucket",       exp_bucket)
    .withColumn("salary_disclosed", salary_disclosed)
    .withColumn("salary_min_lpa",   F.when(salary_disclosed, sal_min))
    .withColumn("salary_max_lpa",   F.when(salary_disclosed, F.coalesce(sal_max, sal_min)))
    .withColumn("is_remote",        is_remote)
    .withColumn("is_hybrid",        is_hybrid)
    .withColumn("city",             F.when(city != "", city).otherwise(F.lit("Unknown")))
    .withColumn("processed_at",     F.current_timestamp())
)

final_count = transformed.count()
print(f"[OK] Final record count: {final_count}")

# ── Load: processed layer in GCS (partitioned by source) ───────────────────
transformed.write.mode("overwrite").partitionBy("source").parquet(PROCESSED_PATH)
print(f"[OK] Processed layer written to {PROCESSED_PATH}")

# ── Load: BigQuery warehouse ───────────────────────────────────────────────
(transformed.write
    .format("bigquery")
    .option("table", BQ_TABLE)
    .option("temporaryGcsBucket", STAGING_BUCKET)
    .option("writeDisposition", "WRITE_TRUNCATE")
    .mode("overwrite")
    .save())
print(f"[OK] Loaded {final_count} rows into {BQ_TABLE}")

print("[DONE] Pipeline run summary: "
      f"raw={raw_count}, rejected={rejected_count}, final={final_count}")
spark.stop()
