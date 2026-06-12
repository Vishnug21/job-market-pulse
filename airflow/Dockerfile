# Custom Airflow image for the job_market_pulse ETL pipeline.
#
# The DAG's BashOperator tasks shell out to tools that are NOT in the stock
# Airflow image, so we bake them in here:
#   * OpenJDK 17        -> PySpark 4.x needs a JVM (transform task)
#   * Google Cloud CLI  -> gcloud / gsutil / bq (upload + load + DQ tasks)
#   * Python libs       -> pyspark, pandas, pyarrow, psycopg2, dotenv
FROM apache/airflow:2.10.5-python3.11

USER root

# Java 17 for Spark, plus the prerequisites for the Google Cloud CLI apt repo.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      openjdk-17-jre-headless curl gnupg apt-transport-https ca-certificates \
 && curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
      | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
      > /etc/apt/sources.list.d/google-cloud-sdk.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends google-cloud-cli \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Spark locates the JVM via JAVA_HOME (Debian bookworm / amd64 path).
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

USER airflow
COPY requirements.txt /tmp/airflow-requirements.txt
RUN pip install --no-cache-dir -r /tmp/airflow-requirements.txt
