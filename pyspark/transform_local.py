"""
Transformation (local PySpark) — Stage 2, zero-cost variant.

Reads the raw job snapshot parquet, applies cleaning + enrichment, runs
row-level data-quality checks, and writes the processed layer as parquet
partitioned by source. Designed to run on a laptop (no Dataproc) while
producing the exact same processed schema the cloud job would.

Next stage: `bq load` the processed parquet into BigQuery (free batch load).

Run with: python pyspark/transform_local.py
"""

import os
import sys
import glob

# ── Windows bootstrap: point Hadoop at winutils so parquet writes work ──
if os.name == "nt":
    os.environ.setdefault("HADOOP_HOME", r"C:\hadoop")
    os.environ["PATH"] = r"C:\hadoop\bin" + os.pathsep + os.environ.get("PATH", "")

from pyspark.sql import SparkSession, functions as F
from pyspark.sql.window import Window

HERE          = os.path.dirname(os.path.abspath(__file__))
RAW_GLOB      = os.path.join(HERE, "out", "jobs_*.parquet")
PROCESSED_OUT = os.path.join(HERE, "out", "processed")


def latest_raw() -> str:
    files = sorted(glob.glob(RAW_GLOB))
    if not files:
        sys.exit(f"[ERROR] No raw parquet found at {RAW_GLOB} — run extract_to_gcs.py first")
    return files[-1]


def main():
    spark = (SparkSession.builder
             .appName("JobMarketETL-TransformLocal")
             .master("local[*]")
             .getOrCreate())
    spark.sparkContext.setLogLevel("WARN")

    raw_path = latest_raw()
    raw = spark.read.parquet(raw_path)
    raw_count = raw.count()
    print(f"[INFO] Read {raw_count} raw rows from {os.path.basename(raw_path)}")

    # ── Data quality gate: title + company are mandatory ──
    valid = raw.filter(
        F.col("title").isNotNull() & (F.trim("title") != "") &
        F.col("company").isNotNull() & (F.trim("company") != "")
    )
    rejected = raw_count - valid.count()
    print(f"[DQ] Rejected (blank title/company): {rejected}")

    # ── Deduplicate: latest scrape wins, keyed on url then title|company|source ──
    key = F.coalesce(F.col("job_url"), F.concat_ws("|", "title", "company", "source"))
    w = Window.partitionBy(key).orderBy(F.col("scraped_at").desc())
    deduped = (valid.withColumn("_rn", F.row_number().over(w))
                    .filter(F.col("_rn") == 1).drop("_rn"))
    dupes = valid.count() - deduped.count()
    print(f"[DQ] Duplicates removed: {dupes}")

    # ── Enrichment ──
    # regexp_extract yields '' on no match; Spark 4.x ANSI mode rejects cast('' AS num),
    # so route empty -> NULL before casting.
    def num(col_expr, pattern, group, typ):
        raw = F.regexp_extract(col_expr, pattern, group)
        return F.when(raw == "", None).otherwise(raw).cast(typ)

    skills_arr = F.when(
        F.col("skills").isNotNull() & (F.trim("skills") != ""),
        F.expr("filter(transform(split(skills, '\\n'), x -> trim(x)), x -> x != '')")
    ).otherwise(F.array().cast("array<string>"))

    exp_min = num(F.col("experience"), r"(\d+)", 1, "int")
    exp_max = num(F.col("experience"), r"\d+\s*[-to]+\s*(\d+)", 1, "int")
    is_fresher = F.lower(F.coalesce("experience", F.lit(""))).rlike("fresher|no experience")
    exp_bucket = (
        F.when(is_fresher | (F.coalesce(exp_min, F.lit(99)) == 0), "Fresher")
         .when(exp_min.between(1, 2), "1-2 yr")
         .when(exp_min.between(3, 5), "3-5 yr")
         .when(exp_min >= 6, "6+ yr")
         .otherwise("Unspecified")
    )

    sal_lower = F.lower(F.coalesce("salary", F.lit("")))
    salary_disclosed = ~sal_lower.rlike("not disclosed|competitive|unpaid|^$")
    sal_min = num(sal_lower, r"(\d+(?:\.\d+)?)\s*(?:-|to)?", 1, "double")
    sal_max = num(sal_lower, r"(?:-|to)\s*(\d+(?:\.\d+)?)", 1, "double")

    loc = F.coalesce("location", F.lit(""))
    is_remote = F.lower(loc).rlike("remote|work from home")
    is_hybrid = F.lower(loc).rlike("hybrid")
    city = F.initcap(F.trim(F.regexp_replace(loc, r"(?i)hybrid\s*-\s*|remote\s*-?\s*|work from home", "")))

    out = (deduped
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

    final_count = out.count()
    out.write.mode("overwrite").partitionBy("source").parquet(PROCESSED_OUT)
    print(f"[OK] Wrote {final_count} processed rows -> {PROCESSED_OUT}")
    print(f"[SUMMARY] raw={raw_count} rejected={rejected} dupes={dupes} final={final_count}")

    print("[INFO] Sample of enriched columns:")
    out.select("title", "city", "exp_bucket", "salary_disclosed",
               "salary_min_lpa", "is_remote", "source").show(5, truncate=30)

    spark.stop()


if __name__ == "__main__":
    main()
