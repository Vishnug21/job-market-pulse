import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pyspark.sql import SparkSession
import pandas as pd
from scraper.db import get_connection

# Initialize Spark session with GCS support
spark = SparkSession.builder \
    .appName("JobMarketETL-RawExport") \
    .config("spark.jars.packages", "com.google.cloud.bigdataoss:gcs-connector:hadoop3-2.2.5") \
    .getOrCreate()

# Read from PostgreSQL using pandas
print("[INFO] Reading from PostgreSQL...")
conn = get_connection()
df_pandas = pd.read_sql("SELECT * FROM jobs", conn)
conn.close()
print(f"[OK] Loaded {len(df_pandas)} jobs from PostgreSQL")

# Convert to Spark DataFrame
df = spark.createDataFrame(df_pandas)

# Show schema
print("[INFO] DataFrame Schema:")
df.printSchema()

print(f"[INFO] Total records: {df.count()}")

# Write to GCS (Raw Layer)
gcs_raw_path = "gs://job-market-pulse-raw/jobs"
print(f"[INFO] Writing to GCS: {gcs_raw_path}")
df.write.mode("overwrite").parquet(gcs_raw_path)

print(f"[OK] Exported {df.count()} jobs to {gcs_raw_path}")
print("[OK] Raw data layer ready in GCS!")

spark.stop()