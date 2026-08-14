import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import {
  FileText, MessageSquare, Layers,
  Target, Loader, TrendingUp, Upload,
} from 'lucide-react';
import { API } from '../lib/api';

interface Analytics {
  total_documents: number;
  total_quizzes: number;
  avg_quiz_score: number;
  total_tasks: number;
  completed_tasks: number;
  flashcard_decks: number;
  total_chats: number;
  recent_quiz_scores: { date: string; score: number; total: number; percentage: number }[];
}

interface RecentDoc {
  id: string;
  original_name: string;
  file_type: string;
  created_at: string;
}

// Inline mini bar chart (reused from Analytics page)
const MiniBarChart = ({ data }: { data: Analytics['recent_quiz_scores'] }) => {
  if (!data.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '180px', gap: '10px' }}>
        <Target size={32} style={{ color: 'var(--accent-light)', opacity: 0.5 }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
          No quiz data yet — generate your first quiz!
        </p>
      </div>
    );
  }
  const chartH = 160;
  const barW = Math.min(36, (460 / data.length) - 10);
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${Math.max(460, data.length * 50)} ${chartH + 36}`} preserveAspectRatio="xMinYMin meet">
        {[0, 50, 100].map(pct => {
          const y = chartH - (pct / 100) * chartH;
          return (
            <g key={pct}>
              <line x1={0} y1={y} x2="100%" y2={y} stroke="rgba(184,148,58,0.1)" strokeWidth={1} strokeDasharray={pct === 0 ? 'none' : '3,3'} />
              <text x={2} y={y - 3} fill="rgba(107,94,74,0.5)" fontSize={9}>{pct}%</text>
            </g>
          );
        })}
        {data.slice().reverse().map((item, i) => {
          const barH = (item.percentage / 100) * chartH;
          const x = i * (barW + 10) + 36;
          const y = chartH - barH;
          const color = item.percentage >= 80 ? '#3aaa5c' : item.percentage >= 60 ? '#c9a84c' : '#b5473a';
          return (
            <g key={i}>
              <defs>
                <linearGradient id={`db-bar-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.9" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.4" />
                </linearGradient>
              </defs>
              <rect x={x} y={y} width={barW} height={barH} rx={5} fill={`url(#db-bar-${i})`} />
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill={color} fontSize={10} fontWeight={600}>{item.percentage}%</text>
              <text x={x + barW / 2} y={chartH + 14} textAnchor="middle" fill="rgba(107,94,74,0.6)" fontSize={9}>{item.date}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// Skeleton loader block
