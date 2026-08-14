import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { LayoutList, Plus, Check, Trash2, Loader, Calendar, AlertCircle, Sparkles, Trash, CheckSquare } from 'lucide-react';
import { API } from '../lib/api';

interface Task {
  id: string;
  title: string;
  subject?: string;
  due_date?: string;
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  completed: boolean;
  created_at: string;
}

interface Document {
  id: string;
  original_name: string;
}

interface StudyPlanTask {
  title: string;
  notes?: string;
  priority: string;
}

interface StudyPlanWeek {
  week: number;
  title: string;
  goal: string;
  tasks: StudyPlanTask[];
}

interface StudyPlan {
  id: string;
  document_id?: string;
  topic?: string;
  weeks: StudyPlanWeek[];
  created_at: string;
}

const priorityConfig = {
  high:   { color: '#b5473a', bg: 'rgba(181,71,58,0.08)',   label: 'High' },
  medium: { color: '#c9a84c', bg: 'rgba(201,168,76,0.08)', label: 'Medium' },
  low:    { color: '#3aaa5c', bg: 'rgba(58,170,92,0.08)',   label: 'Low' },
};

const PlannerPage = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  
  // Tabs: 'board' (Task Board) | 'ai' (AI Study Planner)
  const [activeTab, setActiveTab] = useState<'board' | 'ai'>('board');
  
  // Task Board States
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [form, setForm] = useState({ title: '', subject: '', due_date: '', priority: 'medium' as 'low' | 'medium' | 'high', notes: '' });

  // AI Planner States
  const [docs, setDocs] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState('');
  const [plannerTopic, setPlannerTopic] = useState('');
  const [daysDuration, setDaysDuration] = useState(30);
  const [activePlan, setActivePlan] = useState<StudyPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  
  // Collapsed states for weekly schedule cards
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetchTasks();
    fetchDocs();
    fetchActivePlan();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/planner/tasks`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setTasks(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const fetchDocs = async () => {
    try {
      const res = await fetch(`${API}/documents/`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setDocs(await res.json());
    } catch (e) {}
  };

  const fetchActivePlan = async () => {
    setPlanLoading(true);
    try {
      const res = await fetch(`${API}/planner/active-schedule`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setActivePlan(data);
      }
    } catch (e) {}
    finally {
      setPlanLoading(false);
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      const body: any = { title: form.title, priority: form.priority };
      if (form.subject) body.subject = form.subject;
      if (form.due_date) body.due_date = new Date(form.due_date).toISOString();
      if (form.notes) body.notes = form.notes;

      const res = await fetch(`${API}/planner/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const t = await res.json();
        setTasks(prev => [t, ...prev]);
        setForm({ title: '', subject: '', due_date: '', priority: 'medium', notes: '' });
        setShowForm(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleComplete = async (task: Task) => {
    const res = await fetch(`${API}/planner/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ completed: !task.completed }),
    });
    if (res.ok) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
    }
  };

  const deleteTask = async (id: string) => {
    await fetch(`${API}/planner/tasks/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // AI schedule actions
  const generateSchedule = async () => {
    setGenerating(true);
    try {
      const body: any = { duration_days: daysDuration };
      if (selectedDoc) body.document_id = selectedDoc;
      if (plannerTopic) body.topic = plannerTopic;

      const res = await fetch(`${API}/planner/generate-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const plan = await res.json();
        setActivePlan(plan);
        // Expand first week by default
        setCollapsedWeeks({ 1: false });
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to generate study plan.');
      }
    } catch (e) {
      console.error(e);
      alert('An error occurred while generating study schedule.');
    } finally {
      setGenerating(false);
    }
  };

  const deleteSchedule = async () => {
    if (!confirm('Clear your current study plan? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API}/planner/active-schedule`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setActivePlan(null);
        setPlannerTopic('');
        setSelectedDoc('');
      }
    } catch (e) {}
  };

  const importScheduleToTasks = async (specificWeek?: number) => {
    if (!activePlan) return;
    setImporting(true);
    
    try {
      const tasksToImport: any[] = [];
      const now = new Date();
      const subjectName = activePlan.topic || 
                          docs.find(d => d.id === activePlan.document_id)?.original_name || 
                          'AI Study Schedule';
      
      const weeksToProcess = specificWeek 
        ? activePlan.weeks.filter(w => w.week === specificWeek)
        : activePlan.weeks;
        
      weeksToProcess.forEach(week => {
        const dueDate = new Date();
        // Set due date offset by weeks
        dueDate.setDate(now.getDate() + (week.week * 7));
        
        week.tasks.forEach((task) => {
          tasksToImport.push({
            title: task.title,
            notes: task.notes || `From Study Plan: ${week.title}`,
            priority: task.priority || 'medium',
            due_date: dueDate.toISOString(),
            subject: subjectName
          });
        });
      });

      const res = await fetch(`${API}/planner/bulk-add-tasks`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ tasks: tasksToImport }),
      });

      if (res.ok) {
        alert(`Successfully imported ${tasksToImport.length} tasks!`);
        fetchTasks();
        setActiveTab('board');
      } else {
        alert('Failed to import tasks.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setImporting(false);
    }
  };

  const toggleWeekCollapse = (weekNum: number) => {
    setCollapsedWeeks(prev => ({
      ...prev,
      [weekNum]: prev[weekNum] === undefined ? false : !prev[weekNum]
    }));
  };

  // Filter tasks for standard board
  const filtered = tasks.filter(t =>
    filter === 'all' ? true : filter === 'active' ? !t.completed : t.completed
  );

  const completedCount = tasks.filter(t => t.completed).length;
  const boardProgress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="app-layout-container">
      <div className="bg-blob bg-blob-1" />
      <div className="bg-blob bg-blob-2" />
      <Sidebar />

      <div className="app-main-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header */}
        <div style={{ background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '20px 24px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <p style={{ fontSize: '12px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '4px' }}>Planner</p>
              <h1 style={{ fontSize: '1.8rem', margin: 0 }}>Study <span className="gradient-text">Planner</span></h1>
            </div>
            
            {/* Tab selection */}
            <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
              <button 
                onClick={() => setActiveTab('board')} 
                style={{ 
                  padding: '8px 16px', fontSize: '13px', fontWeight: 600, borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: activeTab === 'board' ? 'rgba(255, 253, 247, 0.98)' : 'transparent',
                  color: activeTab === 'board' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  boxShadow: activeTab === 'board' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <LayoutList size={14} />
                Task Board
              </button>
              <button 
                onClick={() => setActiveTab('ai')} 
                style={{ 
                  padding: '8px 16px', fontSize: '13px', fontWeight: 600, borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: activeTab === 'ai' ? 'rgba(255, 253, 247, 0.98)' : 'transparent',
                  color: activeTab === 'ai' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  boxShadow: activeTab === 'ai' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Sparkles size={14} />
                AI Study Scheduler
              </button>
            </div>
          </div>

          {activeTab === 'board' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ flex: 1, height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${boardProgress}%`, background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))', borderRadius: '4px', transition: 'width 0.4s ease' }} />
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>{completedCount}/{tasks.length} tasks completed</span>
            </div>
          )}
        </div>

        {/* ── TAB: TASK BOARD ── */}
        {activeTab === 'board' && (
          <>
            {/* Create Task Button */}
            {!showForm && (
              <button className="btn btn-secondary" onClick={() => setShowForm(true)} style={{ width: 'fit-content', gap: '6px' }}>
                <Plus size={16} /> New Study Task
              </button>
            )}

            {/* Create Form */}
            {showForm && (
              <div style={{ background: 'rgba(255,253,247,0.96)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '28px 32px', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ marginBottom: '20px', fontSize: '1.1rem' }}>New Study Task</h3>
                <form onSubmit={createTask} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Task Title *</label>
                      <input
                        value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                        placeholder="e.g., Review Chapter 5 notes"
                        required
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '14px', border: '1.5px solid var(--glass-border)', background: 'rgba(255,253,247,0.8)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Subject</label>
                      <input
                        value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
                        placeholder="e.g., Physics, Math…"
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '14px', border: '1.5px solid var(--glass-border)', background: 'rgba(255,253,247,0.8)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Due Date</label>
                      <input
                        type="datetime-local" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '14px', border: '1.5px solid var(--glass-border)', background: 'rgba(255,253,247,0.8)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Priority</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {(['low', 'medium', 'high'] as const).map(p => {
                          const cfg = priorityConfig[p];
                          return (
                            <button key={p} type="button" onClick={() => setForm({ ...form, priority: p })} style={{
                              flex: 1, padding: '9px 6px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                              border: `1.5px solid ${form.priority === p ? cfg.color : 'var(--glass-border)'}`,
                              background: form.priority === p ? cfg.bg : 'transparent',
                              color: form.priority === p ? cfg.color : 'var(--text-secondary)',
                              cursor: 'pointer', transition: 'all 0.2s', textTransform: 'capitalize',
                            }}>{cfg.label}</button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Notes</label>
                    <textarea
                      value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                      placeholder="Additional notes…"
                      rows={2}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '14px', border: '1.5px solid var(--glass-border)', background: 'rgba(255,253,247,0.8)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="submit" disabled={submitting} className="btn btn-primary" style={{ gap: '8px' }}>
                      {submitting ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={15} />}
                      Add Task
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {/* Task List */}
            <div style={{ background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '24px 28px', boxShadow: 'var(--shadow-sm)', flex: 1 }}>
              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--bg-secondary)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
                {(['all', 'active', 'completed'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{
                    padding: '8px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 500,
                    border: 'none', background: filter === f ? 'rgba(255,253,247,0.98)' : 'transparent',
                    color: filter === f ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: filter === f ? 'var(--shadow-sm)' : 'none',
                    textTransform: 'capitalize',
                  }}>{f}</button>
                ))}
              </div>

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <Loader size={32} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <LayoutList size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                  <p>{filter === 'completed' ? 'No completed tasks yet' : filter === 'active' ? 'No active tasks' : 'No tasks yet. Create one!'}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filtered.map(task => {
                    const cfg = priorityConfig[task.priority] || priorityConfig['medium'];
                    const overdue = task.due_date && !task.completed && new Date(task.due_date) < new Date();
                    return (
                      <div key={task.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '14px',
                        padding: '16px 20px', borderRadius: '14px',
                        background: task.completed ? 'rgba(232,213,163,0.06)' : 'rgba(255,253,247,0.98)',
                        border: `1px solid ${overdue ? 'rgba(181,71,58,0.25)' : 'var(--glass-border)'}`,
                        borderLeft: `4px solid ${task.completed ? 'var(--border-light)' : cfg.color}`,
                        boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s',
                        opacity: task.completed ? 0.65 : 1,
                      }}>
                        <button
                          onClick={() => toggleComplete(task)}
                          style={{
                            width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
                            border: `2px solid ${task.completed ? '#3aaa5c' : cfg.color}`,
                            background: task.completed ? '#3aaa5c' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'all 0.2s',
                          }}
                        >
                          {task.completed && <Check size={13} color="#fff" />}
                        </button>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', textDecoration: task.completed ? 'line-through' : 'none' }}>{task.title}</p>
                          <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {task.subject && (
                              <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '20px', background: 'rgba(184,148,58,0.1)', color: 'var(--accent-deep)', border: '1px solid rgba(184,148,58,0.2)' }}>{task.subject}</span>
                            )}
                            <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '20px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`, textTransform: 'capitalize' }}>{task.priority}</span>
                            {task.due_date && (
                              <span style={{ fontSize: '11px', color: overdue ? '#b5473a' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {overdue && <AlertCircle size={11} />}
                                <Calendar size={11} />
                                {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {task.notes && <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>{task.notes}</span>}
                          </div>
                        </div>

                        <button
                          onClick={() => deleteTask(task.id)}
                          style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#b5473a'; (e.currentTarget as HTMLElement).style.background = 'rgba(181,71,58,0.08)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── TAB: AI STUDY PLANNER ── */}
        {activeTab === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
            {planLoading ? (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', background: 'rgba(255,253,247,0.92)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '40px' }}>
                <Loader size={36} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : !activePlan ? (
              /* Generate plan form */
              <div style={{
                background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)',
                border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '32px',
                boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '24px'
              }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <Sparkles size={24} style={{ color: 'var(--accent-primary)' }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'Playfair Display, serif' }}>AI Study Scheduler</h3>
                    <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Upload your syllabus document or type topics to build a customized weekly schedule.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Select Syllabus Document (optional)</label>
                    <select
                      value={selectedDoc}
                      onChange={e => setSelectedDoc(e.target.value)}
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: '12px', fontSize: '14px',
                        background: 'rgba(255,253,247,0.98)', border: '1.5px solid var(--glass-border)',
                        color: 'var(--text-primary)', outline: 'none', cursor: 'pointer',
                      }}
                    >
                      <option value="">— Use text input / All documents —</option>
                      {docs.map(d => <option key={d.id} value={d.id}>{d.original_name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Or Paste Course Topics / Syllabus details</label>
                    <textarea
                      value={plannerTopic}
                      onChange={e => setPlannerTopic(e.target.value)}
                      placeholder="e.g. Advanced Calculus: Limits, Derivatives, Integrals, Taylor Series. Goal is to pass midterms."
                      rows={4}
                      style={{
                        width: '100%', padding: '14px', borderRadius: '12px', fontSize: '14px',
                        background: 'rgba(255,253,247,0.98)', border: '1.5px solid var(--glass-border)',
                        color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                        fontFamily: 'Inter, sans-serif'
                      }}
                    />
                  </div>

                  <div style={{ maxWidth: '320px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Plan Duration (Days)</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={daysDuration}
                      onChange={e => setDaysDuration(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{
                        width: '100%', padding: '12px 16px', borderRadius: '12px', fontSize: '14px',
                        background: 'rgba(255,253,247,0.98)', border: '1.5px solid var(--glass-border)',
                        color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <button
                    onClick={generateSchedule}
                    disabled={generating || (!selectedDoc && !plannerTopic && docs.length === 0)}
                    className="btn btn-primary"
                    style={{ alignSelf: 'flex-start', gap: '10px', padding: '14px 32px', marginTop: '10px' }}
                  >
                    {generating ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={16} />}
                    {generating ? 'Structuring Plan...' : 'Generate Schedule'}
                  </button>
                </div>
              </div>
            ) : (
              /* Display active study plan schedule */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                
                {/* Plan Metadata Board */}
                <div style={{
                  background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)',
                  border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '24px 32px',
                  boxShadow: 'var(--shadow-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px'
                }}>
                  <div>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent-primary)', fontWeight: 700 }}>Active AI Schedule</span>
                    <h3 style={{ margin: '4px 0 0', fontSize: '1.25rem', fontFamily: 'Playfair Display, serif' }}>
                      {activePlan.topic || (activePlan.document_id ? docs.find(d => d.id === activePlan.document_id)?.original_name : 'Custom Study Plan')}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      onClick={() => importScheduleToTasks()}
                      disabled={importing}
                      className="btn btn-primary"
                      style={{ gap: '8px', padding: '10px 20px', fontSize: '13px' }}
                    >
                      {importing ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckSquare size={14} />}
                      Import Entire Plan
                    </button>
                    
                    <button 
                      onClick={deleteSchedule}
                      className="btn btn-secondary"
                      style={{ gap: '8px', padding: '10px 20px', fontSize: '13px', color: '#b5473a', borderColor: 'rgba(181, 71, 58, 0.2)' }}
                    >
                      <Trash size={14} />
                      Clear Plan
                    </button>
                  </div>
                </div>

                {/* Timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activePlan.weeks.map((week) => {
                    const isCollapsed = collapsedWeeks[week.week] !== false;
                    return (
                      <div 
                        key={week.week}
                        style={{
                          background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)',
                          border: '1px solid var(--glass-border)', borderRadius: '16px',
                          overflow: 'hidden', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s'
                        }}
                      >
                        {/* Accordion header */}
                        <div 
                          onClick={() => toggleWeekCollapse(week.week)}
                          style={{
                            padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            cursor: 'pointer', background: isCollapsed ? 'transparent' : 'rgba(184,148,58,0.03)',
                            borderBottom: isCollapsed ? 'none' : '1px solid var(--border-light)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '50%',
                              background: 'rgba(184,148,58,0.1)', color: 'var(--accent-primary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: '14px', flexShrink: 0
                            }}>
                              {week.week}
                            </div>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{week.title}</h4>
                              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{week.goal}</p>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }} onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => importScheduleToTasks(week.week)}
                              disabled={importing}
                              style={{
                                padding: '4px 10px', fontSize: '11px', borderRadius: '6px',
                                background: 'transparent', border: '1px solid var(--accent-light)',
                                color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(184,148,58,0.08)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                              Import Week
                            </button>

                            <button 
                              onClick={() => toggleWeekCollapse(week.week)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                            >
                              {isCollapsed ? 'Expand' : 'Collapse'}
                            </button>
                          </div>
                        </div>

                        {/* Accordion content */}
                        {!isCollapsed && (
                          <div style={{ padding: '24px', background: 'rgba(255,253,247,0.4)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <h5 style={{ margin: 0, fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Study Tasks</h5>
                              {week.tasks.map((task, idx) => {
                                const cfg = priorityConfig[task.priority as 'low'|'medium'|'high'] || priorityConfig['medium'];
                                return (
                                  <div 
                                    key={idx}
                                    style={{
                                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                                      padding: '12px 16px', borderRadius: '10px',
                                      background: '#fff', border: '1px solid var(--glass-border)',
                                      boxShadow: 'var(--shadow-sm)'
                                    }}
                                  >
                                    <div style={{
                                      width: '18px', height: '18px', borderRadius: '4px',
                                      border: '1.5px solid var(--accent-light)', display: 'flex',
                                      alignItems: 'center', justifyContent: 'center', marginTop: '2px',
                                      color: 'var(--accent-primary)'
                                    }}>
                                      <span style={{ fontSize: '10px' }}>•</span>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>{task.title}</p>
                                      {task.notes && <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{task.notes}</p>}
                                    </div>
                                    <span style={{
                                      fontSize: '10px', padding: '2px 8px', borderRadius: '12px',
                                      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}20`,
                                      textTransform: 'capitalize', fontWeight: 600
                                    }}>
                                      {task.priority}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default PlannerPage;
