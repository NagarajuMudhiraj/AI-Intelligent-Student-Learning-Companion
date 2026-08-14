import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import {
  Sparkles, Loader, Star, ChevronRight, RefreshCw,
  BookOpen, Award, Briefcase, TrendingUp, CheckCircle,
  XCircle, Code2, FileText, Users, DollarSign, Rocket, ChevronDown,
  GraduationCap, Layers, ArrowRight, Map, AlertCircle, Trash2
} from 'lucide-react';
import { API } from '../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface CareerPath {
  title: string; description: string; match_score: number;
  key_skills: string[]; next_steps: string[];
}
interface DocAnalysis { career_paths: CareerPath[]; summary: string; }

interface RoadmapPhase { title: string; duration: string; goal: string; tasks: string[]; }
interface Certification { name: string; provider: string; priority: string; }
interface Project { title: string; description: string; difficulty: string; }
interface SalaryRange { entry: string; mid: string; senior: string; currency_note: string; }
interface FullRoadmap {
  career_fit_score: number;
  recommended_career: string;
  why_match: string;
  skills_required: string[];
  missing_skills: string[];
  roadmap: Record<string, RoadmapPhase>;
  technologies: string[];
  certifications: Certification[];
  projects: Project[];
  internship_strategy: string;
  resume_tips: string[];
  interview_plan: string[];
  salary_range: SalaryRange;
  growth_opportunities: string[];
  career_field?: string;
  skill_level?: string;
  preferences?: string[];
}

interface ManualForm {
  career_field: string;
  skill_level: string;
  degree: string;
  branch: string;
  current_year: string;
  graduation_year: string;
  preferences: string[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const CAREER_FIELDS = [
  'AI Engineer', 'Machine Learning Engineer', 'Data Scientist', 'Data Engineer',
  'Software Developer', 'Full Stack Developer', 'Cloud Engineer',
  'Cyber Security Engineer', 'DevOps Engineer', 'Product Manager', 'Other'
];
const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const PREF_OPTIONS = ['High Salary', 'Research', 'Startup', 'MNC', 'Remote Work', 'Government Jobs'];
const CURRENT_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Postgraduate', 'Working Professional'];

const SAMPLE_PLANS: { emoji: string; title: string; form: Partial<ManualForm> }[] = [
  {
    emoji: '🤖', title: 'AI Engineer',
    form: { career_field: 'AI Engineer', skill_level: 'Intermediate', preferences: ['High Salary', 'Startup', 'Remote Work'] }
  },
  {
    emoji: '📊', title: 'Data Scientist',
    form: { career_field: 'Data Scientist', skill_level: 'Beginner', preferences: ['Research', 'MNC'] }
  },
  {
    emoji: '🌐', title: 'Full Stack Developer',
    form: { career_field: 'Full Stack Developer', skill_level: 'Intermediate', preferences: ['Startup', 'Remote Work', 'High Salary'] }
  },
  {
    emoji: '☁️', title: 'Cloud Engineer',
    form: { career_field: 'Cloud Engineer', skill_level: 'Beginner', preferences: ['MNC', 'High Salary'] }
  },
  {
    emoji: '🔐', title: 'Cyber Security',
    form: { career_field: 'Cyber Security Engineer', skill_level: 'Intermediate', preferences: ['Government Jobs', 'MNC'] }
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const matchColor = (score: number) => score >= 80 ? '#3aaa5c' : score >= 60 ? '#c9a84c' : '#b5473a';

const PHASE_COLORS = ['#b8943a', '#c9a84c', '#3aaa5c', '#5b8dee'];
const PHASE_KEYS = ['phase1', 'phase2', 'phase3', 'phase4'];

const diffColor = (d: string) => d === 'Beginner' ? '#3aaa5c' : d === 'Intermediate' ? '#c9a84c' : '#b5473a';
const priorityColor = (p: string) => p === 'High' ? '#b5473a' : p === 'Medium' ? '#c9a84c' : '#3aaa5c';

// ── Sub-components ───────────────────────────────────────────────────────────

const ScoreRing = ({ score }: { score: number }) => {
  const color = matchColor(score);
  return (
    <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        <circle cx={70} cy={70} r={58} fill="none" stroke="var(--bg-tertiary)" strokeWidth={14} />
        <circle
          cx={70} cy={70} r={58} fill="none" stroke={color} strokeWidth={14}
          strokeDasharray={`${(score / 100) * 364.4} 364.4`}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center'
      }}>
        <span style={{ fontSize: '2rem', fontWeight: 800, color, fontFamily: 'Playfair Display, serif' }}>{score}%</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Career Fit</span>
      </div>
    </div>
  );
};

const Tag = ({ label, color }: { label: string; color?: string }) => (
  <span style={{
    padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
    background: color ? `${color}18` : 'rgba(184,148,58,0.08)',
    border: `1px solid ${color ? color + '40' : 'rgba(184,148,58,0.25)'}`,
    color: color || 'var(--accent-deep)',
    display: 'inline-flex', alignItems: 'center', gap: '4px',
  }}>{label}</span>
);

const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
    <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(184,148,58,0.1)', border: '1px solid rgba(184,148,58,0.2)' }}>
      <Icon size={16} style={{ color: 'var(--accent-primary)', display: 'block' }} />
    </div>
    <h3 style={{ margin: 0, fontSize: '1rem', fontFamily: 'Playfair Display, serif', color: 'var(--text-primary)' }}>{title}</h3>
  </div>
);

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: 'rgba(255,253,247,0.96)', border: '1px solid var(--glass-border)',
    borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-sm)', ...style
  }}>
    {children}
  </div>
);

