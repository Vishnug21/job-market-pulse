// ============================ DASHBOARD + FIND JOBS ============================
const { useState: useS2, useMemo, useEffect: useFx2, useRef } = React;

// ---------------- DASHBOARD ----------------
function Dashboard({ jobs, analytics, onNav }) {
  const I = window.Icons;
  const a = analytics;
  const tracked  = jobs.filter(j => j.status !== 'new').length;
  const topLoc   = (a.topLocations  || [])[0] || { name: '—', count: 0 };
  const fmtN     = n => n.toLocaleString('en-IN');

  const kpis = [
    { label: 'Jobs Tracked',    value: fmtN(a.total),       icon: I.briefcase, c: 'var(--lime)',   foot: '2 sources · Naukri + Internshala' },
    { label: 'Salary Disclosed',value: a.salaryPct,         unit: '%', icon: I.rupee, c: 'var(--amber)', foot: `${fmtN(a.salaryDisclosed)} of ${fmtN(a.total)} listings` },
    { label: 'In Pipeline',     value: tracked,             icon: I.kanban,    c: 'var(--cyan)',   foot: `${a.appliedCount} applied` },
    { label: 'Top Hiring Hub',  value: topLoc.name,         icon: I.pin,       c: 'var(--violet)', foot: `${fmtN(topLoc.count)} open roles`, small: true },
  ];

  const srcColor = s => s === 'Naukri' ? 'var(--naukri)' : 'var(--internshala)';

  return (
    <div>
      <div className="kpi-grid">
        {kpis.map((k, i) => {
          const Ico = k.icon;
          return (
            <div className="kpi" key={i} style={{ '--accent-c': k.c }}>
              <div className="kpi-label"><Ico /> {k.label}</div>
              <div className="kpi-value" style={k.small ? { fontSize: '1.5rem' } : {}}>
                {k.value}{k.unit && <span className="unit">{k.unit}</span>}
              </div>
              <div className="kpi-foot">{k.foot}</div>
            </div>
          );
        })}
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <div><h3>Top Hiring Locations</h3><div className="sub">open roles by city</div></div>
            <button className="btn btn-sm btn-ghost" onClick={() => onNav('jobs')}>Browse jobs</button>
          </div>
          <BarList data={a.topLocations || []} nameKey="name" color="var(--cyan)" />
        </div>
        <div className="card">
          <div className="card-head"><h3>Jobs by Source</h3></div>
          <Donut data={a.bySource} total={a.bySource.reduce((x, y) => x + y.count, 0)} />
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head"><div><h3>Top Roles</h3><div className="sub">most frequent titles scraped</div></div></div>
          <BarList data={a.topRoles || []} nameKey="title" color="var(--lime)" />
        </div>
        <div className="card">
          <div className="card-head"><div><h3>Experience Mix</h3><div className="sub">demand by seniority</div></div></div>
          <BarList data={a.experience || []} nameKey="name" color="var(--amber)" />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div><h3>Top Companies</h3><div className="sub">most active employers</div></div></div>
          <BarList data={a.topCompanies || []} nameKey="name" color="var(--violet)" />
        </div>
        <div className="card">
          <div className="card-head"><h3>Latest Scrapes</h3><span className="sub">freshest listings</span></div>
          <div className="feed">
            {(a.recent || []).map((r, i) => (
              <div className="feed-item" key={i}>
                <span className="feed-icon" style={{ color: srcColor(r.source) }}><I.briefcase /></span>
                <div className="feed-body">
                  <div className="feed-text"><b>{r.title}</b> · {r.company}</div>
                  <div className="feed-time">{r.source} · {window.MockData.relTime(r.scraped_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- FIND JOBS helpers ----------------
function expBucket(e) {
  if (/no experience|fresher/i.test(e)) return 'Fresher';
  const m = e.match(/\d+/); if (!m) return 'Not specified';
  const n = +m[0]; if (n === 0) return 'Fresher';
  if (n <= 2) return '0–2 yr'; if (n <= 5) return '3–5 yr'; return '6+ yr';
}
const hasSalary = s => !/competitive|not disclosed|^\s*$/i.test(s || '');

// experience bucket → API filter value
const EXP_TO_API = {
  'any':      'any',
  'Fresher':  'fresher',
  '0–2 yr':  '1-3',
  '3–5 yr':  '3-5',
  '6+ yr':   '5+',
};

// ---------------- FIND JOBS ----------------
function FindJobs({ jobs, onApply, onOpen, query, apiStatus }) {
  const I = window.Icons;

  // filter state
  const [source,      setSource]      = useS2('all');
  const [view,        setView]        = useS2('cards');
  const [exp,         setExp]         = useS2('any');
  const [wfh,         setWfh]         = useS2(false);
  const [salDisc,     setSalDisc]     = useS2(false);
  const [sort,        setSort]        = useS2('fit');
  const [hideApplied, setHideApplied] = useS2(false);
  const [limit,       setLimit]       = useS2(10000);

  // API search state
  const [apiResults,  setApiResults]  = useS2(null);   // null = not yet fetched via API
  const [apiLoading,  setApiLoading]  = useS2(false);
  const debounceRef = useRef(null);

  // ── Debounced API search — fires whenever filters or query change ──
  useFx2(() => {
    if (apiStatus !== 'live') {
      setApiResults(null);
      return;
    }

    // Cancel any pending call
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setApiLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const apiSource = source === 'all' ? null
          : source.charAt(0).toUpperCase() + source.slice(1); // 'internshala' → 'Internshala'

        const filters = {};
        if (exp !== 'any') filters.experience = EXP_TO_API[exp] || 'any';
        if (wfh)           filters.work_from_home = true;
        if (hideApplied)   filters.applied = 'pending';
        filters.sort_by = sort === 'recent' ? 'recent' : 'recent'; // API sorts by recent; fit handled client-side

        const res = await window.API.search(query, apiSource, filters);
        if (res.status === 'success') {
          setApiResults(res.jobs.map(window.API.normaliseJob));
        }
      } catch (_) {
        // Server went away mid-session → fall back silently
        setApiResults(null);
      }
      setApiLoading(false);
    }, 380);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [apiStatus, query, source, exp, wfh, hideApplied, sort]);

  // ── Result set: API results (+ client-side salary/fit) or local fallback ──
  const filtered = useMemo(() => {
    let r;
    if (apiStatus === 'live' && apiResults !== null) {
      r = apiResults;
      if (salDisc) r = r.filter(j => hasSalary(j.salary));
    } else {
      // client-side filtering on static / in-memory jobs
      r = jobs.filter(j => {
        if (source !== 'all' && j.source.toLowerCase() !== source) return false;
        if (wfh     && !/work from home|remote/i.test(j.location))  return false;
        if (salDisc && !hasSalary(j.salary))                         return false;
        if (hideApplied && j.status !== 'new' && j.status !== 'saved') return false;
        if (exp !== 'any' && expBucket(j.experience) !== exp)        return false;
        if (query && !(`${j.title} ${j.company} ${j.location}`
            .toLowerCase().includes(query.toLowerCase())))           return false;
        return true;
      });
    }
    // fit sort always done client-side
    if (sort === 'fit')    r = [...r].sort((a, b) => b.fit - a.fit);
    if (sort === 'recent' && apiStatus !== 'live')
      r = [...r].sort((a, b) => String(b.scraped_at).localeCompare(String(a.scraped_at)));
    return r;
  }, [jobs, apiResults, apiStatus, source, wfh, salDisc, hideApplied, exp, sort, query]);

  useFx2(() => { setLimit(10000); }, [source, wfh, salDisc, hideApplied, exp, sort, query]);
  const shown = filtered.slice(0, limit);

  const dbTotal = window.RealData.analytics.total;
  const srcCounts = {
    all:          apiStatus === 'live' ? dbTotal : jobs.length,
    internshala:  jobs.filter(j => j.source === 'Internshala').length,
    naukri:       jobs.filter(j => j.source === 'Naukri').length,
  };

  return (
    <div className="jobs-layout">
      {/* ── Filter rail ── */}
      <aside className="filter-rail">
        <div className="filter-block">
          <h4>Source</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[['all', 'All sources'], ['internshala', 'Internshala'], ['naukri', 'Naukri']].map(([k, label]) => (
              <button key={k}
                      className={`nav-item ${source === k ? 'active' : ''}`}
                      style={{ padding: '8px 10px' }}
                      onClick={() => setSource(k)}>
                {k !== 'all' && (
                  <span className="badge-dot" style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: k === 'internshala' ? 'var(--internshala)' : 'var(--naukri)',
                  }} />
                )}
                {label}
                <span className="nav-count">{srcCounts[k].toLocaleString('en-IN')}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="filter-block">
          <h4>Refine</h4>
          <div className="field">
            <label className="field-label">Experience</label>
            <select className="select" value={exp} onChange={e => setExp(e.target.value)}>
              <option value="any">Any experience</option>
              <option value="Fresher">Fresher</option>
              <option value="0–2 yr">0–2 yr</option>
              <option value="3–5 yr">3–5 yr</option>
              <option value="6+ yr">6+ yr</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Sort by</label>
            <select className="select" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="fit">Best fit</option>
              <option value="recent">Most recent</option>
            </select>
          </div>
        </div>

        <div className="filter-block">
          <h4>Toggles</h4>
          <label className="check">
            <input type="checkbox" checked={salDisc} onChange={e => setSalDisc(e.target.checked)} />
            <span className="box"><I.check /></span> Salary disclosed only
          </label>
          <label className="check">
            <input type="checkbox" checked={wfh} onChange={e => setWfh(e.target.checked)} />
            <span className="box"><I.check /></span> Work from home
          </label>
          <label className="check">
            <input type="checkbox" checked={hideApplied} onChange={e => setHideApplied(e.target.checked)} />
            <span className="box"><I.check /></span> Hide applied
          </label>
        </div>
      </aside>

      {/* ── Results ── */}
      <div>
        <div className="jobs-toolbar">
          <span className="result-count">
            {apiLoading ? (
              <span style={{ color: 'var(--text-faint)' }}>
                <I.refresh size={13} className="spin" style={{ marginRight: 6 }} />
                Searching database…
              </span>
            ) : (
              <>
                <b>{filtered.length.toLocaleString('en-IN')}</b> roles match
                <span style={{ color: 'var(--text-ghost)' }}> · {dbTotal.toLocaleString('en-IN')} in database</span>
              </>
            )}
            {apiStatus === 'live' && !apiLoading && (
              <span className="badge" style={{
                marginLeft: 8,
                color: 'var(--lime)',
                borderColor: 'color-mix(in srgb, var(--lime) 30%, transparent)',
              }}>
                <span className="dot live" style={{ width: 5, height: 5 }} /> Live
              </span>
            )}
          </span>

          <div style={{ marginLeft: 'auto' }} className="tabs">
            <button className={`tab ${view === 'cards' ? 'active' : ''}`} onClick={() => setView('cards')}>
              <I.grid size={14} /> Cards
            </button>
            <button className={`tab ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>
              <I.list size={14} /> Table
            </button>
          </div>
        </div>

        {apiLoading ? (
          <div className="card empty" style={{ minHeight: 200 }}>
            <I.refresh size={28} className="spin" style={{ color: 'var(--text-faint)' }} />
            <p style={{ color: 'var(--text-faint)', marginTop: 12 }}>Fetching from database…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card empty">
            <I.search />
            <p>No roles match these filters. Try widening your search or scraping fresh listings.</p>
          </div>
        ) : view === 'cards' ? (
          <div className="job-grid">
            {shown.map(j => <JobCard key={j.id} job={j} onApply={onApply} onOpen={onOpen} />)}
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="dtable">
              <thead><tr>
                <th>Role</th><th>Company</th><th>Location</th><th>Exp</th><th>Salary</th><th>Fit</th><th></th>
              </tr></thead>
              <tbody>
                {shown.map(j => (
                  <tr key={j.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(j)}>
                    <td className="cell-strong">{j.title}</td>
                    <td>{j.company}</td>
                    <td className="cell-mono">{j.location}</td>
                    <td className="cell-mono">{j.experience}</td>
                    <td className="cell-mono" style={{ color: hasSalary(j.salary) ? 'var(--lime)' : 'var(--text-faint)' }}>
                      {j.salary}
                    </td>
                    <td className="cell-mono" style={{ color: j.fit ? 'inherit' : 'var(--text-faint)' }}>
                      {j.fit || '—'}
                    </td>
                    <td><SourceBadge source={j.source} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {limit < filtered.length && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
            <button className="btn" onClick={() => setLimit(l => l + 40)}>
              Load more · {(filtered.length - limit).toLocaleString('en-IN')} remaining
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function JobCard({ job, onApply, onOpen }) {
  const I = window.Icons;
  const isApplied = ['applied', 'interview', 'offer', 'rejected'].includes(job.status);
  return (
    <div className={`job-card ${isApplied ? 'applied' : ''}`} onClick={() => onOpen(job)}>
      <div className="job-main">
        <div className="job-top">
          <span className="job-title">{job.title}</span>
          <SourceBadge source={job.source} />
          {job.status === 'saved' && <span className="badge"><I.bookmark size={11} /> Saved</span>}
        </div>
        <div className="job-company"><b>{job.company}</b> · scraped {window.MockData.relTime(job.scraped_at)}</div>
        <div className="job-meta">
          <MetaPill icon={I.pin}>{job.location}</MetaPill>
          <MetaPill icon={I.briefcase}>{job.experience}</MetaPill>
          <MetaPill icon={I.rupee} variant="salary">{job.salary}</MetaPill>
        </div>
        <div className="skill-row">
          {(job.skills || []).slice(0, 4).map(s => <span className="skill" key={s}>{s}</span>)}
        </div>
      </div>
      <div className="job-side">
        {job.fit ? <FitRing score={job.fit} /> : <div style={{ width: 46 }} />}
        <div className="job-actions" onClick={e => e.stopPropagation()}>
          {!isApplied ? (
            <button className="btn btn-primary btn-sm" onClick={() => onApply(job.id)}>
              <I.check size={14} /> Apply
            </button>
          ) : (
            <span className="btn btn-sm" style={{ color: 'var(--green)', borderColor: 'rgba(95,217,138,0.3)' }}>
              <I.check size={14} /> Applied
            </span>
          )}
          <a className="btn btn-sm btn-icon" href={job.url} target="_blank" title="Open listing">
            <I.external size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard, FindJobs, JobCard });
