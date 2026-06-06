// ============================ APP SHELL ============================
const { useState: useApp, useEffect: useFx } = React;

function App() {
  const I = window.Icons;
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "accent": "#9EE84F",
    "density": "regular",
    "gridTexture": true
  }/*EDITMODE-END*/;
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute]       = useApp('dash');
  const [jobs, setJobs]         = useApp(window.RealData.jobs);
  const [analytics, setAnalytics] = useApp(window.RealData.analytics);
  const [active, setActive]     = useApp(null);
  const [query, setQuery]       = useApp('');
  const [toast, setToast]       = useApp(null);
  const [navOpen, setNavOpen]   = useApp(false);
  const [scraping, setScraping] = useApp(false);
  // 'checking' | 'live' | 'offline'
  const [apiStatus, setApiStatus] = useApp('checking');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  // ── On mount: health-check, then pull live analytics ──────────────
  useFx(() => {
    let alive = true;
    (async () => {
      const ok = await window.API.health();
      if (!alive) return;
      if (ok) {
        setApiStatus('live');
        try {
          const data = await window.API.analytics();
          if (alive && data.status === 'success') {
            setAnalytics(a => window.API.mergeAnalytics(data, a));
          }
        } catch (_) {}
      } else {
        setApiStatus('offline');
      }
    })();
    return () => { alive = false; };
  }, []);

  // ── Mark applied — updates local state + syncs to backend ─────────
  const applyJob = (id) => {
    setJobs(js => js.map(j => j.id === id ? { ...j, status: 'applied' } : j));
    const j = jobs.find(x => x.id === id);
    showToast(`Applied to ${j ? j.title : 'role'} · added to pipeline`);
    setActive(a => a && a.id === id ? { ...a, status: 'applied' } : a);
    if (apiStatus === 'live') {
      window.API.markApplied(id).catch(() => {});
    }
  };

  const moveJob = (id, status) => {
    setJobs(js => js.map(j => j.id === id ? { ...j, status } : j));
  };

  const openJob = (j) => setActive(j);

  // ── Reload analytics (called after scrape completes) ──────────────
  const refreshAnalytics = async () => {
    try {
      const data = await window.API.analytics();
      if (data.status === 'success') {
        setAnalytics(a => window.API.mergeAnalytics(data, a));
      }
    } catch (_) {}
  };

  // ── Poll /scrape-status until all sources are no longer 'running' ─
  const pollScrapeStatus = () => {
    const interval = setInterval(async () => {
      try {
        const status = await window.API.scrapeStatus();
        const stillRunning = Object.values(status).some(v => v === 'running');
        if (!stillRunning) {
          clearInterval(interval);
          setScraping(false);
          await refreshAnalytics();
          const errors = Object.entries(status).filter(([, v]) => String(v).startsWith('error'));
          if (errors.length) {
            showToast(`Scrape finished · errors on: ${errors.map(([k]) => k).join(', ')}`);
          } else {
            showToast('Scrape complete · analytics refreshed');
          }
        }
      } catch (_) {
        clearInterval(interval);
        setScraping(false);
        showToast('Lost connection to server during scrape');
      }
    }, 1500);
  };

  // ── Scrape Fresh — real API if live, simulated if offline ─────────
  const scrapeFresh = async () => {
    if (scraping) return;
    if (apiStatus !== 'live') {
      setScraping(true);
      showToast('Scraping Naukri + Internshala… (simulated)');
      setTimeout(() => { setScraping(false); showToast('Scrape complete · 18 new jobs ingested'); }, 2400);
      return;
    }
    setScraping(true);
    showToast('Scraping Naukri + Internshala…');
    try {
      await window.API.scrapeAll();
      pollScrapeStatus();
    } catch (_) {
      setScraping(false);
      showToast('Scrape failed — is the Flask server running?');
    }
  };

  const trackedCount = jobs.filter(j => j.status !== 'new').length;

  const nav = [
    { key: 'dash',    label: 'Dashboard',    icon: I.dash },
    { key: 'jobs',    label: 'Find Jobs',    icon: I.search, count: analytics.total },
    { key: 'apps',    label: 'Applications', icon: I.kanban, count: trackedCount },
    { key: 'reports', label: 'Reports',      icon: I.report },
    { key: 'quality', label: 'Data Quality', icon: I.quality },
    { key: 'sources', label: 'Sources',      icon: I.sources },
  ];

  const titles = {
    dash:    ['Dashboard',    'Job market overview'],
    jobs:    ['Find Jobs',    'Search · filter · apply'],
    apps:    ['Applications', 'Your hiring pipeline'],
    reports: ['Reports',      'Power BI · embedded analytics'],
    quality: ['Data Quality', 'Completeness & dedup'],
    sources: ['Sources',      'Scrapers & schedule'],
  };

  useFx(() => { setNavOpen(false); }, [route]);

  useFx(() => {
    const r = document.documentElement;
    r.style.setProperty('--lime', t.accent);
    r.style.setProperty('--lime-dim',  `color-mix(in srgb, ${t.accent} 76%, #000)`);
    r.style.setProperty('--lime-glow', `color-mix(in srgb, ${t.accent} 16%, transparent)`);
    document.body.classList.toggle('no-grid', !t.gridTexture);
  }, [t.accent, t.gridTexture]);

  const go = (k) => setRoute(k);

  // Sidebar API status indicator
  const apiMeta = {
    checking: { dot: 'amber live', label: 'Connecting…',          sub: window.API.base() },
    live:     { dot: 'live',       label: 'API connected',         sub: window.API.base() },
    offline:  { dot: '',           label: 'Offline · cached data', sub: 'Start Flask on localhost:5000' },
  }[apiStatus];

  return (
    <div className={`app ${t.density === 'compact' ? 'compact' : ''}`}>
      <div className={`scrim-mobile ${navOpen ? 'show' : ''}`} onClick={() => setNavOpen(false)} />

      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <svg className="brand-pulse" viewBox="0 0 24 24" fill="none" stroke="#0A0C0F"
                 strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h4l2-7 4 14 2-7h8" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Market Pulse</div>
            <div className="brand-sub">Job Tracker</div>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-label">Workspace</div>
          {nav.map(n => {
            const Ico = n.icon;
            return (
              <button key={n.key}
                      className={`nav-item ${route === n.key ? 'active' : ''}`}
                      onClick={() => go(n.key)}>
                <Ico /> {n.label}
                {n.count != null && (
                  <span className="nav-count">{n.count.toLocaleString('en-IN')}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          {/* API connection status */}
          <div className="scrape-card" style={{ marginBottom: 8 }}>
            <div className="scrape-status">
              <span className={`dot ${apiMeta.dot}`}
                    style={apiStatus === 'live' ? {} : apiStatus === 'offline' ? { background: 'var(--text-faint)' } : {}} />
              {apiMeta.label}
            </div>
            <div className="last-run" style={{ marginTop: 3 }}>{apiMeta.sub}</div>
          </div>

          {/* Scraper card */}
          <div className="scrape-card">
            <div className="scrape-status">
              <span className={`dot ${scraping ? 'amber live' : 'live'}`} />
              {scraping ? 'scraping…' : 'scrapers online'}
            </div>
            <div className="last-run">
              Last run · today · {analytics.total.toLocaleString('en-IN')} jobs
            </div>
            <button className="btn btn-primary btn-sm"
                    style={{ width: '100%', marginTop: 11 }}
                    disabled={scraping}
                    onClick={scrapeFresh}>
              {scraping
                ? <><I.refresh size={14} className="spin" /> Scraping</>
                : <><I.bolt size={14} /> Scrape Fresh</>}
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn btn-icon btn-ghost mobile-bar" onClick={() => setNavOpen(true)}>
            <I.menu size={18} />
          </button>
          <div className="page-title">
            <span className="crumb">{titles[route][1]}</span>
            <h1>{titles[route][0]}</h1>
          </div>
          <div className="topbar-search">
            <I.search />
            <input placeholder="Search roles, companies…"
                   value={query}
                   onChange={e => {
                     setQuery(e.target.value);
                     if (route !== 'jobs') setRoute('jobs');
                   }} />
            <span className="kbd">/</span>
          </div>
          <button className="btn btn-primary" onClick={scrapeFresh} disabled={scraping}>
            {scraping
              ? <><I.refresh size={15} className="spin" /> Scraping</>
              : <><I.bolt size={15} /> Scrape</>}
          </button>
        </header>

        <main className="content" key={route}>
          {route === 'dash'    && <Dashboard jobs={jobs} analytics={analytics} onNav={go} />}
          {route === 'jobs'    && <FindJobs  jobs={jobs} onApply={applyJob} onOpen={openJob}
                                             query={query} apiStatus={apiStatus} />}
          {route === 'apps'    && <Applications jobs={jobs} onMove={moveJob} onOpen={openJob} />}
          {route === 'reports' && <PowerBIReport onToast={showToast} />}
          {route === 'quality' && <DataQuality  onToast={showToast} apiStatus={apiStatus} />}
          {route === 'sources' && <Sources onToast={showToast} apiStatus={apiStatus}
                                           onRefresh={refreshAnalytics} />}
        </main>
      </div>

      {active && (
        <JobDrawer job={active} onClose={() => setActive(null)} onApply={applyJob} />
      )}
      {toast && (
        <div className="toast"><window.Icons.checkCircle />{toast}</div>
      )}

      <window.TweaksPanel>
        <window.TweakSection label="Accent" />
        <window.TweakColor label="Phosphor" value={t.accent}
          options={['#9EE84F', '#4FD6E8', '#F2B84F', '#A78BFA']}
          onChange={(v) => setTweak('accent', v)} />
        <window.TweakSection label="Layout" />
        <window.TweakRadio label="Density" value={t.density}
          options={['regular', 'compact']}
          onChange={(v) => setTweak('density', v)} />
        <window.TweakToggle label="Grid texture" value={t.gridTexture}
          onChange={(v) => setTweak('gridTexture', v)} />
      </window.TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
