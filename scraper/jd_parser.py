"""
Shared JD parser used by all scrapers.
Extracts Qualifications, Requirements, and Skills from raw job description text.
"""

QUALIF_KW  = ('qualification', 'education', 'degree', 'academic', 'background', 'graduate')
REQ_KW     = ('requirement', 'looking for', 'we expect', 'must have', 'responsibility',
              'you will', 'role involves', 'duties', 'what you', 'job description')
SKILL_KW   = ('skill', 'technology', 'tool', 'technical', 'knowledge of',
              'proficiency', 'familiarity', 'expertise')


def parse_jd(text: str) -> str:
    """
    Given raw JD text, return a formatted summary with
    Qualifications, Requirements, and Skills Needed sections.
    Falls back to the first 500 characters if no sections are detected.
    """
    if not text or len(text.strip()) < 30:
        return ""

    text  = text[:4000]
    lines = [l.strip() for l in text.split('\n') if l.strip() and len(l.strip()) > 3]

    qual, req, skills = [], [], []
    current = None

    for line in lines:
        ll = line.lower()

        if any(k in ll for k in QUALIF_KW):
            current = 'qual'
            continue
        if any(k in ll for k in REQ_KW):
            current = 'req'
            continue
        if any(k in ll for k in SKILL_KW):
            current = 'skill'
            continue

        clean = line.lstrip('•●◦-–* ').strip()
        if not clean or len(clean) < 5:
            continue

        if current == 'qual'  and len(qual)   < 6: qual.append(clean)
        if current == 'req'   and len(req)    < 6: req.append(clean)
        if current == 'skill' and len(skills) < 8: skills.append(clean)

    parts = []
    if qual:   parts.append("Qualifications:\n"  + '\n'.join(f"• {q}" for q in qual))
    if req:    parts.append("Requirements:\n"     + '\n'.join(f"• {r}" for r in req))
    if skills: parts.append("Skills Needed:\n"   + '\n'.join(f"• {s}" for s in skills))

    return '\n\n'.join(parts) if parts else text[:500]
