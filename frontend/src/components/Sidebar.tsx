import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, FileText, MessageSquare, Target, Layers,
  LayoutList, Mic, Zap, BarChart2, Settings, LogOut, Menu, X, Download
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Close drawer on path change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const menuItems = [
    { path: '/dashboard',  icon: Home,         label: 'Home' },
    { path: '/documents',  icon: FileText,      label: 'My Documents' },
    { path: '/chat',       icon: MessageSquare, label: 'AI Chat' },
    { path: '/quizzes',    icon: Target,        label: 'Quiz Generator' },
    { path: '/flashcards', icon: Layers,        label: 'Flashcards' },
    { path: '/planner',    icon: LayoutList,    label: 'Study Planner' },
    { path: '/voice',      icon: Mic,           label: 'Voice Assistant' },
    { path: '/career',     icon: Zap,           label: 'Career Mentor' },
    { path: '/analytics',  icon: BarChart2,     label: 'Analytics' },
    { path: '/settings',   icon: Settings,      label: 'Settings' },
  ];

  const currentItem = menuItems.find(item => item.path === location.pathname);

  return (
    <>
      {/* ── Mobile Top Header Bar (Visible on < 1024px) ────────────────── */}
      <div className="mobile-header-bar" style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 900,
        background: 'rgba(255, 253, 247, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--glass-border)',
        padding: '12px 16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle navigation menu"
            style={{
              background: 'transparent',
              border: '1px solid var(--glass-border)',
              borderRadius: '10px',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <span style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: '1.2rem',
            fontWeight: 700,
            background: 'var(--gradient-gold)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            AI Student
          </span>
        </div>

        {currentItem && (
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--accent-deep)',
            background: 'rgba(184,148,58,0.1)',
            padding: '4px 10px',
            borderRadius: '20px',
            border: '1px solid rgba(184,148,58,0.2)',
          }}>
            {currentItem.label}
          </span>
        )}
      </div>

      {/* ── Mobile Backdrop Overlay ────────────────────────────────────── */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 998,
            background: 'rgba(26, 18, 8, 0.4)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* ── Main Sidebar / Responsive Drawer Container ─────────────────── */}
      <div
        className={`sidebar-nav-container ${isOpen ? 'mobile-open' : ''}`}
        style={{
          width: '260px',
          margin: '20px',
          padding: '24px 16px',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 40px)',
          position: 'sticky',
          top: '20px',
          background: 'rgba(255,253,247,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--shadow-md)',
          zIndex: 999,
          transition: 'transform 0.3s ease, opacity 0.3s ease',
        }}
      >
        {/* Brand */}
        <div style={{ marginBottom: '28px', paddingLeft: '8px', paddingBottom: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: '1.2rem',
            fontWeight: 700,
            background: 'var(--gradient-gold)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.01em',
          }}>
            AI Student
          </span>
          <button
            className="mobile-close-btn"
            onClick={() => setIsOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto' }}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '11px 14px',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  color: isActive ? 'var(--accent-deep)' : 'var(--text-secondary)',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(184,148,58,0.12), rgba(201,168,76,0.08))'
                    : 'transparent',
                  border: isActive ? '1px solid rgba(184,148,58,0.25)' : '1px solid transparent',
                  transition: 'all 0.2s ease',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '14px',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(232,213,163,0.2)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <item.icon
                  size={18}
                  style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)', flexShrink: 0 }}
                />
                <span>{item.label}</span>
                {isActive && (
                  <div style={{
                    marginLeft: 'auto', width: '6px', height: '6px',
                    borderRadius: '50%', background: 'var(--accent-primary)',
                    flexShrink: 0,
                  }}></div>
                )}
              </Link>
            );
          })}
        </div>

        {/* Bottom Actions: Install App & Sign Out */}
        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 14px',
              width: '100%',
              background: 'linear-gradient(135deg, rgba(184,148,58,0.1), rgba(201,168,76,0.15))',
              border: '1px solid rgba(184,148,58,0.3)',
              borderRadius: '12px',
              color: 'var(--accent-deep)',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(184,148,58,0.2), rgba(201,168,76,0.25))';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(184,148,58,0.1), rgba(201,168,76,0.15))';
            }}
            onClick={() => {
              setIsOpen(false);
              window.dispatchEvent(new CustomEvent('pwa-trigger-install'));
            }}
          >
            <Download size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <span>Install App</span>
          </button>

          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 14px',
              width: '100%',
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: '12px',
              color: '#b5473a',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(181,71,58,0.06)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(181,71,58,0.15)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
            }}
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user_name');
              localStorage.removeItem('user_email');
              window.location.href = '/login';
            }}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      <style>{`
        .mobile-header-bar {
          display: none;
        }

        .mobile-close-btn {
          display: none;
        }

        @media (max-width: 1024px) {
          .mobile-header-bar {
            display: flex;
          }

          .mobile-close-btn {
            display: block;
          }

          .sidebar-nav-container {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            bottom: 0 !important;
            height: 100vh !important;
            margin: 0 !important;
            border-radius: 0 20px 20px 0 !important;
            transform: translateX(-100%);
            box-shadow: 0 0 30px rgba(0,0,0,0.2) !important;
          }

          .sidebar-nav-container.mobile-open {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
};

export default Sidebar;