const Skeleton = ({ w = '100%', h = '20px', r = '6px' }: { w?: string; h?: string; r?: string }) => (
  <div style={{
    width: w, height: h, borderRadius: r,
    background: 'linear-gradient(90deg, rgba(184,148,58,0.06) 25%, rgba(184,148,58,0.12) 50%, rgba(184,148,58,0.06) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  }} />
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('user_name') || 'Student';
  const userEmail = localStorage.getItem('user_email') || '';
  // Generate initials from name
  const initials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'S';

  useEffect(() => {
    if (!token) { navigate('/login'); return; }

    // Fetch analytics summary
    fetch(`${API}/analytics/summary`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setAnalytics)
      .catch(() => setAnalytics(null))
      .finally(() => setLoadingAnalytics(false));

    // Fetch recent documents (last 3)
    fetch(`${API}/documents/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((docs: RecentDoc[]) => setRecentDocs(docs.slice(0, 3)))
      .catch(() => setRecentDocs([]))
      .finally(() => setLoadingDocs(false));
  }, [navigate, token]);

  const kpiCards = [
    {
      icon: FileText,
      color: '#b8943a',
      bg: 'rgba(184,148,58,0.08)',
      border: '#b8943a',
      label: 'Documents',
      value: analytics?.total_documents ?? null,
      unit: 'Uploaded',
      href: '/documents',
    },
    {
      icon: Target,
      color: '#c9a84c',
      bg: 'rgba(201,168,76,0.08)',
      border: '#c9a84c',
      label: 'Quizzes Taken',
      value: analytics?.total_quizzes ?? null,
      unit: 'All Time',
      href: '/quizzes',
    },
    {
      icon: Layers,
      color: '#a07828',
      bg: 'rgba(160,120,40,0.08)',
      border: '#a07828',
      label: 'Flashcard Decks',
      value: analytics?.flashcard_decks ?? null,
      unit: 'Created',
      href: '/flashcards',
    },
    {
      icon: MessageSquare,
      color: '#7a6030',
      bg: 'rgba(122,96,48,0.08)',
      border: '#7a6030',
      label: 'AI Chats',
      value: analytics?.total_chats ?? null,
      unit: 'Questions Asked',
      href: '/chat',
    },
  ];

  const fileIcon = (type: string, name: string) => {
    if (type?.includes('pdf') || name?.endsWith('.pdf')) return '📄';
    if (type?.includes('word') || name?.endsWith('.docx')) return '📝';
    if (type?.includes('presentation') || name?.endsWith('.pptx')) return '📊';
    return '📃';
  };

  return (
    <div style={{ background: 'var(--bg-color)', minHeight: '100vh' }}>
      <div className="bg-blob bg-blob-1"></div>
      <div className="bg-blob bg-blob-2"></div>

      <div className="app-layout-container">
        <Sidebar />

        <div className="app-main-content">
          <div className="app-card-panel">

            {/* ── Header Row ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '12px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '8px' }}>
                  Dashboard
                </p>
                <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.5rem)', marginBottom: '8px', lineHeight: 1.2 }}>
                  Welcome back, <span className="gradient-text">{userName.split(' ')[0]}</span>!
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  Ready to crush your learning goals today?
                </p>
              </div>

              {/* User Card */}
              <div style={{
                padding: '12px 18px',
                background: 'rgba(255,253,247,0.95)',
                border: '1px solid var(--glass-border)',
                borderRadius: '14px',
                display: 'flex', alignItems: 'center', gap: '14px',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: '16px',
                  boxShadow: '0 4px 12px rgba(184,148,58,0.3)',
                }}>
                  {initials}
                </div>
                <div>
                  <p style={{ fontWeight: 600, margin: 0, fontSize: '14px', color: 'var(--text-primary)' }}>{userName}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{userEmail || 'Student'}</p>
                </div>
              </div>
            </div>

            {/* ── KPI Cards ──────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              {kpiCards.map(({ icon: Icon, color, bg, border, label, value, unit, href }) => (
                <div
                  key={label}
                  onClick={() => navigate(href)}
                  style={{
                    padding: '20px',
                    background: 'rgba(255,253,247,0.95)',
                    border: `1px solid var(--glass-border)`,
                    borderLeft: `4px solid ${border}`,
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, margin: 0 }}>{label}</p>
                    <div style={{ background: bg, padding: '6px', borderRadius: '8px', border: `1px solid ${color}22` }}>
                      <Icon size={16} style={{ color, display: 'block' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                    {loadingAnalytics ? (
                      <Skeleton w="60px" h="36px" r="8px" />
                    ) : (
                      <p style={{ fontSize: '2.2rem', fontWeight: 700, margin: 0, lineHeight: 1, fontFamily: 'Playfair Display, serif', color: 'var(--text-primary)' }}>
                        {value ?? 0}
                      </p>
                    )}
                    <p style={{ margin: '0 0 4px', color: 'var(--text-muted)', fontSize: '12px' }}>{unit}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Charts + Recent Activity ────────────────────────────────── */}
            <div className="grid-responsive-2" style={{ marginBottom: '28px' }}>

              {/* Quiz Performance Chart */}
              <div style={{
                padding: '28px', borderRadius: '16px',
                background: 'rgba(255,253,247,0.95)',
                border: '1px solid var(--glass-border)',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <TrendingUp size={18} style={{ color: 'var(--accent-primary)' }} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'Playfair Display, serif' }}>Quiz Performance</h3>
                </div>
                {loadingAnalytics ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Skeleton h="14px" /><Skeleton h="120px" r="8px" />
                  </div>
                ) : (
                  <MiniBarChart data={analytics?.recent_quiz_scores || []} />
                )}
              </div>

              {/* Recent Activity */}
              <div style={{
                padding: '28px', borderRadius: '16px',
                background: 'rgba(255,253,247,0.95)',
                border: '1px solid var(--glass-border)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex', flexDirection: 'column',
              }}>
                <h3 style={{ marginBottom: '20px', fontSize: '1.1rem', fontFamily: 'Playfair Display, serif', marginTop: 0 }}>Recent Documents</h3>

                {loadingDocs ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <Skeleton w="36px" h="36px" r="8px" />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <Skeleton h="12px" />
                          <Skeleton w="60%" h="10px" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentDocs.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center' }}>
                    <Upload size={32} style={{ color: 'var(--accent-light)', opacity: 0.5 }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>No documents yet</p>
                    <button
                      onClick={() => navigate('/documents')}
                      className="btn btn-primary"
                      style={{ fontSize: '12px', padding: '8px 16px', gap: '6px' }}
                    >
                      <Upload size={13} /> Upload First
                    </button>
                  </div>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {recentDocs.map(doc => (
                      <li
                        key={doc.id}
                        onClick={() => navigate('/documents')}
                        style={{ display: 'flex', gap: '12px', alignItems: 'center', cursor: 'pointer', borderRadius: '10px', padding: '6px 8px', transition: 'background 0.2s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(184,148,58,0.06)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '8px',
                          background: 'rgba(184,148,58,0.08)',
                          border: '1px solid rgba(184,148,58,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '16px', flexShrink: 0,
                        }}>
                          {fileIcon(doc.file_type, doc.original_name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.original_name}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                            {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* ── Summary Stats Row ───────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {/* Avg Quiz Score */}
              <div style={{ padding: '20px 24px', borderRadius: '14px', background: 'rgba(255,253,247,0.95)', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
                  background: `conic-gradient(var(--accent-primary) ${(analytics?.avg_quiz_score || 0) * 3.6}deg, var(--bg-tertiary) 0deg)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,253,247,0.98)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {loadingAnalytics
                      ? <Loader size={14} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                      : <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary)' }}>{analytics?.avg_quiz_score || 0}%</span>
                    }
                  </div>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Avg Quiz Score</p>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                    {loadingAnalytics ? '—' : `${analytics?.total_quizzes || 0} quiz${analytics?.total_quizzes !== 1 ? 'zes' : ''} taken`}
                  </p>
                </div>
              </div>

              {/* Task Completion */}
              <div style={{ padding: '20px 24px', borderRadius: '14px', background: 'rgba(255,253,247,0.95)', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-sm)' }}>
                <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Task Completion</p>
                {loadingAnalytics ? (
                  <Skeleton h="10px" />
                ) : analytics && analytics.total_tasks > 0 ? (
                  <>
                    <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.round((analytics.completed_tasks / analytics.total_tasks) * 100)}%`,
                        background: 'linear-gradient(90deg, #3aaa5c, #6bcf85)',
                        borderRadius: '4px', transition: 'width 0.6s ease',
                      }} />
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                      {analytics.completed_tasks} of {analytics.total_tasks} tasks done
                    </p>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                    No tasks yet — <span onClick={() => navigate('/planner')} style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 500 }}>create one</span>
                  </p>
                )}
              </div>

              {/* Quick Actions */}
              <div style={{ padding: '20px 24px', borderRadius: '14px', background: 'rgba(255,253,247,0.95)', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Quick Actions</p>
                {[
                  { label: '📄 Upload Document', href: '/documents' },
                  { label: '💬 Ask AI', href: '/chat' },
                  { label: '🎯 Take a Quiz', href: '/quizzes' },
                ].map(a => (
                  <button
                    key={a.href}
                    onClick={() => navigate(a.href)}
                    style={{
                      background: 'transparent', border: '1px solid var(--glass-border)',
                      borderRadius: '8px', padding: '7px 12px', fontSize: '12px',
                      color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.2s', fontFamily: 'Inter, sans-serif',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-primary)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--glass-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
