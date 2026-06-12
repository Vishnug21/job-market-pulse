from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("JobMarketTest").getOrCreate()

data = [
    ("Data Analyst", "₹5 LPA", "Bangalore"),
    ("Backend Dev", "₹8 LPA", "Mumbai"),
    ("Frontend Dev", "₹6 LPA", "Delhi")
]

df = spark.createDataFrame(data, ["title", "salary", "location"])

print("✓ DataFrame created:")
df.show()

print("\n✓ Group by location:")
df.groupBy("location").count().show()

spark.stop()
