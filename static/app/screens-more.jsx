// ============================ APPLICATIONS · QUALITY · SOURCES · DRAWER ============================
const { useState: useS3, useEffect: useFx3 } = React;

// ---------------- APPLICATIONS KANBAN ----------------
function Applications({ jobs, onMove, onOpen }) {
  const { PIPELINE } = window.MockData;
  const I = window.Icons;
  const [dragId, setDragId] = useS3(null);
  const [over,   setOver]   = useS3(null);

  const tracked = jobs.filter(j => j.status !== 'new');
  const byCol   = k => tracked.filter(j => j.status === k);

  const drop = (k) => {
    if (dragId != null) onMove(dragId, k);
    setDragId(null);
    setOver(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="section-eyebrow" style={{ margin: 0 }}>Application Pipeline</div>
        <span className="result-count" style={{ marginLeft: 'auto' }}>
          Drag cards between stages · <b>{tracked.length}</b> tracked
        </span>
      </div>
      <div className="kanban">
        {PIPELINE.map(col => {
          const items = byCol(col.key);
          return (
            <div key={col.key}
                 className={`kan-col ${over === col.key ? 'drop-target' : ''}`}
                 onDragOver={e => { e.preventDefault(); setOver(col.key); }}
                 onDragLeave={() => setOver(o => o === col.key ? null : o)}
                 onDrop={() => drop(col.key)}>
              <div className="kan-col-head">
                <span className="swatch" style={{ background: col.color }} />
                <span className="name">{col.name}</span>
                <span className="count">{items.length}</span>
              </div>
              <div className="kan-cards">
                {items.map(j => (
                  <div key={j.id}
                       className={`kan-card ${dragId === j.id ? 'dragging' : ''}`}
                       draggable
                       onDragStart={() => setDragId(j.id)}
                       onDragEnd={()  => { setDragId(null); setOver(null); }}
                       onClick={() => onOpen(j)}>
                    <div className="kc-title">{j.title}</div>
                    <div className="kc-co">{j.company}</div>
                    <div className="kc-foot">
                      <span className="kc-sal">{j.salary}</span>
                      <SourceBadge source={j.source} />
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div style={{
                    padding: '18px 8px', textAlign: 'center',
                    fontFamily: 'var(--mono)', fontSize: '0.66rem',
                    color: 'var(--text-ghost)',
                    border: '1px dashed var(--border-soft)', borderRadius: 8,
                  }}>drop here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- DATA QUALITY ----------------
function DataQuality({ onToast, apiStatus }) {
  const I = window.Icons;

  // Seed from static; overwritten when API responds
  const [quality,  setQuality]  = useS3(window.RealData.analytics.quality);
  const [dupes,    setDupes]    = useS3(window.RealData.analytics.quality.duplicates);
  const [loading,  setLoading]  = useS3(apiStatus === 'live');
  const [deduping, setDeduping] = useS3(false);

  // Load live quality report
  useFx3(() => {
    if (apiStatus !== 'live') return;
    setLoading(true);
    window.API.qualityReport()
      .then(res => {
        if (res.status === 'success' && res.report) {
          const merged = window.API.mergeQuality(res.report, window.RealData.analytics.quality);
          setQuality(merged);
          setDupes(merged.duplicates);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiStatus]);

  const dedupe = () => {
    setDeduping(true);
    if (apiStatus === 'live') {
      window.API.deduplicate()
        .then(res => {
          setDeduping(false);
          if (res.status === 'success') {
            const deleted = res.deleted != null ? res.deleted : dupes;
            setDupes(0);
            onToast(`Removed ${deleted} duplicate listings`);
          } else {
            onToast('Dedup finished — nothing to remove');
          }
        })
        .catch(() => {
          setDeduping(false);
          onToast('Dedup failed — check server connection');
        });
    } else {
      setTimeout(() => {
        setDeduping(false);
        setDupes(0);
        onToast(`Removed ${dupes} duplicate listings`);
      }, 1100);
    }
  };

  const overall = Math.round(quality.fields.reduce((a, f) => a + f.pct, 0) / quality.fields.length);

  return (
    <div className="stack">
      {/* top KPI row */}
      <div className="grid-2">
        <div className="card card-pad">
          <div className="kpi-label"><I.quality /> Overall Completeness</div>
          {loading ? (
            <div className="kpi-value" style={{ color: 'var(--text-faint)' }}>
              <I.refresh size={22} className="spin" />
            </div>
          ) : (
            <div className="kpi-value" style={{ color: 'var(--lime)' }}>
              {overall}<span className="unit">%</span>
            </div>
          )}
          <div className="qbar-track" style={{ marginTop: 14 }}>
            <div className="qbar-fill" style={{ width: `${overall}%`, background: 'var(--lime)' }} />
          </div>
          <div className="kpi-foot" style={{ marginTop: 12 }}>
            Across {quality.total.toLocaleString('en-IN')} records from 2 sources
            {apiStatus === 'live' && !loading && (
              <span className="badge" style={{
                marginLeft: 8, color: 'var(--lime)',
                borderColor: 'color-mix(in srgb, var(--lime) 30%, transparent)',
              }}>
                <span className="dot live" style={{ width: 5, height: 5 }} /> Live
              </span>
            )}
          </div>
        </div>

        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="kpi-label"><I.copy /> Duplicate Records</div>
          {loading ? (
            <div className="kpi-value" style={{ color: 'var(--text-faint)' }}>
              <I.refresh size={22} className="spin" />
            </div>
          ) : (
            <div className="kpi-value" style={{ color: dupes > 0 ? 'var(--amber)' : 'var(--green)' }}>
              {dupes}
            </div>
          )}
          <div className="kpi-foot" style={{ marginTop: 12 }}>
            {dupes > 0
              ? 'Matched by URL, then title + company'
              : 'No URL duplicates — database is clean ✓'}
          </div>
          <button className="btn btn-primary btn-sm"
                  style={{ marginTop: 'auto', alignSelf: 'flex-start' }}
                  disabled={dupes === 0 || deduping || loading}
                  onClick={dedupe}>
            {deduping
              ? <><I.refresh size={14} className="spin" /> Deduplicating…</>
              : <><I.trash size={14} /> Run dedup</>}
          </button>
        </div>
      </div>

      {/* field completeness table */}
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Field Completeness</h3>
            <div className="sub">share of records with each field populated</div>
          </div>
          <button className="btn btn-sm btn-ghost"
                  onClick={() => window.API.exportCSV()}
                  title="Export all jobs as CSV">
            <I.download size={14} /> Export CSV
          </button>
        </div>
        {quality.fields.map((f, i) => (
          <div className="q-row" key={i}>
            <div className="q-top">
              <div className="q-name">{f.name}<div className="sub">{f.sub}</div></div>
              <div className="q-pct" style={{ color: f.color }}>{f.pct}%</div>
            </div>
            <div className="qbar-track">
              <div className="qbar-fill" style={{ width: `${f.pct}%`, background: f.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- SOURCES ----------------
function Sources({ onToast, apiStatus, onRefresh }) {
  const meta   = window.MockData.SOURCES;
  const bySrc  = Object.fromEntries(
    window.RealData.analytics.bySource.map(s => [s.source, s.count])
  );
  const SOURCES = meta.map(s => ({
    ...s,
    total: bySrc[s.name] != null ? bySrc[s.name] : s.total,
  }));
  const I = window.Icons;

  // per-source running state
  const [running,    setRunning]    = useS3({});
  const [pollTimers, setPollTimers] = useS3({});

  // Poll scrape-status for a given source key until it stops running
  const pollSource = (key, name) => {
    const timer = setInterval(async () => {
      if (apiStatus !== 'live') { clearInterval(timer); return; }
      try {
        const status = await window.API.scrapeStatus();
        const srcStatus = status[name]; // e.g. 'running' | 'done' | 'error: ...'
        if (srcStatus !== 'running') {
          clearInterval(timer);
          setRunning(r => ({ ...r, [key]: false }));
          if (srcStatus && String(srcStatus).startsWith('error')) {
            onToast(`${name} scrape error: ${String(srcStatus).replace('error: ', '')}`);
          } else {
            onToast(`${name} scrape complete`);
            if (onRefresh) onRefresh();
          }
        }
      } catch (_) {
        clearInterval(timer);
        setRunning(r => ({ ...r, [key]: false }));
      }
    }, 1500);
    return timer;
  };

  const scrape = async (key, name) => {
    if (apiStatus !== 'live') {
      // Simulate
      setRunning(r => ({ ...r, [key]: true }));
      onToast(`Scraping ${name}…`);
      setTimeout(() => {
        setRunning(r => ({ ...r, [key]: false }));
        onToast(`${name} scrape complete · 12 new jobs`);
      }, 2200);
      return;
    }

    setRunning(r => ({ ...r, [key]: true }));
    onToast(`Scraping ${name}…`);
    try {
      await window.API.scrape(name);
      const timer = pollSource(key, name);
      setPollTimers(t => ({ ...t, [key]: timer }));
    } catch (_) {
      setRunning(r => ({ ...r, [key]: false }));
      onToast(`Failed to start ${name} scrape — check server`);
    }
  };

  const scrapeAll = async () => {
    for (const s of SOURCES) {
      await scrape(s.key, s.name);
    }
  };

  return (
    <div className="stack">
      {/* source rows */}
      <div className="card">
        <div className="card-head">
          <div>
            <h3>Scraper Sources</h3>
            <div className="sub">configured job boards</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-ghost"
                    onClick={() => window.API.exportCSV()}
                    title="Download full dataset as CSV">
              <I.download size={14} /> Export CSV
            </button>
            <button className="btn btn-primary btn-sm" onClick={scrapeAll}>
              <I.bolt size={14} /> Scrape all
            </button>
          </div>
        </div>

        {SOURCES.map(s => {
          const isRunning = running[s.key] || s.status === 'running';
          return (
            <div className="source-row" key={s.key}>
              <div className="source-logo"
                   style={{
                     background: `color-mix(in srgb, ${s.color} 18%, var(--surface-3))`,
                     color: s.color,
                   }}>
                {s.initials}
              </div>
              <div className="source-info">
                <div className="sn">{s.name}</div>
                <div className="sm">{s.total.toLocaleString('en-IN')} jobs · {s.freq}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="scrape-status" style={{ justifyContent: 'flex-end' }}>
                  <span className={`dot ${isRunning ? 'amber live' : ''}`} />
                  {isRunning ? 'running' : 'idle'}
                </div>
                <div className="last-run" style={{ marginTop: 4 }}>health {s.health}%</div>
              </div>
              <button className="btn btn-sm"
                      disabled={isRunning}
                      onClick={() => scrape(s.key, s.name)}>
                {isRunning
                  ? <><I.refresh size={14} className="spin" /> Running</>
                  : <><I.play size={13} /> Scrape</>}
              </button>
            </div>
          );
        })}

        {/* API offline notice */}
        {apiStatus === 'offline' && (
          <div style={{
            margin: '4px 0 2px',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid rgba(242,184,79,0.25)',
            background: 'rgba(242,184,79,0.06)',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <I.alert size={15} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              Flask server not detected — scrape buttons run in simulation mode.
              Start the server on <span style={{ color: 'var(--lime)', fontFamily: 'var(--mono)' }}>localhost:5000</span> to go live.
            </span>
          </div>
        )}
      </div>

      {/* config card */}
      <div className="card card-pad">
        <div className="section-eyebrow" style={{ marginBottom: 16 }}>Scrape Configuration</div>
        <div className="grid-2">
          <div className="field">
            <label className="field-label">Default role to track</label>
            <select className="select">
              <option>Data Analyst</option>
              <option>SDE / Backend</option>
              <option>Business Analyst</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Schedule</label>
            <select className="select">
              <option>Every 6 hours</option>
              <option>Every 12 hours</option>
              <option>Daily</option>
              <option>Manual only</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Max jobs per run</label>
            <select className="select">
              <option>10</option>
              <option>25</option>
              <option>50</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Auto-deduplicate</label>
            <select className="select">
              <option>On (recommended)</option>
              <option>Off</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- JOB DETAIL DRAWER ----------------
function JobDrawer({ job, onClose, onApply }) {
  const I = window.Icons;
  if (!job) return null;
  const isApplied = ['applied', 'interview', 'offer', 'rejected'].includes(job.status);
  const hasJD     = job.description && job.description.trim().length > 10;
  const fmt       = hasJD
    ? job.description.replace(/(Responsibilities:|Requirements:|Skills Needed:)/g, '<strong>$1</strong>')
    : '';

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <SourceBadge source={job.source} />
              <span className="badge">
                <I.clock size={11} /> {window.MockData.relTime(job.scraped_at)}
              </span>
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 600, letterSpacing: '-0.015em' }}>
              {job.title}
            </h2>
            <div style={{ color: 'var(--text-dim)', marginTop: 4 }}>{job.company}</div>
          </div>
          {job.fit ? <FitRing score={job.fit} size={54} /> : null}
          <button className="btn btn-icon btn-ghost" onClick={onClose}>
            <I.close size={16} />
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-section">
            <div className="kv-grid">
              <div className="kv"><div className="k">Location</div>  <div className="v">{job.location}</div></div>
              <div className="kv"><div className="k">Experience</div><div className="v">{job.experience}</div></div>
              <div className="kv"><div className="k">Salary</div>    <div className="v lime">{job.salary}</div></div>
              <div className="kv"><div className="k">Stage</div>
                <div className="v" style={{ textTransform: 'capitalize' }}>
                  {job.status === 'new' ? 'Not tracked' : job.status}
                </div>
              </div>
            </div>
          </div>

          <div className="drawer-section">
            <h4>Skills</h4>
            {job.skills && job.skills.length ? (
              <div className="skill-row" style={{ marginTop: 0 }}>
                {job.skills.map((s, i) => <span className="chip" key={i}>{s}</span>)}
              </div>
            ) : (
              <div className="last-run">No skills parsed for this listing.</div>
            )}
          </div>

          <div className="drawer-section">
            <h4>Job Description</h4>
            {hasJD ? (
              <div className="jd-text" dangerouslySetInnerHTML={{ __html: fmt }} />
            ) : (
              <div style={{
                padding: '16px 18px', borderRadius: 8,
                border: '1px dashed var(--border-glow)',
                color: 'var(--text-faint)', fontSize: '0.84rem', lineHeight: 1.6,
              }}>
                Full description wasn't captured for this listing — open the original posting to read it.
                <span style={{
                  display: 'block', marginTop: 6,
                  fontFamily: 'var(--mono)', fontSize: '0.7rem',
                }}>
                  Tip: enable JD scraping to raise description coverage.
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="drawer-foot">
          {!isApplied ? (
            <button className="btn btn-primary" style={{ flex: 1 }}
                    onClick={() => onApply(job.id)}>
              <I.check size={15} /> Mark as Applied
            </button>
          ) : (
            <span className="btn" style={{ flex: 1, color: 'var(--green)', borderColor: 'rgba(95,217,138,0.3)' }}>
              <I.check size={15} /> Applied
            </span>
          )}
          <a className="btn" href={job.url} target="_blank">
            <I.external size={15} /> Open listing
          </a>
        </div>
      </div>
    </>
  );
}

// ---------------- POWER BI REPORTS ----------------
function PowerBIReport({ onToast }) {
  const I = window.Icons;
  const KEY = 'mp_pbi_url';
  const [url,     setUrl]     = useS3(() => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } });
  const [draft,   setDraft]   = useS3('');
  const [loading, setLoading] = useS3(false);

  const extractSrc = (s) => {
    const m = s.match(/src=["']([^"']+)["']/i);
    return (m ? m[1] : s).trim();
  };

  const connect = () => {
    const src = extractSrc(draft);
    if (!/^https?:\/\//i.test(src)) { onToast('Paste a valid Power BI embed URL or <iframe> code'); return; }
    setLoading(true);
    setUrl(src);
    try { localStorage.setItem(KEY, src); } catch {}
    onToast('Power BI report connected');
    setTimeout(() => setLoading(false), 400);
  };

  const disconnect = () => {
    setUrl('');
    setDraft('');
    try { localStorage.removeItem(KEY); } catch {}
  };

  if (url) {
    return (
      <div className="stack">
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
          <span className="badge naukri"><span className="badge-dot" />Power BI</span>
          <span className="cell-mono" style={{
            fontSize: '0.74rem', color: 'var(--text-dim)', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>{url}</span>
          <a className="btn btn-sm btn-ghost" href={url} target="_blank"><I.expand size={14} /> Fullscreen</a>
          <button className="btn btn-sm btn-ghost" onClick={disconnect}><I.close size={14} /> Disconnect</button>
        </div>
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: 'var(--surface-2)' }}>
            <iframe title="Power BI report" src={url} allowFullScreen
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid-3">
      <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="card-head">
          <div><h3>Report Canvas</h3><div className="sub">live Power BI embed</div></div>
          <span className="chip"><span className="dot amber" style={{ width: 6, height: 6 }} /> not connected</span>
        </div>
        <div style={{
          flex: 1, minHeight: 360, display: 'grid', placeItems: 'center', padding: 32,
          backgroundImage: 'repeating-linear-gradient(135deg, var(--surface-2) 0 12px, transparent 12px 24px)',
        }}>
          <div className="empty" style={{ padding: 0 }}>
            <I.report />
            <p style={{ fontWeight: 600, color: 'var(--text)' }}>Power BI report renders here</p>
            <p style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', marginTop: 6 }}>
              paste your embed link to go live · 16:9 canvas
            </p>
          </div>
        </div>
      </div>

      <div className="stack">
        <div className="card card-pad">
          <div className="section-eyebrow" style={{ marginBottom: 14 }}>Connect a report</div>
          <label className="field-label">Publish-to-web URL or &lt;iframe&gt; code</label>
          <textarea className="select" rows={4} value={draft} onChange={e => setDraft(e.target.value)}
            placeholder="https://app.powerbi.com/view?r=…  — or paste the full <iframe> embed snippet"
            style={{
              resize: 'vertical', lineHeight: 1.5,
              fontFamily: 'var(--mono)', fontSize: '0.74rem',
              backgroundImage: 'none', padding: '11px 12px',
            }} />
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}
                  disabled={loading} onClick={connect}>
            {loading
              ? <><I.refresh size={14} className="spin" /> Connecting…</>
              : <><I.link size={14} /> Connect report</>}
          </button>
          <div className="last-run" style={{ marginTop: 10, lineHeight: 1.6 }}>
            Tip: paste either the bare URL or the entire embed code — we'll pull the{' '}
            <span style={{ color: 'var(--lime)' }}>src</span> out.
          </div>
        </div>

        <div className="card card-pad">
          <div className="section-eyebrow" style={{ marginBottom: 14 }}>How to get the link</div>
          <ol style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11 }}>
            {[
              ['01', 'Open your report in Power BI Service'],
              ['02', 'File ▸ Embed report ▸ Publish to web (public)'],
              ['03', 'Copy the generated link or <iframe> code'],
              ['04', 'Paste it here — refreshes via your data gateway'],
            ].map(([n, txt]) => (
              <li key={n} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--lime)', fontWeight: 600, marginTop: 1 }}>
                  {n}
                </span>
                <span style={{ fontSize: '0.84rem', color: 'var(--text-dim)' }}>{txt}</span>
              </li>
            ))}
          </ol>
          <div style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 8,
            border: '1px solid rgba(242,184,79,0.25)',
            background: 'rgba(242,184,79,0.06)',
            display: 'flex', gap: 9,
          }}>
            <I.alert size={15} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              Publish-to-web is <b style={{ color: 'var(--text)' }}>public</b> — fine for job-listing data, never for private records.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Applications, DataQuality, Sources, JobDrawer, PowerBIReport });
