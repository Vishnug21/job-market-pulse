from flask import Flask, render_template, request, jsonify
from scraper.db import get_connection, run_migrations
from scraper.validator import run_quality_report, deduplicate_by_url
import threading
import os

app = Flask(__name__)

try:
    run_migrations()
except Exception:
    pass

# In-memory scrape status: source -> 'running' | 'done' | 'error: ...'
_scrape_status: dict[str, str] = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search', methods=['POST'])
def search():
    body     = request.json or {}
    job_role = body.get('job_role', 'Data Analyst')
    source   = body.get('source')        # 'Internshala' | 'Naukri' | None
    filters  = body.get('filters', {})   # same filter dict the scraper uses

    conditions = ["(title ILIKE %s OR company ILIKE %s)"]
    params     = [f'%{job_role}%', f'%{job_role}%']

    if source:
        conditions.append("source = %s")
        params.append(source)

    # Experience — match stored text e.g. "Fresher", "0-1 years"
    exp_map = {
        'fresher': '%fresher%',
        '0-1':     '%0-1%',
        '1-3':     '%1-3%',
        '3-5':     '%3-5%',
        '5+':      '%5+%',
    }
    exp = filters.get('experience', 'any')
    if exp != 'any' and exp in exp_map:
        conditions.append("experience ILIKE %s")
        params.append(exp_map[exp])

    # Salary — text-based match on stored salary string (e.g. "₹5 LPA", "5-8 LPA")
    salary_keywords = {
        '200000':  ['2 lpa', '2l', '₹2', '2,00'],
        '300000':  ['3 lpa', '3l', '₹3', '3,00'],
        '500000':  ['5 lpa', '5l', '₹5', '5,00'],
        '800000':  ['8 lpa', '8l', '₹8', '8,00'],
        '1000000': ['10 lpa', '10l', '₹10', '10,00'],
        '1200000': ['12 lpa', '12l', '₹12', '12,00'],
        '1500000': ['15 lpa', '15l', '₹15', '15,00'],
    }
    sal = filters.get('salary_min', 'any')
    if sal != 'any' and sal in salary_keywords:
        kws = salary_keywords[sal]
        sal_clauses = " OR ".join(["salary ILIKE %s"] * len(kws))
        conditions.append(f"({sal_clauses})")
        params += [f'%{k}%' for k in kws]

    # Work from home — match stored location text
    if filters.get('work_from_home'):
        conditions.append("(location ILIKE %s OR location ILIKE %s)")
        params += ['%work from home%', '%remote%']

    # Posted within N days — filter by scraped_at as a proxy
    posted = filters.get('posted_within', 'any')
    if posted != 'any':
        try:
            days = int(posted)
            conditions.append("scraped_at >= NOW() - INTERVAL '%s days'")
            params.append(days)
        except (ValueError, TypeError):
            pass

    # Applied status
    applied_filter = filters.get('applied', 'all')
    if applied_filter == 'pending':
        conditions.append("applied = FALSE")
    elif applied_filter == 'applied':
        conditions.append("applied = TRUE")

    # Sort order
    order = "scraped_at DESC" if filters.get('sort_by', 'recent') == 'recent' else "title ASC"

    where = " AND ".join(conditions)
    sql = f"""
        SELECT id, title, company, location, salary, experience, job_url, applied, source, description, scraped_at
        FROM jobs
        WHERE {where}
        ORDER BY {order}
        LIMIT 10000
    """

    try:
        conn   = get_connection()
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows   = cursor.fetchall()
        cursor.close()
        conn.close()

        jobs_list = [
            {
                'id': r[0], 'title': r[1], 'company': r[2],
                'location': r[3], 'salary': r[4], 'experience': r[5],
                'url': r[6], 'applied': r[7], 'source': r[8],
                'description': r[9] or '',
                'scraped_at': r[10].isoformat() if r[10] else '',
            }
            for r in rows
        ]
        return jsonify({'status': 'success', 'jobs': jobs_list})

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/scrape', methods=['POST'])
def scrape():
    if os.getenv('DISABLE_SCRAPING') == 'true':
        return jsonify({'status': 'disabled'})

    body     = request.json or {}
    source   = body.get('source', 'Internshala')
    job_role = body.get('job_role', 'Data Analyst')
    filters  = body.get('filters', {})

    if _scrape_status.get(source) == 'running':
        return jsonify({'status': 'already_running'})

    def _run():
        _scrape_status[source] = 'running'
        try:
            if source == 'Internshala':
                from scraper.Internshala import scrape_internshala
                scrape_internshala(job_role, max_jobs=5, filters=filters)
            elif source == 'Naukri':
                from scraper.naukri import scrape_naukri
                scrape_naukri(job_role, max_jobs=10, filters=filters)
            _scrape_status[source] = 'done'
        except Exception as e:
            _scrape_status[source] = f'error: {e}'

    threading.Thread(target=_run, daemon=True).start()
    return jsonify({'status': 'started'})

@app.route('/scrape-status')
def scrape_status():
    return jsonify(_scrape_status)

@app.route('/mark-applied', methods=['POST'])
def mark_applied():
    job_id = request.json.get('job_id')
    if not job_id:
        return jsonify({'status': 'error', 'message': 'job_id required'})

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE jobs SET applied = TRUE WHERE id = %s",
            (job_id,)
        )
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'success'})

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/api/analytics')
def analytics():
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM jobs")
        total = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM jobs WHERE applied = TRUE")
        applied = cursor.fetchone()[0]

        cursor.execute("""
            SELECT source, COUNT(*) as count
            FROM jobs
            GROUP BY source
            ORDER BY count DESC
        """)
        by_source = [{'source': r[0], 'count': r[1]} for r in cursor.fetchall()]

        cursor.execute("""
            SELECT title, COUNT(*) as count
            FROM jobs
            GROUP BY title
            ORDER BY count DESC
            LIMIT 10
        """)
        top_roles = [{'title': r[0], 'count': r[1]} for r in cursor.fetchall()]

        cursor.execute("""
            SELECT DATE(scraped_at) as date, COUNT(*) as count
            FROM jobs
            GROUP BY DATE(scraped_at)
            ORDER BY date DESC
            LIMIT 30
        """)
        daily_trend = [{'date': str(r[0]), 'count': r[1]} for r in cursor.fetchall()]

        cursor.close()
        conn.close()

        return jsonify({
            'status': 'success',
            'total_jobs': total,
            'applied_jobs': applied,
            'pending_jobs': total - applied,
            'by_source': by_source,
            'top_roles': top_roles,
            'daily_trend': daily_trend,
        })

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/api/quality-report')
def quality_report():
    try:
        conn = get_connection()
        report = run_quality_report(conn)
        conn.close()
        return jsonify({'status': 'success', 'report': report})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/api/deduplicate', methods=['POST'])
def deduplicate():
    try:
        conn = get_connection()
        deleted = deduplicate_by_url(conn)
        conn.close()
        return jsonify({'status': 'success', 'deleted': deleted})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/api/export')
def export_csv():
    import csv
    import io
    from flask import Response

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, title, company, location, experience, salary, skills,
                   source, applied, scraped_at, job_url
            FROM jobs
            ORDER BY scraped_at DESC
        """)
        rows = cursor.fetchall()
        cols = [desc[0] for desc in cursor.description]
        cursor.close()
        conn.close()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(cols)
        writer.writerows(rows)

        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment; filename=job_market_pulse.csv'}
        )

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

if __name__ == '__main__':
    app.run(debug=True)