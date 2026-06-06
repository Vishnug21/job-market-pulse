// ============================ CHARTS + UI PRIMITIVES ============================
const { useState, useRef, useEffect } = React;

// ---- Area / line chart (daily scrape trend) ----
function AreaChart({ data, height = 200, color = 'var(--lime)' }) {
  const [hover, setHover] = useState(null);
  const w = 760, h = height, padX = 8, padTop = 16, padBot = 28;
  const max = Math.max(...data.map(d => d.count)) * 1.12;
  const innerW = w - padX * 2;
  const innerH = h - padTop - padBot;
  const x = i => padX + (i / (data.length - 1)) * innerW;
  const y = v => padTop + innerH - (v / max) * innerH;

  const linePts = data.map((d, i) => `${x(i)},${y(d.count)}`).join(' ');
  const areaPts = `${x(0)},${padTop + innerH} ${linePts} ${x(data.length - 1)},${padTop + innerH}`;

  return (
    <div className="chart-wrap" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none"
           onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g, i) => (
          <line key={i} x1={padX} x2={w - padX} y1={padTop + innerH * g} y2={padTop + innerH * g}
                stroke="var(--border-soft)" strokeWidth="1" strokeDasharray="2 4" />
        ))}
        <polygon points={areaPts} fill="url(#areaGrad)" />
        <polyline points={linePts} fill="none" stroke={color} strokeWidth="2"
                  strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={i}>
            <rect x={x(i) - innerW / data.length / 2} y={0} width={innerW / data.length} height={h}
                  fill="transparent" onMouseEnter={() => setHover(i)} />
            <circle cx={x(i)} cy={y(d.count)} r={hover === i ? 4.5 : 0} fill={color}
                    stroke="var(--bg)" strokeWidth="2" />
            {i % 2 === 0 && (
              <text x={x(i)} y={h - 8} fontSize="10" fill="var(--text-faint)" textAnchor="middle"
                    fontFamily="var(--mono)">{d.date}</text>
            )}
          </g>
        ))}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={padTop} y2={padTop + innerH}
                stroke="var(--border-glow)" strokeWidth="1" />
        )}
      </svg>
      {hover !== null && (
        <div style={{
          position: 'absolute', left: `${(x(hover) / w) * 100}%`, top: 4,
          transform: 'translateX(-50%)', pointerEvents: 'none',
          background: 'var(--surface-3)', border: '1px solid var(--border-glow)',
          borderRadius: 6, padding: '5px 10px', fontFamily: 'var(--mono)', fontSize: '0.7rem',
          whiteSpace: 'nowrap', boxShadow: 'var(--shadow)'
        }}>
          <span style={{ color: 'var(--text-faint)' }}>{data[hover].date} · </span>
          <span style={{ color: 'var(--lime)', fontWeight: 600 }}>{data[hover].count} jobs</span>
        </div>
      )}
    </div>
  );
}

// ---- Donut ----
function Donut({ data, total }) {
  const size = 150, r = 58, sw = 18, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={sw} />
          {data.map((d, i) => {
            const frac = d.count / total;
            const dash = frac * c;
            const seg = (
              <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={d.color}
                      strokeWidth={sw} strokeDasharray={`${dash} ${c - dash}`}
                      strokeDashoffset={-offset} strokeLinecap="butt" />
            );
            offset += dash;
            return seg;
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div className="donut-center">
            <div className="big">{total}</div>
            <div className="lbl">Total</div>
          </div>
        </div>
      </div>
      <div className="legend" style={{ flexDirection: 'column', gap: 12, marginTop: 0 }}>
        {data.map((d, i) => (
          <div className="legend-item" key={i} style={{ fontSize: '0.78rem' }}>
            <span className="legend-swatch" style={{ background: d.color, width: 11, height: 11 }} />
            <span style={{ color: 'var(--text)', minWidth: 86 }}>{d.source}</span>
            <span style={{ color: 'var(--text-faint)' }}>{d.count} · {Math.round(d.count/total*100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Horizontal bar list ----
function BarList({ data, valueKey = 'count', nameKey = 'title', color = 'var(--lime)' }) {
  const max = Math.max(...data.map(d => d[valueKey]));
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);
  return (
    <div className="barlist">
      {data.map((d, i) => (
        <div className="barlist-row" key={i}>
          <div className="barlist-top">
            <span className="barlist-name">{d[nameKey]}</span>
            <span className="barlist-val">{d[valueKey]}</span>
          </div>
          <div className="barlist-track">
            <div className="barlist-fill" style={{
              width: mounted ? `${(d[valueKey] / max) * 100}%` : '0%',
              background: color, transitionDelay: `${i * 60}ms`
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Fit-score ring ----
function FitRing({ score, size = 46 }) {
  const r = size / 2 - 4, c = 2 * Math.PI * r;
  const col = score >= 85 ? 'var(--lime)' : score >= 70 ? 'var(--cyan)' : 'var(--amber)';
  return (
    <div className="fit">
      <div className="fit-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="4" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="4"
                  strokeLinecap="round" strokeDasharray={`${(score/100)*c} ${c}`} />
        </svg>
        <div className="fit-num" style={{ color: col }}>{score}</div>
      </div>
      <div className="fit-label">fit</div>
    </div>
  );
}

// ---- small building-block components ----
function SourceBadge({ source }) {
  const cls = source.toLowerCase();
  return <span className={`badge ${cls}`}><span className="badge-dot" />{source}</span>;
}

function MetaPill({ icon, children, variant }) {
  const I = icon;
  return <span className={`meta-pill ${variant || ''}`}>{I && <I />}{children}</span>;
}

Object.assign(window, { AreaChart, Donut, BarList, FitRing, SourceBadge, MetaPill });
