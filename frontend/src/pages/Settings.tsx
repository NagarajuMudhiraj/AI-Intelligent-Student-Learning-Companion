import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { User, Lock, Trash2, Loader, CheckCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { API } from '../lib/api';


interface Profile {
  id: string;
  email: string;
  full_name: string;
  education?: string;
  skills?: string[];
  interests?: string[];
  goals?: string;
  preferences?: string[];
}

const PREF_OPTIONS = ['High Salary', 'Research', 'Startup', 'MNC', 'Remote Work', 'Government Jobs'];

const SettingsPage = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'profile' | 'security' | 'danger'>('profile');
  const [fullName, setFullName] = useState('');
  const [education, setEducation] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [interestsInput, setInterestsInput] = useState('');
  const [goals, setGoals] = useState('');
  const [preferences, setPreferences] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError] = useState('');
  const [passSaved, setPassSaved] = useState(false);
  const [showCurr, setShowCurr] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetch(`${API}/settings/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(p => {
        setProfile(p);
        setFullName(p.full_name);
        setEducation(p.education || '');
        setSkillsInput((p.skills || []).join(', '));
        setInterestsInput((p.interests || []).join(', '));
        setGoals(p.goals || '');
        setPreferences(p.preferences || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const skills = skillsInput.split(',').map(s => s.trim()).filter(Boolean);
    const interests = interestsInput.split(',').map(i => i.trim()).filter(Boolean);
    
    try {
      const res = await fetch(`${API}/settings/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          full_name: fullName,
          education: education,
          skills: skills,
          interests: interests,
          goals: goals,
          preferences: preferences
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setFullName(updated.full_name);
        setEducation(updated.education || '');
        setSkillsInput((updated.skills || []).join(', '));
        setInterestsInput((updated.interests || []).join(', '));
        setGoals(updated.goals || '');
        setPreferences(updated.preferences || []);
        
        // Keep localStorage in sync so Dashboard reflects the new name immediately
        localStorage.setItem('user_name', updated.full_name || '');
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    if (newPass !== confirmPass) { setPassError('Passwords do not match'); return; }
    if (newPass.length < 8) { setPassError('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/settings/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: currPass, new_password: newPass }),
      });
      if (!res.ok) { const e = await res.json(); setPassError(e.detail); return; }
      setCurrPass(''); setNewPass(''); setConfirmPass('');
      setPassSaved(true);
      setTimeout(() => setPassSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (!confirm('This will permanently delete your account and all data. This cannot be undone. Continue?')) return;
    await fetch(`${API}/settings/account`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    // Clear all user data from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_id');
    navigate('/');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: '10px', fontSize: '14px',
    border: '1.5px solid var(--glass-border)', background: 'rgba(255,253,247,0.8)',
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'Inter, sans-serif',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px',
  };

  const tabs = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'security', label: 'Security', icon: Lock },
    { key: 'danger',   label: 'Danger Zone', icon: AlertTriangle },
  ] as const;

  return (
    <div className="app-layout-container">
      <div className="bg-blob bg-blob-1" />
      <div className="bg-blob bg-blob-2" />
      <Sidebar />

      <div className="app-main-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header */}
        <div style={{ background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '20px 24px', boxShadow: 'var(--shadow-sm)' }}>
          <p style={{ fontSize: '12px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '6px' }}>Account</p>
          <h1 style={{ fontSize: '1.8rem', margin: 0 }}>Settings & <span className="gradient-text">Profile</span></h1>
        </div>

        <div style={{ display: 'flex', gap: '20px', flex: 1, flexWrap: 'wrap' }}>
          {/* Tab Nav */}
          <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px', borderRadius: '12px', textAlign: 'left', width: '100%',
                  background: tab === key
                    ? key === 'danger' ? 'rgba(181,71,58,0.08)' : 'rgba(184,148,58,0.1)'
                    : 'rgba(255,253,247,0.7)',
                  border: `1px solid ${tab === key
                    ? key === 'danger' ? 'rgba(181,71,58,0.25)' : 'rgba(184,148,58,0.25)'
                    : 'var(--glass-border)'}`,
                  color: tab === key
                    ? key === 'danger' ? '#b5473a' : 'var(--accent-deep)'
                    : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: '13px', fontWeight: tab === key ? 600 : 400,
                  fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '32px', boxShadow: 'var(--shadow-sm)' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <Loader size={32} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : (
              <>
                {/* Profile Tab */}
                {tab === 'profile' && (
                  <div>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Profile Information</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '28px' }}>Update your account display name</p>

                    {/* Avatar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
                      <div style={{
                        width: '72px', height: '72px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.8rem', fontWeight: 700, color: '#fff',
                        boxShadow: '0 8px 24px rgba(184,148,58,0.35)',
                      }}>
                        {(fullName || profile?.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '16px' }}>{fullName || 'Student'}</p>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>{profile?.email}</p>
                      </div>
                    </div>

                    <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '500px' }}>
                      <div>
                        <label style={labelStyle}>Full Name</label>
                        <input style={inputStyle} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
                      </div>
                      <div>
                        <label style={labelStyle}>Email Address</label>
                        <input style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} value={profile?.email} disabled />
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Email cannot be changed</p>
                      </div>
                      <div>
                        <label style={labelStyle}>Education Information</label>
                        <input style={inputStyle} value={education} onChange={e => setEducation(e.target.value)} placeholder="e.g. B.Tech CSE (3rd Year)" />
                      </div>
                      <div>
                        <label style={labelStyle}>Career Goals</label>
                        <input style={inputStyle} value={goals} onChange={e => setGoals(e.target.value)} placeholder="e.g. Machine Learning Engineer" />
                      </div>
                      <div>
                        <label style={labelStyle}>Skills (comma-separated)</label>
                        <input style={inputStyle} value={skillsInput} onChange={e => setSkillsInput(e.target.value)} placeholder="e.g. Python, SQL, Machine Learning" />
                      </div>
                      <div>
                        <label style={labelStyle}>Interests (comma-separated)</label>
                        <input style={inputStyle} value={interestsInput} onChange={e => setInterestsInput(e.target.value)} placeholder="e.g. AI, RAG, Web Dev" />
                      </div>
                      <div>
                        <label style={labelStyle}>Career Preferences</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px', background: 'rgba(255,253,247,0.5)', padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                          {PREF_OPTIONS.map(pref => {
                            const isChecked = preferences.includes(pref);
                            return (
                              <label key={pref} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setPreferences(prev =>
                                      prev.includes(pref) ? prev.filter(p => p !== pref) : [...prev, pref]
                                    );
                                  }}
                                  style={{ accentColor: 'var(--accent-primary)' }}
                                />
                                {pref}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                        <button type="submit" disabled={saving} className="btn btn-primary" style={{ gap: '8px' }}>
                          {saving ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                          Save Changes
                        </button>
                        {saved && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3aaa5c', fontSize: '14px' }}>
                            <CheckCircle size={16} /> Saved! Cache Updated!
                          </div>
                        )}
                      </div>
                    </form>
                  </div>
                )}

                {/* Security Tab */}
                {tab === 'security' && (
                  <div>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Change Password</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '28px' }}>Choose a strong, unique password</p>

                    <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '440px' }}>
                      {[
                        { label: 'Current Password', value: currPass, setter: setCurrPass, show: showCurr, toggle: () => setShowCurr(!showCurr) },
                        { label: 'New Password', value: newPass, setter: setNewPass, show: showNew, toggle: () => setShowNew(!showNew) },
                        { label: 'Confirm New Password', value: confirmPass, setter: setConfirmPass, show: showNew, toggle: () => setShowNew(!showNew) },
                      ].map(({ label, value, setter, show, toggle }) => (
                        <div key={label}>
                          <label style={labelStyle}>{label}</label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={show ? 'text' : 'password'}
                              style={{ ...inputStyle, paddingRight: '44px' }}
                              value={value}
                              onChange={e => setter(e.target.value)}
                              required
                            />
                            <button type="button" onClick={toggle} style={{
                              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                              display: 'flex', alignItems: 'center',
                            }}>
                              {show ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                      ))}

                      {passError && (
                        <p style={{ color: '#b5473a', fontSize: '13px', margin: 0 }}>{passError}</p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button type="submit" disabled={saving} className="btn btn-primary" style={{ gap: '8px' }}>
                          {saving ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Lock size={15} />}
                          Update Password
                        </button>
                        {passSaved && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3aaa5c', fontSize: '14px' }}>
                            <CheckCircle size={16} /> Password updated!
                          </div>
                        )}
                      </div>
                    </form>
                  </div>
                )}

                {/* Danger Zone Tab */}
                {tab === 'danger' && (
                  <div>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#b5473a' }}>Danger Zone</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '28px' }}>These actions are irreversible. Please proceed with caution.</p>

                    <div style={{ padding: '24px', borderRadius: '14px', border: '1.5px solid rgba(181,71,58,0.3)', background: 'rgba(181,71,58,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                          <p style={{ fontWeight: 600, color: '#b5473a', margin: 0, fontSize: '15px' }}>Delete Account</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                            Permanently deletes your account, all documents, quizzes, and data.
                          </p>
                        </div>
                        <button
                          onClick={deleteAccount}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '11px 22px', borderRadius: '50px', fontSize: '14px',
                            background: 'transparent', border: '1.5px solid #b5473a',
                            color: '#b5473a', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                            fontWeight: 500, transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#b5473a'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#b5473a'; }}
                        >
                          <Trash2 size={15} /> Delete Account
                        </button>
                      </div>
                    </div>
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

export default SettingsPage;
