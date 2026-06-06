// ============================ MOCK DATA ============================
// Job Market Pulse — representative scraped-data shape (Internshala + Naukri)

const JD = (role, skills) => `We are looking for a motivated ${role} to join our growing team. You will work closely with cross-functional stakeholders to ship high-impact work in a fast-paced environment.

Responsibilities:
You will own end-to-end delivery, partner with product and engineering, and translate ambiguous problems into measurable outcomes. Strong ownership and communication are essential.

Requirements:
${skills.map(s => `• Hands-on experience with ${s}`).join('\n')}
• Strong analytical and problem-solving ability
• Excellent written and verbal communication

Skills Needed:
${skills.join(', ')}

We offer a collaborative culture, mentorship, and rapid growth opportunities.`;

const RAW_JOBS = [
  { id: 1,  title: 'Data Analyst', company: 'Razorpay', location: 'Bengaluru', salary: '₹8–12 LPA', experience: '1–3 yr', skills: ['SQL','Python','Power BI','Excel'], source: 'Naukri', status: 'saved', fit: 92, postedDays: 1 },
  { id: 2,  title: 'Data Analyst Intern', company: 'Zomato', location: 'Work from Home', salary: '₹25k/mo', experience: 'Fresher', skills: ['SQL','Excel','Tableau'], source: 'Internshala', status: 'new', fit: 78, postedDays: 1 },
  { id: 3,  title: 'Business Analyst', company: 'Swiggy', location: 'Bengaluru', salary: '₹10–14 LPA', experience: '1–3 yr', skills: ['SQL','Looker','Stakeholder Mgmt'], source: 'Naukri', status: 'applied', fit: 85, postedDays: 2 },
  { id: 4,  title: 'SDE-1 (Backend)', company: 'CRED', location: 'Bengaluru', salary: '₹18–28 LPA', experience: '0–1 yr', skills: ['Java','Spring','PostgreSQL','AWS'], source: 'Naukri', status: 'interview', fit: 81, postedDays: 3 },
  { id: 5,  title: 'Frontend Developer', company: 'Groww', location: 'Bengaluru', salary: '₹12–20 LPA', experience: '1–3 yr', skills: ['React','TypeScript','CSS'], source: 'Naukri', status: 'new', fit: 88, postedDays: 2 },
  { id: 6,  title: 'Product Analyst Intern', company: 'Meesho', location: 'Bengaluru', salary: '₹30k/mo', experience: 'Fresher', skills: ['SQL','Python','A/B Testing'], source: 'Internshala', status: 'saved', fit: 74, postedDays: 4 },
  { id: 7,  title: 'Data Scientist', company: 'PhonePe', location: 'Pune', salary: '₹20–32 LPA', experience: '3–5 yr', skills: ['Python','ML','Spark','SQL'], source: 'Naukri', status: 'new', fit: 69, postedDays: 5 },
  { id: 8,  title: 'QA Engineer', company: 'Postman', location: 'Work from Home', salary: '₹9–15 LPA', experience: '1–3 yr', skills: ['Selenium','Cypress','API Testing'], source: 'Naukri', status: 'rejected', fit: 71, postedDays: 6 },
  { id: 9,  title: 'Business Analyst Intern', company: 'Unacademy', location: 'Bengaluru', salary: '₹20k/mo', experience: 'Fresher', skills: ['Excel','SQL','PowerPoint'], source: 'Internshala', status: 'applied', fit: 66, postedDays: 3 },
  { id: 10, title: 'Full Stack Developer', company: 'Zerodha', location: 'Bengaluru', salary: '₹15–25 LPA', experience: '1–3 yr', skills: ['Node.js','React','MongoDB'], source: 'Naukri', status: 'new', fit: 83, postedDays: 2 },
  { id: 11, title: 'Data Analyst', company: 'Flipkart', location: 'Bengaluru', salary: '₹9–16 LPA', experience: '1–3 yr', skills: ['SQL','Python','Tableau','GCP'], source: 'Naukri', status: 'interview', fit: 90, postedDays: 4 },
  { id: 12, title: 'ML Engineer Intern', company: 'Sarvam AI', location: 'Work from Home', salary: '₹40k/mo', experience: 'Fresher', skills: ['Python','PyTorch','NLP'], source: 'Internshala', status: 'saved', fit: 79, postedDays: 1 },
  { id: 13, title: 'Analytics Associate', company: 'Dream11', location: 'Mumbai', salary: '₹11–17 LPA', experience: '1–3 yr', skills: ['SQL','R','Statistics'], source: 'Naukri', status: 'new', fit: 76, postedDays: 7 },
  { id: 14, title: 'Backend Intern', company: 'Razorpay', location: 'Bengaluru', salary: '₹35k/mo', experience: 'Fresher', skills: ['Go','PostgreSQL','Redis'], source: 'Internshala', status: 'new', fit: 72, postedDays: 5 },
  { id: 15, title: 'Data Engineer', company: 'Hotstar', location: 'Bengaluru', salary: '₹22–34 LPA', experience: '3–5 yr', skills: ['Spark','Airflow','SQL','AWS'], source: 'Naukri', status: 'offer', fit: 87, postedDays: 8 },
  { id: 16, title: 'UI/UX Intern', company: 'Cult.fit', location: 'Work from Home', salary: '₹18k/mo', experience: 'Fresher', skills: ['Figma','Prototyping'], source: 'Internshala', status: 'rejected', fit: 61, postedDays: 9 },
];

