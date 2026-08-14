import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { TrendingUp, FileText, Target, Layers, CheckCircle, Loader, Zap, Sparkles, Cpu, Award } from 'lucide-react';
import { API } from '../lib/api';


interface QuizScore { date: string; score: number; total: number; percentage: number; }
interface Summary {
  total_documents: number;
  total_quizzes: number;
  avg_quiz_score: number;
  total_tasks: number;
  completed_tasks: number;
  flashcard_decks: number;
  recent_quiz_scores: QuizScore[];
}

interface CacheStats {
  total_tokens_before: number;
  total_tokens_after: number;
  total_tokens_saved: number;
  savings_percentage: number;
  total_requests: number;
  cache_hits: number;
  cache_misses: number;
  hit_rate: number;
  miss_rate: number;
  daily_logs: { date: string; before: number; after: number; saved: number }[];
}

// Inline SVG Bar Chart for Quiz Scores
const BarChart = ({ data }: { data: QuizScore[] }) => {
  if (!data.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontSize: '14px' }}>
      No quiz data yet
    </div>
  );

  const max = 100;
  const chartH = 180;
  const barW = Math.min(40, (500 / data.length) - 12);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${Math.max(500, data.length * 56)} ${chartH + 40}`} preserveAspectRatio="xMinYMin meet">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(pct => {
          const y = chartH - (pct / max) * chartH;
          return (
            <g key={pct}>
              <line x1={0} y1={y} x2="100%" y2={y} stroke="rgba(184,148,58,0.12)" strokeWidth={1} strokeDasharray={pct === 0 ? 'none' : '4,4'} />
              <text x={2} y={y - 4} fill="rgba(107,94,74,0.6)" fontSize={10}>{pct}%</text>
            </g>
          );
        })}
        {/* Bars */}
        {data.slice().reverse().map((item, i) => {
          const barH = (item.percentage / max) * chartH;
          const x = i * (barW + 12) + 40;
          const y = chartH - barH;
          const color = item.percentage >= 80 ? '#3aaa5c' : item.percentage >= 60 ? '#c9a84c' : '#b5473a';
          return (
            <g key={i}>
              <defs>
                <linearGradient id={`bar-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.9" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.5" />
                </linearGradient>
              </defs>
              <rect x={x} y={y} width={barW} height={barH} rx={6} fill={`url(#bar-${i})`} />
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fill={color} fontSize={11} fontWeight={600}>{item.percentage}%</text>
              <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" fill="rgba(107,94,74,0.7)" fontSize={10}>{item.date}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// Double-Bar SVG Chart for Token Usage Comparison (Before vs After Caching)
