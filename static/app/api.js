// ============================ API CLIENT ============================
// Wraps all Flask backend calls with graceful offline fallback.
//
// Same-origin detection: when this page is served BY Flask (e.g. localhost:5000),
// all fetch calls use relative paths ('/search', '/api/analytics', …).
// When opened as a standalone static file from a different origin,
// it falls back to http://localhost:5000 so the prototype still works.

(function () {
  // If the page is served by Flask we're already on the right origin — use ''.
  // Otherwise aim at the default Flask dev-server address.
  var SAME_ORIGIN  = (window.location.port === '5000' || window.location.protocol !== 'file:');
  var DEFAULT_BASE = SAME_ORIGIN ? '' : 'http://localhost:5000';

  function base() {
    try { return localStorage.getItem('mp_api_base') || DEFAULT_BASE; } catch { return DEFAULT_BASE; }
  }
  function setBase(url) {
    try { localStorage.setItem('mp_api_base', url.replace(/\/$/, '')); } catch {}
  }

  async function apiFetch(path, options) {
    const res = await fetch(base() + path, {
      headers: { 'Content-Type': 'application/json' },
      ...(options || {}),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  // Quick health check — 2.5 s timeout
  async function health() {
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(function () { ctrl.abort(); }, 2500);
      const res   = await fetch(base() + '/api/analytics', { signal: ctrl.signal });
      clearTimeout(timer);
      return res.ok;
    } catch { return false; }
  }

  // Normalise a DB row (from /search) to the internal job shape
  function normaliseJob(r) {
    return {
      id:          r.id,
      title:       r.title        || '—',
      company:     r.company      || '—',
      location:    r.location     || '—',
      salary:      r.salary       || 'Not disclosed',
      experience:  r.experience   || '—',
      url:         r.url || r.job_url || '#',
      applied:     r.applied      || false,
      source:      r.source       || 'Naukri',
      description: r.description  || '',
      scraped_at:  r.scraped_at   || new Date().toISOString(),
      skills:      Array.isArray(r.skills) ? r.skills
                 : (r.skills ? String(r.skills).split(',').map(function(s){ return s.trim(); }).filter(Boolean) : []),
      fit:         r.fit          || 0,
      status:      r.applied ? 'applied' : (r.status || 'new'),
      postedDays:  0,
    };
  }

  // Map API analytics response onto the richer RealData.analytics shape
  function mergeAnalytics(apiData, base) {
    var bySource = (apiData.by_source || []).map(function (s) {
      return Object.assign({}, s, {
        color: s.source === 'Naukri' ? 'var(--naukri)' : 'var(--internshala)',
      });
    });
    var topRoles = (apiData.top_roles || []).map(function (r) {
      return { title: r.title, count: r.count };
    });
    return Object.assign({}, base, {
      total:        apiData.total_jobs   != null ? apiData.total_jobs   : base.total,
      appliedCount: apiData.applied_jobs != null ? apiData.applied_jobs : base.appliedCount,
      bySource:     bySource.length ? bySource : base.bySource,
      topRoles:     topRoles.length ? topRoles : base.topRoles,
    });
  }

  // Map API quality-report payload to internal quality shape
  function mergeQuality(report, base) {
    if (!report) return base;
    var total  = report.total   || base.total;
    var noSal  = report.no_salary || 0;
    var noUrl  = report.no_url    || 0;
    var salPct = total ? Math.round((total - noSal) / total * 100) : base.fields[0].pct;
    var urlPct = total ? Math.round((total - noUrl) / total * 100) : base.fields[5].pct;

    var fields = base.fields.map(function (f, i) {
      if (i === 0) return Object.assign({}, f, { pct: salPct });
      if (i === 5) return Object.assign({}, f, { pct: urlPct });
      return f;
    });

    return Object.assign({}, base, {
      total:      total,
      duplicates: report.url_duplicates != null ? report.url_duplicates : base.duplicates,
      fields:     fields,
    });
  }

  window.API = {
    base:           base,
    setBase:        setBase,
    health:         health,
    normaliseJob:   normaliseJob,
    mergeAnalytics: mergeAnalytics,
    mergeQuality:   mergeQuality,

    search: function (jobRole, source, filters) {
      return apiFetch('/search', {
        method: 'POST',
        body: JSON.stringify({
          job_role: jobRole || '',
          source:   source  || null,
          filters:  filters || {},
        }),
      });
    },

    scrape: function (source, jobRole, filters) {
      return apiFetch('/scrape', {
        method: 'POST',
        body: JSON.stringify({
          source:   source   || 'Internshala',
          job_role: jobRole  || 'Data Analyst',
          filters:  filters  || {},
        }),
      });
    },

    scrapeAll: function (jobRole) {
      var role = jobRole || 'Data Analyst';
      return Promise.allSettled([
        apiFetch('/scrape', { method: 'POST', body: JSON.stringify({ source: 'Internshala', job_role: role }) }),
        apiFetch('/scrape', { method: 'POST', body: JSON.stringify({ source: 'Naukri',      job_role: role }) }),
      ]);
    },

    scrapeStatus: function () { return apiFetch('/scrape-status'); },

    markApplied: function (jobId) {
      return apiFetch('/mark-applied', {
        method: 'POST',
        body: JSON.stringify({ job_id: jobId }),
      });
    },

    analytics:     function () { return apiFetch('/api/analytics'); },
    qualityReport: function () { return apiFetch('/api/quality-report'); },
    deduplicate:   function () { return apiFetch('/api/deduplicate', { method: 'POST' }); },

    exportCSV: function () {
      window.open(base() + '/api/export', '_blank');
    },
  };
})();