// attach JD + scrape timestamps + url
const MOCK_JOBS = RAW_JOBS.map((j, i) => ({
  ...j,
  description: JD(j.title, j.skills),
  url: 'https://example.com/job/' + j.id,
  scraped_at: hoursAgo(j.postedDays * 24 - (i % 6) * 3),
}));

function hoursAgo(h) {
  const d = new Date(2026, 5, 4, 9, 12);
  d.setHours(d.getHours() - h);
  return d;
}
const NOW = new Date();
function toDate(d) { return d instanceof Date ? d : new Date(String(d).replace(' ', 'T')); }
function fmtDate(d) {
  d = toDate(d);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}
function relTime(d) {
  d = toDate(d);
  const diff = (NOW - d) / 3600000;
  if (diff < 1) return Math.max(1, Math.round(diff * 60)) + 'm ago';
  if (diff < 24) return Math.round(diff) + 'h ago';
  return Math.round(diff / 24) + 'd ago';
}

// daily scrape trend — last 14 days
const DAILY_TREND = [
  { date: 'May 22', count: 18 }, { date: 'May 23', count: 24 }, { date: 'May 24', count: 12 },
  { date: 'May 25', count: 31 }, { date: 'May 26', count: 27 }, { date: 'May 27', count: 41 },
  { date: 'May 28', count: 38 }, { date: 'May 29', count: 22 }, { date: 'May 30', count: 47 },
  { date: 'May 31', count: 52 }, { date: 'Jun 01', count: 44 }, { date: 'Jun 02', count: 58 },
  { date: 'Jun 03', count: 49 }, { date: 'Jun 04', count: 63 },
];

const BY_SOURCE = [
  { source: 'Naukri', count: 412, color: 'var(--naukri)' },
  { source: 'Internshala', count: 287, color: 'var(--internshala)' },
];

const TOP_ROLES = [
  { title: 'Data Analyst', count: 142 },
  { title: 'SDE / Backend', count: 118 },
  { title: 'Business Analyst', count: 96 },
  { title: 'Frontend Developer', count: 74 },
  { title: 'Data Scientist', count: 51 },
  { title: 'QA Engineer', count: 38 },
];

const ACTIVITY = [
  { type: 'scrape', text: 'Scraped <b>63 new jobs</b> from Naukri', time: '8 minutes ago' },
  { type: 'applied', text: 'Marked <b>Business Analyst @ Swiggy</b> as applied', time: '1 hour ago' },
  { type: 'interview', text: '<b>Flipkart</b> moved to Interview stage', time: '3 hours ago' },
  { type: 'dedupe', text: 'Removed <b>14 duplicate</b> listings', time: '5 hours ago' },
  { type: 'offer', text: 'Offer received from <b>Hotstar</b> 🎉', time: 'Yesterday' },
  { type: 'scrape', text: 'Scraped <b>49 new jobs</b> from Internshala', time: 'Yesterday' },
];

const SOURCES = [
  { name: 'Internshala', key: 'internshala', initials: 'IN', color: 'var(--internshala)', total: 287, lastRun: '8m ago', status: 'idle', health: 98, freq: 'Every 6 hours' },
  { name: 'Naukri', key: 'naukri', initials: 'Nk', color: 'var(--naukri)', total: 412, lastRun: 'running', status: 'running', health: 94, freq: 'Every 6 hours' },
];

const QUALITY = {
  total: 699,
  duplicates: 14,
  fields: [
    { name: 'Salary disclosed', sub: 'jobs with a parseable salary', pct: 71, color: 'var(--lime)' },
    { name: 'Location present', sub: 'non-empty location field', pct: 96, color: 'var(--cyan)' },
    { name: 'Experience tagged', sub: 'experience range extracted', pct: 88, color: 'var(--cyan)' },
    { name: 'Skills extracted', sub: 'at least one skill parsed', pct: 64, color: 'var(--amber)' },
    { name: 'Description (JD)', sub: 'full job description scraped', pct: 52, color: 'var(--amber)' },
    { name: 'Valid apply URL', sub: 'reachable external link', pct: 99, color: 'var(--lime)' },
  ],
};

const PIPELINE = [
  { key: 'saved',     name: 'Saved',     color: 'var(--text-faint)' },
  { key: 'applied',   name: 'Applied',   color: 'var(--cyan)' },
  { key: 'interview', name: 'Interview', color: 'var(--amber)' },
  { key: 'offer',     name: 'Offer',     color: 'var(--lime)' },
  { key: 'rejected',  name: 'Rejected',  color: 'var(--rose)' },
];

window.MockData = { MOCK_JOBS, DAILY_TREND, BY_SOURCE, TOP_ROLES, ACTIVITY, SOURCES, QUALITY, PIPELINE, fmtDate, relTime };