const CacheBarChart = ({ data }: { data: CacheStats['daily_logs'] }) => {
  if (!data || !data.length || (data.length === 1 && data[0].before === 0)) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px', color: 'var(--text-muted)', fontSize: '14px' }}>
      No LLM request logs tracked yet
    </div>
  );

  const chartH = 180;
  const max = Math.max(...data.map(d => Math.max(d.before, d.after, 100)));
  const barW = Math.min(22, (440 / (data.length * 2)) - 8);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${Math.max(500, data.length * 68)} ${chartH + 40}`} preserveAspectRatio="xMinYMin meet">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1.0].map((pct, idx) => {
          const val = Math.round(pct * max);
          const y = chartH - pct * chartH;
          return (
            <g key={idx}>
              <line x1={0} y1={y} x2="100%" y2={y} stroke="rgba(184,148,58,0.1)" strokeWidth={1} strokeDasharray="4,4" />
              <text x={2} y={y - 4} fill="rgba(107,94,74,0.6)" fontSize={9}>{val} t</text>
            </g>
          );
        })}
        {/* Bars */}
        {data.map((item, i) => {
          const hBefore = (item.before / max) * chartH;
          const hAfter = (item.after / max) * chartH;
          const x = i * (barW * 2 + 22) + 40;
          const yBefore = chartH - hBefore;
          const yAfter = chartH - hAfter;

          return (
            <g key={i}>
              {/* Before bar (Grey/Brown) */}
              <rect x={x} y={yBefore} width={barW} height={hBefore} rx={4} fill="#c9bca7" opacity="0.55" />
              <text x={x + barW / 2} y={yBefore - 5} textAnchor="middle" fill="#8c775a" fontSize={9} fontWeight={500}>{item.before}</text>
              
              {/* After bar (Accent/Green) */}
              <rect x={x + barW + 4} y={yAfter} width={barW} height={hAfter} rx={4} fill="#3aaa5c" />
              <text x={x + barW * 1.5 + 4} y={yAfter - 5} textAnchor="middle" fill="#3aaa5c" fontSize={9} fontWeight={600}>{item.after}</text>

              {/* Date label */}
              <text x={x + barW + 2} y={chartH + 16} textAnchor="middle" fill="rgba(107,94,74,0.7)" fontSize={10}>{item.date}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const AnalyticsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'cache'>('overview');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [subjectPerformance, setSubjectPerformance] = useState<{ topic: string; correct: number; total: number; accuracy: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [cacheLoading, setCacheLoading] = useState(true);
  const [subjectLoading, setSubjectLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    
    // Fetch General Summary
    fetch(`${API}/analytics/summary`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false));

    // Fetch Cache Performance Stats
    fetch(`${API}/analytics/cache-stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setCacheStats)
      .catch(() => {})
      .finally(() => setCacheLoading(false));

    // Fetch Subject Performance Stats
    fetch(`${API}/analytics/subject-performance`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setSubjectPerformance)
      .catch(() => {})
      .finally(() => setSubjectLoading(false));
  }, []);

  const stats = summary ? [
    { icon: FileText,    label: 'Documents',        value: summary.total_documents,  color: '#b8943a' },
    { icon: Target,      label: 'Quizzes Taken',     value: summary.total_quizzes,    color: '#c9a84c' },
    { icon: Layers,      label: 'Flashcard Decks',   value: summary.flashcard_decks,  color: '#a07828' },
    { icon: CheckCircle, label: 'Tasks Completed',   value: `${summary.completed_tasks}/${summary.total_tasks}`, color: '#3aaa5c' },
  ] : [];

  const cacheStatsKPIs = cacheStats ? [
    { icon: Zap,       label: 'Token Savings (%)',   value: `${cacheStats.savings_percentage}%`, color: '#3aaa5c', desc: 'Avg token reduction rate' },
    { icon: Sparkles,  label: 'Total Tokens Saved', value: cacheStats.total_tokens_saved.toLocaleString(), color: '#c9a84c', desc: 'Cumulative saved tokens' },
    { icon: Cpu,       label: 'Cache Hit Rate',     value: `${cacheStats.hit_rate}%`, color: '#5b8dee', desc: 'Queries answered from cache' },
    { icon: Award,     desc: 'Hits / Total API requests', label: 'Cache Hits vs Misses', value: `${cacheStats.cache_hits} / ${cacheStats.total_requests}`, color: '#b8943a' }
  ] : [];

  return (
    <div className="app-layout-container">
      <div className="bg-blob bg-blob-1" />
      <div className="bg-blob bg-blob-2" />
      <Sidebar />

      <div className="app-main-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header */}
        <div style={{ background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '20px 24px', boxShadow: 'var(--shadow-sm)' }}>
          <p style={{ fontSize: '12px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '6px' }}>Insights</p>
          <h1 style={{ fontSize: '1.8rem', margin: 0 }}>Learning & <span className="gradient-text">Performance</span></h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>Track your study habits and LLM resource efficiency</p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)', borderRadius: '16px',
          padding: '6px', boxShadow: 'var(--shadow-sm)',
          display: 'flex', gap: '4px',
        }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              flex: 1, padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 0.25s ease', fontFamily: 'Inter, sans-serif',
              background: activeTab === 'overview'
                ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                : 'transparent',
              color: activeTab === 'overview' ? '#fff' : 'var(--text-secondary)',
              boxShadow: activeTab === 'overview' ? '0 4px 14px rgba(184,148,58,0.3)' : 'none',
            }}
          >
            📊 Learning Overview
          </button>
          <button
            onClick={() => setActiveTab('cache')}
            style={{
              flex: 1, padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 0.25s ease', fontFamily: 'Inter, sans-serif',
              background: activeTab === 'cache'
                ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                : 'transparent',
              color: activeTab === 'cache' ? '#fff' : 'var(--text-secondary)',
              boxShadow: activeTab === 'cache' ? '0 4px 14px rgba(184,148,58,0.3)' : 'none',
            }}
          >
            ⚡ AI Cache & Optimization
          </button>
        </div>

        {/* ── Tabs Content ──────────────────────────────────────────────────────── */}
        {activeTab === 'overview' ? (
          loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <Loader size={36} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <>
              {/* KPI Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {stats.map(({ icon: Icon, label, value, color }) => (
                  <div key={label} style={{
                    padding: '24px', borderRadius: '16px',
                    background: 'rgba(255,253,247,0.96)', border: `1px solid var(--glass-border)`,
                    borderLeft: `4px solid ${color}`, boxShadow: 'var(--shadow-sm)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, margin: 0 }}>{label}</p>
                      <div style={{ background: `${color}15`, padding: '8px', borderRadius: '10px', border: `1px solid ${color}25` }}>
                        <Icon size={18} style={{ color, display: 'block' }} />
                      </div>
                    </div>
                    <p style={{ fontSize: '2.4rem', fontWeight: 700, margin: 0, lineHeight: 1, fontFamily: 'Playfair Display, serif', color: 'var(--text-primary)' }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Charts Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                {/* Quiz Score Chart */}
                <div style={{ background: 'rgba(255,253,247,0.96)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                    <TrendingUp size={20} style={{ color: 'var(--accent-primary)' }} />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'Playfair Display, serif' }}>Recent Quiz Scores</h3>
                  </div>
                  <BarChart data={summary?.recent_quiz_scores || []} />
                </div>

                {/* Avg Score Gauge */}
                <div style={{ background: 'rgba(255,253,247,0.96)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '28px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'Playfair Display, serif' }}>Average Score</h3>
                  <div style={{
                    width: '140px', height: '140px', borderRadius: '50%',
                    background: `conic-gradient(var(--accent-primary) ${(summary?.avg_quiz_score || 0) * 3.6}deg, var(--bg-tertiary) 0deg)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 30px rgba(184,148,58,0.2)',
                  }}>
                    <div style={{ width: '108px', height: '108px', borderRadius: '50%', background: 'rgba(255,253,247,0.98)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text-primary)' }}>{summary?.avg_quiz_score || 0}%</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>avg score</span>
                    </div>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', margin: 0 }}>
                    Based on {summary?.total_quizzes || 0} quiz{summary?.total_quizzes !== 1 ? 'zes' : ''}
                  </p>
                </div>
              </div>

              {/* Task Progress */}
              {summary && summary.total_tasks > 0 && (
                <div style={{ background: 'rgba(255,253,247,0.96)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
                  <h3 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontFamily: 'Playfair Display, serif' }}>Task Completion</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ flex: 1, height: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.round((summary.completed_tasks / summary.total_tasks) * 100)}%`,
                        background: 'linear-gradient(90deg, #3aaa5c, #6bcf85)',
                        borderRadius: '6px', transition: 'width 0.6s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#3aaa5c', flexShrink: 0 }}>
                      {Math.round((summary.completed_tasks / summary.total_tasks) * 100)}% done
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '24px', marginTop: '12px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{summary.completed_tasks} completed</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{summary.total_tasks - summary.completed_tasks} remaining</span>
                  </div>
                </div>
              )}

              {/* Subject Performance Card */}
              <div style={{ background: 'rgba(255,253,247,0.96)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontFamily: 'Playfair Display, serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🎯 Subject-Wise Performance
                </h3>
                {subjectLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                    <Loader size={24} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : subjectPerformance.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', textAlign: 'center', padding: '10px 0', margin: 0 }}>
                    No subject quizzes recorded yet. Take quizzes on specific topics to track accuracy!
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                    {subjectPerformance.map(subj => {
                      const acc = subj.accuracy;
                      const color = acc >= 80 ? '#3aaa5c' : acc >= 50 ? '#c9a84c' : '#b5473a';
                      const bgBar = acc >= 80 ? 'rgba(58,170,92,0.08)' : acc >= 50 ? 'rgba(201,168,76,0.08)' : 'rgba(181,71,58,0.08)';

                      return (
                        <div key={subj.topic} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>{subj.topic}</span>
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color }}>{acc}% ({subj.correct}/{subj.total})</span>
                          </div>
                          <div style={{ height: '8px', background: bgBar, borderRadius: '4px', overflow: 'hidden', border: `1px solid ${color}10` }}>
                            <div style={{ height: '100%', width: `${acc}%`, background: color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )
        ) : (
          cacheLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <Loader size={36} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <>
              {/* Cache Stats KPI Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {cacheStatsKPIs.map(({ icon: Icon, label, value, color, desc }) => (
                  <div key={label} style={{
                    padding: '24px', borderRadius: '16px',
                    background: 'rgba(255,253,247,0.96)', border: `1px solid var(--glass-border)`,
                    borderLeft: `4px solid ${color}`, boxShadow: 'var(--shadow-sm)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 600, margin: 0 }}>{label}</p>
                      <div style={{ background: `${color}15`, padding: '8px', borderRadius: '10px', border: `1px solid ${color}25` }}>
                        <Icon size={18} style={{ color, display: 'block' }} />
                      </div>
                    </div>
                    <p style={{ fontSize: '2.2rem', fontWeight: 700, margin: 0, lineHeight: 1.1, fontFamily: 'Playfair Display, serif', color: 'var(--text-primary)' }}>{value}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '6px 0 0' }}>{desc}</p>
                  </div>
                ))}
              </div>

              {/* Optimization Performance Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '20px' }}>
                {/* Dual-Bar Token consumption Chart */}
                <div style={{ background: 'rgba(255,253,247,0.96)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <TrendingUp size={20} style={{ color: 'var(--accent-primary)' }} />
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'Playfair Display, serif' }}>Token Savings Comparison</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8c775a' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#c9bca7', display: 'inline-block' }} />
                        Unoptimized
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3aaa5c' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#3aaa5c', display: 'inline-block' }} />
                        Optimized (Actual)
                      </span>
                    </div>
                  </div>
                  <CacheBarChart data={cacheStats?.daily_logs || []} />
                </div>

                {/* Strategy Explanation panel */}
                <div style={{
                  background: 'rgba(255,253,247,0.96)', border: '1px solid var(--glass-border)',
                  borderRadius: '20px', padding: '28px', boxShadow: 'var(--shadow-sm)',
                  display: 'flex', flexDirection: 'column', gap: '16px'
                }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'Playfair Display, serif', color: 'var(--text-primary)' }}>
                    Optimization Strategies
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
                    {[
                      { title: '👤 Profile Cache', text: 'Stores student education, skills, interests and goals locally, injecting them compactly rather than resending huge static profile datasets on each request.' },
                      { title: '🗺️ Career Plan Cache', text: 'Prevents calling LLM when matching career roadmap form inputs are submitted; loads identical generated plans directly.' },
                      { title: '🧠 Memory Summary', text: 'Compresses conversation turns beyond the active window (last 4 turns) into compact bullets, cutting prompt histories by up to 90%.' },
                      { title: '⚡ Semantic Cache', text: 'Checks questions against a vector similarity index, answering similar questions instantly with 100% token savings.' }
                    ].map((s, idx) => (
                      <div key={idx} style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-deep)', margin: '0 0 4px' }}>{s.title}</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{s.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )
        )}
      </div>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AnalyticsPage;
