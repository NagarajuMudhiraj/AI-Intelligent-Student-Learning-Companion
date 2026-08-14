import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { Target, Sparkles, ChevronRight, CheckCircle, XCircle, RotateCcw, Loader, BookOpen, Clock, Plus } from 'lucide-react';
import { API } from '../lib/api';

interface QuizOption { 
  label: string; 
  text: string; 
}

interface QuizQuestion { 
  question: string; 
  options: QuizOption[]; 
  correct_answer: string; 
  explanation: string; 
}

interface Document { 
  id: string; 
  original_name: string; 
}

interface QuizAttempt {
  id: string;
  score: number;
  total: number;
  topic?: string;
  created_at: string;
}

interface QuizAttemptDetails {
  id: string;
  questions: QuizQuestion[];
  user_answers: string[];
  score: number;
  total: number;
  topic?: string;
  created_at: string;
}

type Stage = 'config' | 'quiz' | 'results' | 'review';
type Difficulty = 'easy' | 'medium' | 'hard' | 'adaptive';

const difficultyColors: Record<Difficulty, string> = {
  easy: '#3aaa5c', medium: '#c9a84c', hard: '#b5473a', adaptive: '#8b5cf6'
};

const QuizzesPage = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('config');
  const [docs, setDocs] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState('');
  const [topic, setTopic] = useState('');
  const [numQ, setNumQ] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [resolvedDifficulty, setResolvedDifficulty] = useState<string>('medium');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState<{ score: number; total: number; percentage: number; attempt_id?: string } | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  
  // Timed Quiz States
  const [isTimed, setIsTimed] = useState(false);
  const [timerDuration, setTimerDuration] = useState(30);
  const [timeLeft, setTimeLeft] = useState(30);
  const [timerActive, setTimerActive] = useState(false);

  // Quiz Review States
  const [history, setHistory] = useState<QuizAttempt[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<QuizAttemptDetails | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [retesting, setRetesting] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'correct' | 'incorrect'>('all');

  // Timer useEffect hook logic
  useEffect(() => {
    let interval: any = null;
    if (stage === 'quiz' && isTimed && timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && stage === 'quiz' && isTimed && timerActive) {
      setTimerActive(false);
      const updated = [...answers];
      updated[current] = 'TIMEOUT';
      setAnswers(updated);
      setShowExplanation(true);
    }
    return () => clearInterval(interval);
  }, [stage, isTimed, timerActive, timeLeft, current, answers]);

  // Reset timer on question change
  useEffect(() => {
    if (stage === 'quiz' && isTimed) {
      setTimeLeft(timerDuration);
      setTimerActive(true);
    }
  }, [current, stage, isTimed, timerDuration]);


  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetch(`${API}/documents/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setDocs).catch(() => {});
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API}/quiz/history`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setHistory(await res.json());
    } catch (e) {}
  };

  const generateQuiz = async () => {
    setGenerating(true);
    try {
      const body: any = { num_questions: numQ, difficulty };
      if (selectedDoc) body.document_id = selectedDoc;
      if (topic) body.topic = topic;

      const res = await fetch(`${API}/quiz/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); alert(e.detail); return; }
      const data = await res.json();
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(''));
      setCurrent(0);
      setShowExplanation(false);
      setResolvedDifficulty(data.difficulty || difficulty);
      setReviewFilter('all');
      if (isTimed) {
        setTimeLeft(timerDuration);
        setTimerActive(true);
      }
      setStage('quiz');
    } finally {
      setGenerating(false);
    }
  };

  const selectAnswer = (label: string) => {
    const updated = [...answers];
    updated[current] = label;
    setAnswers(updated);
    setShowExplanation(true);
    setTimerActive(false); // Stop the timer when answered
  };

  const nextQuestion = () => {
    if (current < questions.length - 1) {
      setCurrent(current + 1);
      setShowExplanation(false);
    } else {
      submitQuiz();
    }
  };

  const submitQuiz = async () => {
    setSubmitting(true);
    setTimerActive(false); // Stop the timer
    try {
      const res = await fetch(`${API}/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          questions,
          user_answers: answers,
          document_id: selectedDoc || null,
          topic: topic || null,
          difficulty: resolvedDifficulty,
        }),
      });
      const data = await res.json();
      setScore(data);
      setReviewFilter('all');
      setStage('results');
      fetchHistory(); // Refresh sidebar history
    } finally {
      setSubmitting(false);
    }
  };

  const fetchAttemptDetails = async (id: string) => {
    setReviewLoading(true);
    setActiveAttempt(null);
    try {
      const res = await fetch(`${API}/quiz/attempts/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setActiveAttempt(data);
        setReviewFilter('all');
        setStage('review');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setReviewLoading(false);
    }
  };

  const startReTest = async (attemptId: string) => {
    setRetesting(true);
    try {
      const res = await fetch(`${API}/quiz/attempts/${attemptId}/retest`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || 'Could not start re-test.');
        return;
      }
      
      const data = await res.json();
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(''));
      setCurrent(0);
      setShowExplanation(false);
      setResolvedDifficulty(data.difficulty || 'medium');
      setReviewFilter('all');
      if (isTimed) {
        setTimeLeft(timerDuration);
        setTimerActive(true);
      }
      setStage('quiz');
    } catch (e) {
      console.error(e);
    } finally {
      setRetesting(false);
    }
  };

  const reset = () => {
    setStage('config');
    setQuestions([]);
    setAnswers([]);
    setCurrent(0);
    setScore(null);
    setShowExplanation(false);
    setActiveAttempt(null);
    setReviewFilter('all');
    setTimerActive(false);
  };


  const q = questions[current];

  return (
    <div className="app-layout-container">
      <div className="bg-blob bg-blob-1" />
      <div className="bg-blob bg-blob-2" />
      <Sidebar />

      <div className="app-main-content" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {/* Left Column: Quiz History */}
        <div style={{
          width: '280px', maxWidth: '100%', flexShrink: 0,
          background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)', borderRadius: '20px',
          boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'Playfair Display, serif' }}>Quiz History</h3>
              <button
                onClick={reset}
                style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: 'rgba(184,148,58,0.1)', border: '1px solid rgba(184,148,58,0.2)',
                  color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
              ><Plus size={16} /></button>
            </div>
          </div>

          {/* History List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {history.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No quiz attempts yet.<br />Generate one above!</p>
            ) : history.map(attempt => {
              const scorePercent = Math.round((attempt.score / attempt.total) * 100);
              const scoreColor = scorePercent >= 80 ? '#3aaa5c' : scorePercent >= 60 ? '#c9a84c' : '#b5473a';
              const bgBadgeColor = scorePercent >= 80 ? 'rgba(58,170,92,0.08)' : scorePercent >= 60 ? 'rgba(201,168,76,0.08)' : 'rgba(181,71,58,0.08)';

              return (
                <div
                  key={attempt.id}
                  onClick={() => fetchAttemptDetails(attempt.id)}
                  style={{
                    padding: '12px 14px', borderRadius: '12px', cursor: 'pointer',
                    background: activeAttempt?.id === attempt.id ? 'rgba(184,148,58,0.1)' : 'transparent',
                    border: `1px solid ${activeAttempt?.id === attempt.id ? 'rgba(184,148,58,0.3)' : 'transparent'}`,
                    marginBottom: '6px', transition: 'all 0.2s',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                  onMouseEnter={e => { if (activeAttempt?.id !== attempt.id) (e.currentTarget as HTMLElement).style.background = 'rgba(232,213,163,0.15)'; }}
                  onMouseLeave={e => { if (activeAttempt?.id !== attempt.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ overflow: 'hidden', flex: 1, paddingRight: '10px' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {attempt.topic || 'Quiz Session'}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} /> {new Date(attempt.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                    color: scoreColor, background: bgBadgeColor, border: `1px solid ${scoreColor}20`
                  }}>
                    {attempt.score}/{attempt.total}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Main Workspace */}
        <div style={{
          flex: 1, borderRadius: '20px', overflow: 'hidden',
          background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-md)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(184,148,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={22} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontFamily: 'Playfair Display, serif' }}>Quiz & Review Mode</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>AI-driven practice tests, score analytics, and weaknesses diagnostics</p>
            </div>
          </div>

          <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
            {reviewLoading ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <Loader size={36} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : (
              <>
                {/* ── CONFIG STAGE ── */}
                {stage === 'config' && (
                  <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>Select Document (optional)</label>
                      <select
                        value={selectedDoc}
                        onChange={e => setSelectedDoc(e.target.value)}
                        style={{
                          width: '100%', padding: '12px 16px', borderRadius: '12px', fontSize: '14px',
                          background: 'rgba(255,253,247,0.98)', border: '1.5px solid var(--glass-border)',
                          color: 'var(--text-primary)', outline: 'none', cursor: 'pointer',
                        }}
                      >
                        <option value="">— All my documents —</option>
                        {docs.map(d => <option key={d.id} value={d.id}>{d.original_name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>Or enter a specific topic</label>
                      <input
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        placeholder="e.g., Photosynthesis, Newton's Laws, World War II…"
                        style={{
                          width: '100%', padding: '12px 16px', borderRadius: '12px', fontSize: '14px',
                          background: 'rgba(255,253,247,0.98)', border: '1.5px solid var(--glass-border)',
                          color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>Number of Questions</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {[3, 5, 10, 15].map(n => (
                            <button
                              key={n}
                              onClick={() => setNumQ(n)}
                              style={{
                                flex: 1, padding: '10px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                                border: `1.5px solid ${numQ === n ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                                background: numQ === n ? 'rgba(184,148,58,0.1)' : 'transparent',
                                color: numQ === n ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                cursor: 'pointer', transition: 'all 0.2s',
                              }}
                            >{n}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>Difficulty</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {(['easy', 'medium', 'hard', 'adaptive'] as Difficulty[]).map(d => (
                            <button
                              key={d}
                              onClick={() => setDifficulty(d)}
                              style={{
                                flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                                border: `1.5px solid ${difficulty === d ? difficultyColors[d] : 'var(--glass-border)'}`,
                                background: difficulty === d ? `${difficultyColors[d]}15` : 'transparent',
                                color: difficulty === d ? difficultyColors[d] : 'var(--text-secondary)',
                                cursor: 'pointer', transition: 'all 0.2s', textTransform: 'capitalize',
                              }}
                            >
                              {d === 'adaptive' ? '🚀 Adaptive' : d}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>Timed Quiz</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {[
                            { label: 'Off', value: false },
                            { label: 'On', value: true }
                          ].map(opt => (
                            <button
                              key={opt.label}
                              onClick={() => {
                                setIsTimed(opt.value);
                                if (opt.value) {
                                  setTimerActive(false);
                                }
                              }}
                              style={{
                                flex: 1, padding: '10px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                                border: `1.5px solid ${isTimed === opt.value ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                                background: isTimed === opt.value ? 'rgba(184,148,58,0.1)' : 'transparent',
                                color: isTimed === opt.value ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                cursor: 'pointer', transition: 'all 0.2s',
                              }}
                            >{opt.label}</button>
                          ))}
                        </div>
                      </div>
                      {isTimed && (
                        <div>
                          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>Time limit per question</label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {[15, 30, 60].map(s => (
                              <button
                                key={s}
                                onClick={() => setTimerDuration(s)}
                                style={{
                                  flex: 1, padding: '10px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                                  border: `1.5px solid ${timerDuration === s ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                                  background: timerDuration === s ? 'rgba(184,148,58,0.1)' : 'transparent',
                                  color: timerDuration === s ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                  cursor: 'pointer', transition: 'all 0.2s',
                                }}
                              >{s}s</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      className="btn btn-primary"
                      onClick={generateQuiz}
                      disabled={generating || (!selectedDoc && !topic && docs.length === 0)}
                      style={{ alignSelf: 'flex-start', gap: '10px', padding: '14px 32px' }}
                    >
                      {generating ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={16} />}
                      {generating ? 'Generating Quiz…' : 'Generate Quiz'}
                    </button>
                  </div>
                )}

                {/* ── QUIZ STAGE ── */}
                {stage === 'quiz' && q && (
                  <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Progress */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Question {current + 1} of {questions.length}</span>
                        <span style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: 600, textTransform: 'capitalize' }}>{resolvedDifficulty} Difficulty</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${((current + 1) / questions.length) * 100}%`, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                      </div>
                      {isTimed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                          <Clock size={14} style={{ color: timeLeft <= 5 ? '#b5473a' : 'var(--text-secondary)' }} />
                          <span style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: timeLeft <= 5 ? '#b5473a' : 'var(--text-secondary)',
                            transition: 'color 0.2s'
                          }}>
                            {timeLeft}s remaining
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Question */}
                    <div style={{ padding: '28px', borderRadius: '16px', background: 'rgba(232,213,163,0.08)', border: '1px solid var(--glass-border)' }}>
                      <p style={{ fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.6, color: 'var(--text-primary)', margin: 0 }}>{q.question}</p>
                    </div>

                    {/* Options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {q.options.map(opt => {
                        const selected = answers[current] === opt.label;
                        const answered = !!answers[current];
                        const correct = opt.label === q.correct_answer;
                        let bg = 'rgba(255,253,247,0.98)';
                        let border = 'var(--glass-border)';
                        let color = 'var(--text-primary)';
                        if (answered) {
                          if (correct) { bg = 'rgba(58,170,92,0.1)'; border = '#3aaa5c'; color = '#3aaa5c'; }
                          else if (selected) { bg = 'rgba(181,71,58,0.1)'; border = '#b5473a'; color = '#b5473a'; }
                        } else if (selected) {
                          bg = 'rgba(184,148,58,0.1)'; border = 'var(--accent-primary)';
                        }

                        return (
                          <button
                            key={opt.label}
                            onClick={() => !answered && selectAnswer(opt.label)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '14px',
                              padding: '14px 18px', borderRadius: '12px', textAlign: 'left',
                              background: bg, border: `1.5px solid ${border}`, color,
                              cursor: answered ? 'default' : 'pointer', transition: 'all 0.2s', width: '100%',
                            }}
                          >
                            <span style={{
                              width: '30px', height: '30px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: answered && correct ? '#3aaa5c' : answered && selected ? '#b5473a' : 'rgba(184,148,58,0.1)',
                              color: answered && (correct || selected) ? '#fff' : 'var(--accent-primary)',
                              fontWeight: 700, fontSize: '13px', flexShrink: 0,
                            }}>{opt.label}</span>
                            <span style={{ fontSize: '14px', flex: 1 }}>{opt.text}</span>
                            {answered && correct && <CheckCircle size={18} style={{ color: '#3aaa5c', flexShrink: 0 }} />}
                            {answered && selected && !correct && <XCircle size={18} style={{ color: '#b5473a', flexShrink: 0 }} />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    {showExplanation && (
                      <div style={{ padding: '16px 20px', borderRadius: '12px', background: 'rgba(184,148,58,0.06)', border: '1px solid rgba(184,148,58,0.2)' }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                          <strong style={{ color: 'var(--accent-primary)' }}>Explanation: </strong>{q.explanation}
                        </p>
                      </div>
                    )}

                    {showExplanation && (
                      <button
                        className="btn btn-primary"
                        onClick={nextQuestion}
                        disabled={submitting}
                        style={{ alignSelf: 'flex-end', gap: '8px' }}
                      >
                        {submitting ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> :
                          current < questions.length - 1 ? 'Next Question' : 'Submit Quiz'}
                        {!submitting && <ChevronRight size={16} />}
                      </button>
                    )}
                  </div>
                )}

                {/* ── RESULTS STAGE ── */}
                {stage === 'results' && score && (
                  <div style={{ maxWidth: '560px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{
                      width: '140px', height: '140px', borderRadius: '50%',
                      background: `conic-gradient(var(--accent-primary) ${score.percentage * 3.6}deg, var(--bg-tertiary) 0deg)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 0 40px rgba(184,148,58,0.25)',
                    }}>
                      <div style={{ width: '110px', height: '110px', borderRadius: '50%', background: 'rgba(255,253,247,0.98)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', color: 'var(--text-primary)' }}>{score.percentage}%</span>
                      </div>
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.6rem', marginBottom: '8px', fontFamily: 'Playfair Display, serif' }}>
                        {score.percentage >= 80 ? '🎉 Excellent!' : score.percentage >= 60 ? '👍 Good Job!' : '📚 Keep Practicing!'}
                      </h2>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>You scored <strong>{score.score}</strong> out of <strong>{score.total}</strong> questions</p>
                    </div>

                    {/* Retest Trigger on results screen */}
                    {score.score < score.total && (
                      <button 
                        onClick={() => score.attempt_id && startReTest(score.attempt_id)}
                        disabled={retesting}
                        className="btn btn-primary"
                        style={{ gap: '8px', padding: '12px 24px', background: 'linear-gradient(135deg, #e34c26, #f06529)' }}
                      >
                        {retesting ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={15} />}
                        ⚡ AI Re-Test on Weak Areas
                      </button>
                    )}

                    {/* Answer Review */}
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '10px' }}>
                        <h3 style={{ fontSize: '1rem', margin: 0 }}>Review Questions</h3>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {(['all', 'correct', 'incorrect'] as const).map(f => (
                            <button
                              key={f}
                              onClick={() => setReviewFilter(f)}
                              style={{
                                padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                                border: '1px solid var(--glass-border)',
                                background: reviewFilter === f ? 'var(--accent-primary)' : 'rgba(255,253,247,0.6)',
                                color: reviewFilter === f ? '#fff' : 'var(--text-secondary)',
                                cursor: 'pointer', transition: 'all 0.2s', textTransform: 'capitalize'
                              }}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>

                      {questions
                        .map((q, i) => ({ q, i }))
                        .filter(({ q, i }) => {
                          const correct = answers[i] === q.correct_answer;
                          if (reviewFilter === 'correct') return correct;
                          if (reviewFilter === 'incorrect') return !correct;
                          return true;
                        })
                        .length === 0 ? (
                          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'rgba(184,148,58,0.02)', borderRadius: '12px', border: '1px dashed var(--glass-border)' }}>
                            No {reviewFilter} questions to display.
                          </div>
                        ) : (
                          questions
                            .map((q, i) => ({ q, i }))
                            .filter(({ q, i }) => {
                              const correct = answers[i] === q.correct_answer;
                              if (reviewFilter === 'correct') return correct;
                              if (reviewFilter === 'incorrect') return !correct;
                              return true;
                            })
                            .map(({ q, i }) => {
                              const correct = answers[i] === q.correct_answer;
                              return (
                                <div key={i} style={{
                                  padding: '16px', borderRadius: '12px',
                                  background: correct ? 'rgba(58,170,92,0.06)' : 'rgba(181,71,58,0.06)',
                                  border: `1px solid ${correct ? 'rgba(58,170,92,0.2)' : 'rgba(181,71,58,0.2)'}`,
                                  display: 'flex', flexDirection: 'column', gap: '8px',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                    {correct ? <CheckCircle size={16} style={{ color: '#3aaa5c', flexShrink: 0, marginTop: '2px' }} /> : <XCircle size={16} style={{ color: '#b5473a', flexShrink: 0, marginTop: '2px' }} />}
                                    <div>
                                      <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: 600 }}>{q.question}</p>
                                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        Your Answer: <strong style={{ color: correct ? '#3aaa5c' : '#b5473a' }}>{answers[i] === 'TIMEOUT' ? 'Timed Out' : (answers[i] || 'None')}</strong> | Correct Answer: <strong>{q.correct_answer}</strong>
                                      </p>
                                    </div>
                                  </div>
                                  <div style={{ fontSize: '12px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(184,148,58,0.04)', color: 'var(--text-secondary)', borderLeft: '3px solid var(--accent-primary)' }}>
                                    <strong>Tip:</strong> {q.explanation}
                                  </div>
                                </div>
                              );
                            })
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button className="btn btn-secondary" onClick={reset} style={{ gap: '8px' }}>
                        <RotateCcw size={15} /> New Quiz
                      </button>
                      <button className="btn btn-primary" onClick={() => navigate('/flashcards')} style={{ gap: '8px' }}>
                        <BookOpen size={15} /> Study Flashcards
                      </button>
                    </div>
                  </div>
                )}

                {/* ── REVIEW PAST ATTEMPT STAGE ── */}
                {stage === 'review' && activeAttempt && (
                  <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Header statistics */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'rgba(184,148,58,0.04)', padding: '20px 24px', borderRadius: '16px',
                      border: '1.5px solid var(--glass-border)'
                    }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Review: {activeAttempt.topic || 'Quiz Attempt'}
                        </h4>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                          Completed on {new Date(activeAttempt.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Score:</span>
                        <span style={{
                          fontSize: '15px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px',
                          color: (activeAttempt.score / activeAttempt.total) >= 0.8 ? '#3aaa5c' : (activeAttempt.score / activeAttempt.total) >= 0.6 ? '#c9a84c' : '#b5473a',
                          background: (activeAttempt.score / activeAttempt.total) >= 0.8 ? 'rgba(58,170,92,0.08)' : (activeAttempt.score / activeAttempt.total) >= 0.6 ? 'rgba(201,168,76,0.08)' : 'rgba(181,71,58,0.08)',
                          border: '1px solid rgba(184, 148, 58, 0.15)'
                        }}>
                          {activeAttempt.score} / {activeAttempt.total} ({Math.round((activeAttempt.score / activeAttempt.total) * 100)}%)
                        </span>
                      </div>
                    </div>

                    {/* Conceptual Re-test Button */}
                    {activeAttempt.score < activeAttempt.total && (
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '16px 20px', borderRadius: '12px', background: 'rgba(201,168,76,0.06)',
                        border: '1px solid rgba(201,168,76,0.15)'
                      }}>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                          Strengthen weak topics by generating a review quiz on missed questions.
                        </p>
                        <button
                          onClick={() => startReTest(activeAttempt.id)}
                          disabled={retesting}
                          className="btn btn-primary"
                          style={{ gap: '8px', padding: '10px 20px', fontSize: '13px', background: 'linear-gradient(135deg, #e34c26, #f06529)', flexShrink: 0 }}
                        >
                          {retesting ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
                          Practice Weak Areas
                        </button>
                      </div>
                    )}

                    {/* Breakdown Checklist */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Question Breakdown</h4>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {(['all', 'correct', 'incorrect'] as const).map(f => (
                            <button
                              key={f}
                              onClick={() => setReviewFilter(f)}
                              style={{
                                padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                                border: '1px solid var(--glass-border)',
                                background: reviewFilter === f ? 'var(--accent-primary)' : 'rgba(255,253,247,0.6)',
                                color: reviewFilter === f ? '#fff' : 'var(--text-secondary)',
                                cursor: 'pointer', transition: 'all 0.2s', textTransform: 'capitalize'
                              }}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {activeAttempt.questions
                        .map((question, i) => ({ question, i }))
                        .filter(({ question, i }) => {
                          const correct = activeAttempt.user_answers[i] === question.correct_answer;
                          if (reviewFilter === 'correct') return correct;
                          if (reviewFilter === 'incorrect') return !correct;
                          return true;
                        })
                        .length === 0 ? (
                          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'rgba(184,148,58,0.02)', borderRadius: '12px', border: '1px dashed var(--glass-border)' }}>
                            No {reviewFilter} questions to display.
                          </div>
                        ) : (
                          activeAttempt.questions
                            .map((question, i) => ({ question, i }))
                            .filter(({ question, i }) => {
                              const correct = activeAttempt.user_answers[i] === question.correct_answer;
                              if (reviewFilter === 'correct') return correct;
                              if (reviewFilter === 'incorrect') return !correct;
                              return true;
                            })
                            .map(({ question, i }) => {
                              const correct = activeAttempt.user_answers[i] === question.correct_answer;
                              return (
                                <div key={i} style={{
                                  padding: '18px', borderRadius: '14px',
                                  background: correct ? 'rgba(58,170,92,0.04)' : 'rgba(181,71,58,0.04)',
                                  border: `1.5px solid ${correct ? 'rgba(58,170,92,0.15)' : 'rgba(181,71,58,0.15)'}`,
                                  display: 'flex', flexDirection: 'column', gap: '10px',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                    {correct ? <CheckCircle size={16} style={{ color: '#3aaa5c', flexShrink: 0, marginTop: '2px' }} /> : <XCircle size={16} style={{ color: '#b5473a', flexShrink: 0, marginTop: '2px' }} />}
                                    <div>
                                      <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>{question.question}</p>
                                      <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                        Your Choice: <strong style={{ color: correct ? '#3aaa5c' : '#b5473a' }}>{activeAttempt.user_answers[i] === 'TIMEOUT' ? 'Timed Out' : (activeAttempt.user_answers[i] || 'Unanswered')}</strong> | Correct Answer: <strong>{question.correct_answer}</strong>
                                      </p>
                                    </div>
                                  </div>

                                  {/* Options listing for complete context */}
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '6px 0' }}>
                                    {question.options.map(opt => {
                                      const isUserChoice = activeAttempt.user_answers[i] === opt.label;
                                      const isCorrect = question.correct_answer === opt.label;
                                      return (
                                        <div key={opt.label} style={{
                                          fontSize: '12px', padding: '6px 10px', borderRadius: '6px',
                                          background: isCorrect ? 'rgba(58,170,92,0.08)' : isUserChoice ? 'rgba(181,71,58,0.08)' : 'transparent',
                                          border: `1px solid ${isCorrect ? 'rgba(58,170,92,0.2)' : isUserChoice ? 'rgba(181,71,58,0.2)' : 'var(--glass-border)'}`,
                                          color: isCorrect ? '#3aaa5c' : isUserChoice ? '#b5473a' : 'var(--text-secondary)'
                                        }}>
                                          <strong>{opt.label}:</strong> {opt.text}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Explanation Panel */}
                                  <div style={{
                                    fontSize: '12px', padding: '10px 14px', borderRadius: '8px',
                                    background: 'rgba(184,148,58,0.06)', color: 'var(--text-secondary)',
                                    borderLeft: '3px solid var(--accent-primary)', lineHeight: 1.4
                                  }}>
                                    <strong>Explanation:</strong> {question.explanation}
                                  </div>
                                </div>
                              );
                            })
                        )}
                    </div>

                    <button className="btn btn-secondary" onClick={reset} style={{ width: 'fit-content' }}>
                      Back to Dashboard
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default QuizzesPage;
