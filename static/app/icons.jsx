// ============================ ICONS (line, 24px viewBox) ============================
const Ic = ({ d, paths, size = 18, fill = 'none', sw = 2, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...p}>
    {paths ? paths.map((pp, i) => <path key={i} d={pp} />) : <path d={d} />}
  </svg>
);

const Icons = {
  dash:    (p) => <Ic paths={['M3 13h8V3H3zM13 21h8v-8h-8zM13 3v6h8V3zM3 21h8v-6H3z']} {...p} />,
  search:  (p) => <Ic paths={['M11 19a8 8 0 100-16 8 8 0 000 16z','M21 21l-4.3-4.3']} {...p} />,
  kanban:  (p) => <Ic paths={['M6 4v10','M12 4v16','M18 4v7','M3 4h18']} {...p} />,
  quality: (p) => <Ic paths={['M22 12A10 10 0 112 12a10 10 0 0120 0z','M8 12l3 3 5-6']} {...p} />,
  sources: (p) => <Ic paths={['M12 2a10 10 0 100 20 10 10 0 000-20z','M2 12h20','M12 2a15 15 0 010 20 15 15 0 010-20z']} {...p} />,
  bolt:    (p) => <Ic d="M13 2L3 14h8l-1 8 10-12h-8z" {...p} />,
  briefcase:(p)=> <Ic paths={['M20 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z','M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2']} {...p} />,
  check:   (p) => <Ic d="M20 6L9 17l-5-5" {...p} />,
  checkCircle:(p)=><Ic paths={['M22 11.08V12a10 10 0 11-5.93-9.14','M22 4L12 14.01l-3-3']} {...p} />,
  pin:     (p) => <Ic paths={['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z','M12 13a3 3 0 100-6 3 3 0 000 6z']} {...p} />,
  clock:   (p) => <Ic paths={['M12 22a10 10 0 100-20 10 10 0 000 20z','M12 6v6l4 2']} {...p} />,
  layers:  (p) => <Ic paths={['M12 2L2 7l10 5 10-5-10-5z','M2 17l10 5 10-5','M2 12l10 5 10-5']} {...p} />,
  rupee:   (p) => <Ic paths={['M6 3h12','M6 8h12','M6 13l8.5 8','M6 13h3a5 5 0 000-10']} {...p} />,
  trendUp: (p) => <Ic paths={['M23 6l-9.5 9.5-5-5L1 18','M17 6h6v6']} {...p} />,
  trendDown:(p)=> <Ic paths={['M23 18l-9.5-9.5-5 5L1 6','M17 18h6v-6']} {...p} />,
  external:(p) => <Ic paths={['M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6','M15 3h6v6','M10 14L21 3']} {...p} />,
  bookmark:(p) => <Ic d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" {...p} />,
  filter:  (p) => <Ic d="M22 3H2l8 9.46V19l4 2v-8.54z" {...p} />,
  grid:    (p) => <Ic paths={['M3 3h8v8H3z','M13 3h8v8h-8z','M3 13h8v8H3z','M13 13h8v8h-8z']} {...p} />,
  list:    (p) => <Ic paths={['M8 6h13','M8 12h13','M8 18h13','M3 6h.01','M3 12h.01','M3 18h.01']} {...p} />,
  close:   (p) => <Ic paths={['M18 6L6 18','M6 6l12 12']} {...p} />,
  menu:    (p) => <Ic paths={['M3 12h18','M3 6h18','M3 18h18']} {...p} />,
  refresh: (p) => <Ic paths={['M23 4v6h-6','M1 20v-6h6','M3.51 9a9 9 0 0114.85-3.36L23 10','M1 14l4.64 4.36A9 9 0 0020.49 15']} {...p} />,
  download:(p) => <Ic paths={['M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4','M7 10l5 5 5-5','M12 15V3']} {...p} />,
  copy:    (p) => <Ic paths={['M9 9h11v11H9z','M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1']} {...p} />,
  trash:   (p) => <Ic paths={['M3 6h18','M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2']} {...p} />,
  alert:   (p) => <Ic paths={['M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z','M12 9v4','M12 17h.01']} {...p} />,
  spark:   (p) => <Ic paths={['M12 3v3','M12 18v3','M5 12H2','M22 12h-3','M12 8a4 4 0 100 8 4 4 0 000-8z']} {...p} />,
  building:(p) => <Ic paths={['M3 21h18','M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16','M9 7h2','M13 7h2','M9 11h2','M13 11h2','M9 15h2','M13 15h2']} {...p} />,
  star:    (p) => <Ic d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" {...p} />,
  play:    (p) => <Ic d="M5 3l14 9-14 9z" fill="currentColor" sw={0} {...p} />,
  target:  (p) => <Ic paths={['M12 22a10 10 0 100-20 10 10 0 000 20z','M12 18a6 6 0 100-12 6 6 0 000 12z','M12 14a2 2 0 100-4 2 2 0 000 4z']} {...p} />,
  flame:   (p) => <Ic d="M12 2s4 4 4 8a4 4 0 01-8 0c0-1 .5-2 .5-2S6 11 6 14a6 6 0 0012 0c0-5-6-12-6-12z" {...p} />,
  report:  (p) => <Ic paths={['M3 3v18h18','M7 16l4-5 3 3 5-7','M18 7h2v2']} {...p} />,
  link:    (p) => <Ic paths={['M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1','M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1']} {...p} />,
  expand:  (p) => <Ic paths={['M15 3h6v6','M9 21H3v-6','M21 3l-7 7','M3 21l7-7']} {...p} />,
};

window.Icons = Icons;
