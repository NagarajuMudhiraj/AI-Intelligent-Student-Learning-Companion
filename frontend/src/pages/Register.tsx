import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Brain, User, Mail, Lock, ArrowRight, Loader, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { API } from '../lib/api';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password strength checks
  const pwMinLength = password.length >= 8;
  const pwHasLetter = /[a-zA-Z]/.test(password);
  const pwHasNumber = /[0-9]/.test(password);
  const pwStrong = pwMinLength && pwHasLetter && pwHasNumber;

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Google authentication failed');
      }

      const tokenData = await res.json();
      localStorage.setItem('token', tokenData.access_token);

      const userRes = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        localStorage.setItem('user_name', userData.full_name);
        localStorage.setItem('user_email', userData.email);
      }

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong with Google Login.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!pwStrong) {
      setError('Password must be at least 8 characters and include a letter and a number.');
      return;
    }

    setLoading(true);

    try {
      // 1. Register User
      const regRes = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password,
          full_name: fullName,
        }),
      });

      if (!regRes.ok) {
        const errData = await regRes.json().catch(() => ({}));
        throw new Error(errData.detail || 'Registration failed. Try a different email.');
      }

      // 2. Auto Login User
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const loginRes = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (loginRes.ok) {
        const tokenData = await loginRes.json();
        localStorage.setItem('token', tokenData.access_token);
        localStorage.setItem('user_name', fullName);
        localStorage.setItem('user_email', email);
        navigate('/dashboard');
      } else {
        navigate('/login');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-color)',
      padding: '20px',
      position: 'relative',
    }}>
      {/* Background Blobs */}
      <div className="bg-blob bg-blob-1" style={{ width: '400px', height: '400px' }}></div>
      <div className="bg-blob bg-blob-2" style={{ width: '400px', height: '400px' }}></div>

      <div style={{ position: 'absolute', top: '24px', left: '24px' }}>
        <Link to="/" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: 500,
          transition: 'color 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <ArrowLeft size={16} /> Back to Home
        </Link>
      </div>

      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(255, 253, 247, 0.92)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: '24px',
        padding: '40px 32px',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
      }} className="glow-effect">
        
        {/* Logo and title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(184,148,58,0.3)',
          }}>
            <Brain size={26} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem', margin: 0, fontFamily: 'Playfair Display, serif' }}>Create Account</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Start your AI-powered learning journey</p>
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(181, 71, 58, 0.1)',
            border: '1px solid rgba(181, 71, 58, 0.25)',
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#b5473a',
            fontSize: '14px',
            fontWeight: 500,
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              setError('Google Sign In was unsuccessful. Try again later.');
            }}
            useOneTap
            shape="pill"
            theme="outline"
            text="signup_with"
            size="large"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Full Name field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="John Doe"
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 44px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--glass-border)',
                  background: 'rgba(255, 253, 247, 0.6)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--accent-primary)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(184,148,58,0.1)';
                  e.target.style.background = '#fff';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'var(--glass-border)';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = 'rgba(255, 253, 247, 0.6)';
                }}
              />
            </div>
          </div>

          {/* Email field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 44px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--glass-border)',
                  background: 'rgba(255, 253, 247, 0.6)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--accent-primary)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(184,148,58,0.1)';
                  e.target.style.background = '#fff';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'var(--glass-border)';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = 'rgba(255, 253, 247, 0.6)';
                }}
              />
            </div>
          </div>

          {/* Password field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 44px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--glass-border)',
                  background: 'rgba(255, 253, 247, 0.6)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--accent-primary)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(184,148,58,0.1)';
                  e.target.style.background = '#fff';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'var(--glass-border)';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = 'rgba(255, 253, 247, 0.6)';
                }}
              />
            </div>
            {/* Password strength hints */}
            {password.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                {[
                  { ok: pwMinLength, text: 'At least 8 characters' },
                  { ok: pwHasLetter, text: 'Contains a letter' },
                  { ok: pwHasNumber, text: 'Contains a number' },
                ].map(({ ok, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: ok ? '#3aaa5c' : '#b5473a' }}>
                    {ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {text}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              padding: '14px',
              fontSize: '15px',
              borderRadius: '12px',
              marginTop: '10px',
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            {loading ? (
              <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <>
                Register <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{
          textAlign: 'center',
          fontSize: '14px',
          color: 'var(--text-secondary)',
          borderTop: '1px solid var(--glass-border)',
          paddingTop: '20px',
          marginTop: '4px',
        }}>
          Already have an account?{' '}
          <Link to="/login" style={{
            color: 'var(--accent-deep)',
            fontWeight: 600,
            textDecoration: 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
          onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            Login
          </Link>
        </div>
      </div>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default RegisterPage;
