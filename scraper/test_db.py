import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db import get_connection

try:
    conn = get_connection()
    print("✅ Database connection successful!")
    conn.close()
except Exception as e:
    print(f"❌ Connection failed: {e}")