const AccordionSection = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, marginBottom: open ? '16px' : 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(184,148,58,0.1)', border: '1px solid rgba(184,148,58,0.2)' }}>
            <Icon size={16} style={{ color: 'var(--accent-primary)', display: 'block' }} />
          </div>
          <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
        </div>
        <ChevronDown size={16} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {open && children}
    </Card>
  );
};

// ── Roadmap Display ──────────────────────────────────────────────────────────

const RoadmapDisplay = ({ roadmap, onReset, onRefresh, refreshing }: { roadmap: FullRoadmap; onReset: () => void; onRefresh: () => void; refreshing: boolean }) => {
  const phases = PHASE_KEYS.map(k => ({ key: k, ...(roadmap.roadmap[k] || {}) })).filter(p => p.title);
  const [activePhase, setActivePhase] = useState(0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Hero: Score + Career + Why */}
      <div style={{
        background: 'rgba(255,253,247,0.96)', border: '1px solid var(--glass-border)',
        borderRadius: '20px', padding: '32px', boxShadow: 'var(--shadow-md)',
        display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '32px', alignItems: 'center'
      }}>
        <ScoreRing score={roadmap.career_fit_score} />
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
            <p style={{ fontSize: '12px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '6px' }}>
              Recommended Career
            </p>
            <span style={{
              padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
              background: 'rgba(58,170,92,0.12)', color: '#3aaa5c', border: '1px solid rgba(58,170,92,0.3)',
              display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'Inter, sans-serif'
            }}>
              ⚡ Cache Optimized
            </span>
          </div>
          <h2 style={{ fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', margin: '0 0 12px', fontFamily: 'Playfair Display, serif' }}>
            {roadmap.recommended_career}
          </h2>
          {roadmap.career_field && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <Tag label={roadmap.career_field} color="var(--accent-primary)" />
              {roadmap.skill_level && <Tag label={roadmap.skill_level} color="#5b8dee" />}
              {roadmap.preferences?.map(p => <Tag key={p} label={p} />)}
            </div>
          )}
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '14px', margin: 0 }}>
            {roadmap.why_match}
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              style={{
                background: 'rgba(184, 148, 58, 0.05)', border: '1px solid rgba(184, 148, 58, 0.3)',
                borderRadius: '10px', padding: '8px 16px', fontSize: '13px', cursor: refreshing ? 'not-allowed' : 'pointer',
                color: 'var(--accent-primary)', fontWeight: 600, fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.2s', width: 'fit-content'
              }}
              onMouseEnter={e => { if (!refreshing) (e.currentTarget as HTMLElement).style.background = 'rgba(184, 148, 58, 0.1)'; }}
              onMouseLeave={e => { if (!refreshing) (e.currentTarget as HTMLElement).style.background = 'rgba(184, 148, 58, 0.05)'; }}
            >
              {refreshing ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
              Refresh Career Plan
            </button>
            <button
              onClick={onReset}
              disabled={refreshing}
              style={{
                background: 'rgba(181, 71, 58, 0.05)', border: '1px solid rgba(181, 71, 58, 0.3)',
                borderRadius: '10px', padding: '8px 16px', fontSize: '13px', cursor: refreshing ? 'not-allowed' : 'pointer',
                color: '#b5473a', fontWeight: 600, fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.2s', width: 'fit-content'
              }}
              onMouseEnter={e => { if (!refreshing) (e.currentTarget as HTMLElement).style.background = 'rgba(181, 71, 58, 0.1)'; }}
              onMouseLeave={e => { if (!refreshing) (e.currentTarget as HTMLElement).style.background = 'rgba(181, 71, 58, 0.05)'; }}
            >
              <Trash2 size={13} /> Clear Career Plan
            </button>
          </div>
        </div>
      </div>

      {/* Skills */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Card>
          <SectionHeader icon={CheckCircle} title="Skills You Need" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {roadmap.skills_required.map(s => (
              <Tag key={s} label={s} color="#3aaa5c" />
            ))}
          </div>
        </Card>
        <Card>
          <SectionHeader icon={XCircle} title="Skills to Learn" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {roadmap.missing_skills.length > 0
              ? roadmap.missing_skills.map(s => <Tag key={s} label={s} color="#b5473a" />)
              : <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>None — you're well prepared! 🎉</p>
            }
          </div>
        </Card>
      </div>

      {/* Phase Timeline */}
      <Card>
        <SectionHeader icon={Map} title="Learning Roadmap" />
        {/* Phase selector tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {phases.map((phase, i) => (
            <button
              key={i}
              onClick={() => setActivePhase(i)}
              style={{
                padding: '8px 18px', borderRadius: '50px', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
                background: activePhase === i ? PHASE_COLORS[i] : 'rgba(255,253,247,0.6)',
                color: activePhase === i ? '#fff' : 'var(--text-secondary)',
                boxShadow: activePhase === i ? `0 4px 12px ${PHASE_COLORS[i]}40` : 'none',
                border: activePhase === i ? 'none' : `1px solid var(--glass-border)`,
              } as React.CSSProperties}
            >
              Phase {i + 1} · {phase.duration}
            </button>
          ))}
        </div>
        {/* Active phase detail */}
        {phases[activePhase] && (
          <div style={{
            background: `${PHASE_COLORS[activePhase]}08`,
            border: `1px solid ${PHASE_COLORS[activePhase]}30`,
            borderRadius: '12px', padding: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                background: PHASE_COLORS[activePhase], display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: '14px'
              }}>{activePhase + 1}</div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{phases[activePhase].title}</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{phases[activePhase].duration}</p>
              </div>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: '14px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              🎯 {phases[activePhase].goal}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(phases[activePhase].tasks || []).map((task, ti) => (
                <div key={ti} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                    background: PHASE_COLORS[activePhase], display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '10px', fontWeight: 700
                  }}>{ti + 1}</div>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{task}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Technologies */}
      <Card>
        <SectionHeader icon={Code2} title="Recommended Technologies" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {roadmap.technologies.map(t => (
            <span key={t} style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              background: 'rgba(91,141,238,0.1)', border: '1px solid rgba(91,141,238,0.25)', color: '#3c6cc9'
            }}>{t}</span>
          ))}
        </div>
      </Card>

      {/* Certifications + Projects */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Card>
          <SectionHeader icon={Award} title="Certifications" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {roadmap.certifications.map((cert, i) => (
              <div key={i} style={{
                padding: '12px 14px', borderRadius: '10px',
                background: 'rgba(255,253,247,0.6)', border: '1px solid var(--glass-border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{cert.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>{cert.provider}</p>
                </div>
                <span style={{
                  padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                  background: `${priorityColor(cert.priority)}18`, color: priorityColor(cert.priority)
                }}>{cert.priority}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SectionHeader icon={Layers} title="Recommended Projects" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {roadmap.projects.map((proj, i) => (
              <div key={i} style={{
                padding: '12px 14px', borderRadius: '10px',
                background: 'rgba(255,253,247,0.6)', border: '1px solid var(--glass-border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{proj.title}</p>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: diffColor(proj.difficulty), background: `${diffColor(proj.difficulty)}18`, padding: '2px 8px', borderRadius: '20px' }}>{proj.difficulty}</span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{proj.description}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Internship Strategy */}
      <AccordionSection icon={Briefcase} title="Internship Strategy">
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          {roadmap.internship_strategy}
        </p>
      </AccordionSection>

      {/* Resume Tips */}
      <AccordionSection icon={FileText} title="Resume Building Tips">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {roadmap.resume_tips.map((tip, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{
                width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '10px', fontWeight: 700
              }}>{i + 1}</div>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{tip}</p>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* Interview Plan */}
      <AccordionSection icon={Users} title="Interview Preparation Plan">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {roadmap.interview_plan.map((item, i) => (
            <div key={i} style={{
              padding: '10px 14px', borderRadius: '8px',
              background: 'rgba(184,148,58,0.05)', border: '1px solid rgba(184,148,58,0.12)',
              display: 'flex', alignItems: 'flex-start', gap: '10px'
            }}>
              <ArrowRight size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 3 }} />
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item}</p>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* Salary Range */}
      <Card>
        <SectionHeader icon={DollarSign} title="Expected Salary Range" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
          {[
            { label: 'Entry Level', value: roadmap.salary_range?.entry, color: '#3aaa5c' },
            { label: 'Mid Level', value: roadmap.salary_range?.mid, color: '#c9a84c' },
            { label: 'Senior Level', value: roadmap.salary_range?.senior, color: '#b8943a' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              padding: '14px', borderRadius: '10px', textAlign: 'center',
              background: `${color}10`, border: `1px solid ${color}30`
            }}>
              <p style={{ margin: '0 0 4px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</p>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color }}>{value}</p>
            </div>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          ℹ️ {roadmap.salary_range?.currency_note}
        </p>
      </Card>

      {/* Growth Opportunities */}
      <Card>
        <SectionHeader icon={Rocket} title="Future Growth Opportunities" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
          {roadmap.growth_opportunities.map((opp, i) => (
            <div key={i} style={{
              padding: '12px 14px', borderRadius: '10px',
              background: 'rgba(184,148,58,0.06)', border: '1px solid rgba(184,148,58,0.18)',
              display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <TrendingUp size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{opp}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ── Manual Form ──────────────────────────────────────────────────────────────

const EMPTY_FORM: ManualForm = {
  career_field: '', skill_level: '', degree: '', branch: '',
  current_year: '', graduation_year: '', preferences: [],
};

const ManualTab = ({ token }: { token: string | null }) => {
  const [form, setForm] = useState<ManualForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [roadmap, setRoadmap] = useState<FullRoadmap | null>(null);
  const [fetching, setFetching] = useState(true);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load saved roadmap on mount
  useEffect(() => {
    if (!token) { setFetching(false); return; }
    fetch(`${API}/career/manual-roadmap`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setRoadmap(data); })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [token]);

  const togglePref = (pref: string) =>
    setForm(f => ({
      ...f,
      preferences: f.preferences.includes(pref)
        ? f.preferences.filter(p => p !== pref)
        : [...f.preferences, pref]
    }));

  const applySample = (sample: typeof SAMPLE_PLANS[0]) =>
    setForm(f => ({ ...f, ...sample.form }));

  const generate = async () => {
    if (!form.career_field || !form.skill_level) {
      alert('Please select a Career Field and Skill Level before generating.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/career/manual-roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const e = await res.json(); alert(e.detail); return; }
      const data = await res.json();
      setRoadmap(data);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!roadmap || !token) return;
    setRefreshing(true);
    try {
      const formPayload = {
        career_field: roadmap.career_field || EMPTY_FORM.career_field,
        skill_level: roadmap.skill_level || EMPTY_FORM.skill_level,
        preferences: roadmap.preferences || EMPTY_FORM.preferences,
        degree: '',
        branch: '',
        current_year: '',
        graduation_year: ''
      };
      
      const res = await fetch(`${API}/career/manual-roadmap/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formPayload),
      });
      if (!res.ok) { const e = await res.json(); alert(e.detail); return; }
      const data = await res.json();
      setRoadmap(data);
      alert("Career roadmap regenerated and cache updated!");
    } catch (e) {
      console.error('Failed to refresh manual roadmap', e);
    } finally {
      setRefreshing(false);
    }
  };

  const performReset = async () => {
    setShowResetDialog(false);
    setLoading(true);
    try {
      await fetch(`${API}/career/manual-roadmap`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setForm(EMPTY_FORM);
      setRoadmap(null);
      localStorage.removeItem('manual_career_roadmap_cache');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <Loader size={32} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (roadmap) return (
    <>
      <RoadmapDisplay roadmap={roadmap} onReset={() => setShowResetDialog(true)} onRefresh={handleRefresh} refreshing={refreshing} />
      {showResetDialog && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'rgba(255,253,247,0.98)', border: '1px solid var(--glass-border)',
            borderRadius: '20px', padding: '32px', maxWidth: '440px', width: '90%',
            boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(181,71,58,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b5473a', flexShrink: 0
              }}>
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontFamily: 'Playfair Display, serif', color: 'var(--text-primary)' }}>
                  Reset Career Plan?
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  This will clear all selected options and generated career recommendations.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowResetDialog(false)}
                className="btn btn-secondary"
                style={{ padding: '10px 20px', fontSize: '13px', border: '1px solid var(--glass-border)', background: 'transparent', cursor: 'pointer', borderRadius: '8px' }}
              >
                Cancel
              </button>
              <button
                onClick={performReset}
                style={{
                  padding: '10px 20px', fontSize: '13px', borderRadius: '10px',
                  border: 'none', background: '#b5473a', color: '#fff', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(181,71,58,0.3)'
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#9e3b30'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#b5473a'; }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Empty State Banner */}
      <div style={{
        background: 'rgba(184,148,58,0.05)', border: '1px dashed rgba(184,148,58,0.3)',
        borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px',
        color: 'var(--text-secondary)', fontSize: '13.5px', fontWeight: 500
      }}>
        <Sparkles size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <span>Select your career preferences and generate a new AI career roadmap.</span>
      </div>

      {/* Sample Quick-Start Cards */}
      <div style={{
        background: 'rgba(255,253,247,0.96)', border: '1px solid var(--glass-border)',
        borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-sm)'
      }}>
        <p style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          ⚡ Quick Start — Sample Career Plans
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {SAMPLE_PLANS.map(sp => (
            <button
              key={sp.title}
              onClick={() => applySample(sp)}
              style={{
                padding: '10px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: 500,
                background: form.career_field === sp.form.career_field ? 'rgba(184,148,58,0.12)' : 'rgba(255,253,247,0.8)',
                border: form.career_field === sp.form.career_field ? '1.5px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                color: form.career_field === sp.form.career_field ? 'var(--accent-deep)' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.2s',
                fontFamily: 'Inter, sans-serif'
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-primary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = form.career_field === sp.form.career_field ? 'var(--accent-primary)' : 'var(--glass-border)'; }}
            >
              {sp.emoji} {sp.title}
            </button>
          ))}
        </div>
      </div>

      {/* Section 1: Career Field */}
      <div style={{
        background: 'rgba(255,253,247,0.96)', border: '1px solid var(--glass-border)',
        borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-sm)'
      }}>
        <p style={{ margin: '0 0 6px', fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
          1. Choose Your Career Goal
        </p>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)' }}>Select the career you want to pursue</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {CAREER_FIELDS.map(field => (
            <button
              key={field}
              onClick={() => setForm(f => ({ ...f, career_field: field }))}
              style={{
                padding: '10px 18px', borderRadius: '50px', fontSize: '13px', fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif',
                background: form.career_field === field
                  ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                  : 'rgba(255,253,247,0.8)',
                color: form.career_field === field ? '#fff' : 'var(--text-secondary)',
                boxShadow: form.career_field === field ? '0 4px 12px rgba(184,148,58,0.3)' : 'none',
                border: form.career_field === field ? 'none' : '1px solid var(--glass-border)',
              } as React.CSSProperties}
            >
              {field}
            </button>
          ))}
        </div>
      </div>

      {/* Section 2: Skill Level */}
      <div style={{
        background: 'rgba(255,253,247,0.96)', border: '1px solid var(--glass-border)',
        borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-sm)'
      }}>
        <p style={{ margin: '0 0 6px', fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
          2. Your Current Skill Level
        </p>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)' }}>Be honest — the roadmap will be tailored to you</p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {SKILL_LEVELS.map((level, i) => {
            const colors = ['#3aaa5c', '#c9a84c', '#b5473a'];
            const selected = form.skill_level === level;
            return (
              <button
                key={level}
                onClick={() => setForm(f => ({ ...f, skill_level: level }))}
                style={{
                  padding: '14px 28px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif',
                  background: selected ? `${colors[i]}18` : 'rgba(255,253,247,0.8)',
                  color: selected ? colors[i] : 'var(--text-secondary)',
                  border: selected ? `2px solid ${colors[i]}` : '1.5px solid var(--glass-border)',
                  boxShadow: selected ? `0 4px 12px ${colors[i]}30` : 'none',
                } as React.CSSProperties}
              >
                {['🌱', '🌿', '🚀'][i]} {level}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 3: Education */}
      <div style={{
        background: 'rgba(255,253,247,0.96)', border: '1px solid var(--glass-border)',
        borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-sm)'
      }}>
        <p style={{ margin: '0 0 6px', fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
          3. Education Information <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontWeight: 400 }}>(Optional)</span>
        </p>
        <p style={{ margin: '0 0 18px', fontSize: '13px', color: 'var(--text-muted)' }}>Helps personalize the timeline and advice</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          {[
            { label: 'Degree', key: 'degree', placeholder: 'e.g. B.Tech, BCA, MBA' },
            { label: 'Branch / Specialization', key: 'branch', placeholder: 'e.g. CSE, IT, ECE' },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{label}</label>
              <input
                type="text"
                placeholder={placeholder}
                value={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '1.5px solid var(--glass-border)', background: 'rgba(255,253,247,0.7)',
                  color: 'var(--text-primary)', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif',
                  boxSizing: 'border-box'
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent-primary)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--glass-border)'; }}
              />
            </div>
          ))}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Current Year</label>
            <select
              value={form.current_year}
              onChange={e => setForm(f => ({ ...f, current_year: e.target.value }))}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '10px',
                border: '1.5px solid var(--glass-border)', background: 'rgba(255,253,247,0.7)',
                color: 'var(--text-primary)', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif',
              }}
            >
              <option value="">Select Year</option>
              {CURRENT_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Graduation Year</label>
            <input
              type="text"
              placeholder="e.g. 2026"
              value={form.graduation_year}
              onChange={e => setForm(f => ({ ...f, graduation_year: e.target.value }))}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '10px',
                border: '1.5px solid var(--glass-border)', background: 'rgba(255,253,247,0.7)',
                color: 'var(--text-primary)', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent-primary)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--glass-border)'; }}
            />
          </div>
        </div>
      </div>

      {/* Section 4: Preferences */}
      <div style={{
        background: 'rgba(255,253,247,0.96)', border: '1px solid var(--glass-border)',
        borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-sm)'
      }}>
        <p style={{ margin: '0 0 6px', fontFamily: 'Playfair Display, serif', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
          4. Career Preferences
        </p>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)' }}>Select all that apply</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {PREF_OPTIONS.map(pref => {
            const selected = form.preferences.includes(pref);
            return (
              <button
                key={pref}
                onClick={() => togglePref(pref)}
                style={{
                  padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif',
                  background: selected ? 'rgba(184,148,58,0.1)' : 'rgba(255,253,247,0.6)',
                  color: selected ? 'var(--accent-deep)' : 'var(--text-secondary)',
                  border: selected ? '1.5px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                } as React.CSSProperties}
              >
                {selected ? '✓ ' : ''}{pref}
              </button>
            );
          })}
        </div>
      </div>

      {/* Buttons Row */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
        <button
          onClick={generate}
          disabled={loading || !form.career_field || !form.skill_level}
          className="btn btn-primary"
          style={{
            flex: 1, minWidth: '200px',
            padding: '18px 32px', fontSize: '16px', borderRadius: '16px',
            opacity: (!form.career_field || !form.skill_level) ? 0.6 : 1,
            gap: '12px', justifyContent: 'center',
          }}
        >
          {loading
            ? <><Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Generating your roadmap…</>
            : <><Sparkles size={18} /> Generate AI Career Roadmap</>
          }
        </button>
        
        <button
          onClick={() => setShowResetDialog(true)}
          disabled={loading}
          className="btn btn-secondary"
          style={{
            padding: '18px 32px', fontSize: '16px', borderRadius: '16px',
            borderColor: 'rgba(181, 71, 58, 0.3)', color: '#b5473a',
            background: 'rgba(181, 71, 58, 0.05)',
            gap: '8px', justifyContent: 'center', display: 'flex', alignItems: 'center',
            cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0, minWidth: '120px'
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(181, 71, 58, 0.1)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(181, 71, 58, 0.05)'; }}
        >
          Reset
        </button>
      </div>

      {(!form.career_field || !form.skill_level) && (
        <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', marginTop: '-8px' }}>
          Select a Career Field and Skill Level to continue
        </p>
      )}

      {showResetDialog && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'rgba(255,253,247,0.98)', border: '1px solid var(--glass-border)',
            borderRadius: '20px', padding: '32px', maxWidth: '440px', width: '90%',
            boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(181,71,58,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b5473a', flexShrink: 0
              }}>
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontFamily: 'Playfair Display, serif', color: 'var(--text-primary)' }}>
                  Reset Career Plan?
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  This will clear all selected options and generated career recommendations.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowResetDialog(false)}
                className="btn btn-secondary"
                style={{ padding: '10px 20px', fontSize: '13px', border: '1px solid var(--glass-border)', background: 'transparent', cursor: 'pointer', borderRadius: '8px' }}
              >
                Cancel
              </button>
              <button
                onClick={performReset}
                style={{
                  padding: '10px 20px', fontSize: '13px', borderRadius: '10px',
                  border: 'none', background: '#b5473a', color: '#fff', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(181,71,58,0.3)'
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#9e3b30'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#b5473a'; }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Document Analysis Tab (existing, preserved) ───────────────────────────────

const DocTab = ({ token }: { token: string | null }) => {
  const [analysis, setAnalysis] = useState<DocAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [selected, setSelected] = useState<CareerPath | null>(null);

  useEffect(() => {
    if (!token) { setFetching(false); return; }
    fetch(`${API}/career/roadmap`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAnalysis(data); })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [token]);

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/career/analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const e = await res.json(); alert(e.detail); return; }
      const data = await res.json();
      setAnalysis(data);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <Loader size={32} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={analyze} disabled={loading} className="btn btn-primary" style={{ gap: '10px' }}>
          {loading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : analysis ? <RefreshCw size={16} /> : <Sparkles size={16} />}
          {loading ? 'Analyzing…' : analysis ? 'Re-analyze' : 'Analyze My Career Fit'}
        </button>
      </div>

      {!analysis && !loading && (
        <div style={{
          background: 'rgba(255,253,247,0.96)', border: '1px solid var(--glass-border)',
          borderRadius: '20px', padding: '60px 32px', boxShadow: 'var(--shadow-sm)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', textAlign: 'center'
        }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(184,148,58,0.1)', border: '1px solid rgba(184,148,58,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={36} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Analyze From Documents</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '15px', maxWidth: '460px', margin: 0 }}>
              Upload study documents first, then click "Analyze My Career Fit" to get career suggestions based on what you're learning.
            </p>
          </div>
          <button onClick={analyze} className="btn btn-primary" style={{ gap: '10px' }}>
            <Sparkles size={16} /> Analyze My Career Fit
          </button>
        </div>
      )}

      {analysis && (
        <>
          <div style={{
            background: 'rgba(255,253,247,0.96)', border: '1px solid var(--glass-border)',
            borderRadius: '20px', padding: '24px 32px', boxShadow: 'var(--shadow-sm)',
            borderLeft: '4px solid var(--accent-primary)'
          }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your Profile Summary</p>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '15px', margin: 0 }}>{analysis.summary}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.4fr' : '1fr', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {analysis.career_paths.sort((a, b) => b.match_score - a.match_score).map((path, i) => {
                const color = matchColor(path.match_score);
                const isSelected = selected?.title === path.title;
                return (
                  <div
                    key={i}
                    onClick={() => setSelected(isSelected ? null : path)}
                    style={{
                      padding: '20px 24px', borderRadius: '16px', cursor: 'pointer',
                      background: isSelected ? 'rgba(255,253,247,0.99)' : 'rgba(255,253,247,0.92)',
                      border: `1.5px solid ${isSelected ? color + '60' : 'var(--glass-border)'}`,
                      borderLeft: `5px solid ${color}`,
                      boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                      transition: 'all 0.25s ease', display: 'flex', alignItems: 'center', gap: '16px',
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.transform = 'none'; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        {i === 0 && <Star size={14} fill={color} color={color} />}
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{path.title}</h3>
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path.description}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                      <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: `conic-gradient(${color} ${path.match_score * 3.6}deg, var(--bg-tertiary) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,253,247,0.98)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color }}>{path.match_score}%</span>
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: 'var(--text-muted)', transform: isSelected ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {selected && (
              <div style={{
                background: 'rgba(255,253,247,0.96)', border: '1px solid var(--glass-border)',
                borderRadius: '20px', padding: '28px', boxShadow: 'var(--shadow-md)',
                display: 'flex', flexDirection: 'column', gap: '24px',
                position: 'sticky', top: '0', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
              }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', margin: '0 0 8px', fontFamily: 'Playfair Display, serif' }}>{selected.title}</h2>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '14px', margin: 0 }}>{selected.description}</p>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Match Score</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: matchColor(selected.match_score) }}>{selected.match_score}%</span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${selected.match_score}%`, background: matchColor(selected.match_score), borderRadius: '4px', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Key Skills Needed</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selected.key_skills.map((skill, i) => <Tag key={i} label={skill} />)}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your Next Steps</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {selected.next_steps.map((step, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 700 }}>{i + 1}</div>
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const CareerPage = () => {
  const [activeTab, setActiveTab] = useState<'manual' | 'document'>('manual');
  const token = localStorage.getItem('token');

  const tabs = [
    { id: 'manual', label: '🗺️ Manual Career Planning', icon: GraduationCap },
    { id: 'document', label: '📄 Document Analysis', icon: BookOpen },
  ] as const;

  return (
    <div className="app-layout-container">
      <div className="bg-blob bg-blob-1" />
      <div className="bg-blob bg-blob-2" />
      <Sidebar />

      <div className="app-main-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Header */}
        <div style={{
          background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)', borderRadius: '20px',
          padding: '28px 32px', boxShadow: 'var(--shadow-sm)',
        }}>
          <p style={{ fontSize: '12px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '6px' }}>AI-Powered</p>
          <h1 style={{ fontSize: '1.8rem', margin: '0 0 8px' }}>Career <span className="gradient-text">Mentor</span></h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            Get a personalized career roadmap — manually plan your goals or let AI analyze your documents
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)', borderRadius: '16px',
          padding: '6px', boxShadow: 'var(--shadow-sm)',
          display: 'flex', gap: '4px',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
                cursor: 'pointer', border: 'none', transition: 'all 0.25s ease', fontFamily: 'Inter, sans-serif',
                background: activeTab === tab.id
                  ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                  : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                boxShadow: activeTab === tab.id ? '0 4px 14px rgba(184,148,58,0.3)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'manual'
          ? <ManualTab token={token} />
          : <DocTab token={token} />
        }
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default CareerPage;
