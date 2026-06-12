import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scraper.db import get_connection
import json
from datetime import datetime

conn = get_connection()
cursor = conn.cursor()

# Get jobs
cursor.execute('''
    SELECT id, title, company, location, salary, experience, job_url, applied, source, scraped_at, description, skills
    FROM jobs ORDER BY scraped_at DESC LIMIT 300
''')
jobs_data = cursor.fetchall()

# Get analytics
cursor.execute("SELECT COUNT(*) FROM jobs")
total_jobs = cursor.fetchone()[0]

cursor.execute("SELECT COUNT(*) FROM jobs WHERE applied = TRUE")
applied_jobs = cursor.fetchone()[0]

cursor.execute("SELECT source, COUNT(*) as count FROM jobs GROUP BY source ORDER BY count DESC")
by_source = [{'source': r[0], 'count': r[1]} for r in cursor.fetchall()]

cursor.execute("SELECT title, COUNT(*) as count FROM jobs GROUP BY title ORDER BY count DESC LIMIT 10")
top_roles = [{'title': r[0], 'count': r[1]} for r in cursor.fetchall()]

cursor.execute("SELECT DATE(scraped_at) as date, COUNT(*) as count FROM jobs GROUP BY DATE(scraped_at) ORDER BY date DESC LIMIT 30")
daily_trend = [{'date': str(r[0]), 'count': r[1]} for r in cursor.fetchall()]

cursor.close()
conn.close()

# Format jobs
jobs = []
for r in jobs_data:
    skills = []
    if r[11]:  # skills field
        if isinstance(r[11], list):
            skills = r[11]
        elif isinstance(r[11], str):
            skills = [s.strip() for s in r[11].split(',') if s.strip()]

    jobs.append({
        'id': r[0],
        'title': r[1],
        'company': r[2],
        'location': r[3],
        'salary': r[4],
        'experience': r[5],
        'url': r[6],
        'applied': r[7],
        'status': 'applied' if r[7] else 'saved',
        'source': r[8],
        'description': r[10] or '',
        'scraped_at': r[9].isoformat() if r[9] else '',
        'skills': skills,
        'fit': 0
    })

# Build realdata.js
realdata = {
    'jobs': jobs,
    'analytics': {
        'total_jobs': total_jobs,
        'applied_jobs': applied_jobs,
        'pending_jobs': total_jobs - applied_jobs,
        'by_source': by_source,
        'top_roles': top_roles,
        'daily_trend': daily_trend
    }
}

with open('static/app/realdata.js', 'w') as f:
    f.write(f'window.RealData = {json.dumps(realdata)};\n')

print(f'Updated realdata.js with {len(jobs)} jobs and analytics')
