import { Brain, FileText, LayoutList, Mic, Layers, ArrowRight, Zap, Target, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div style={{ background: 'var(--bg-color)', minHeight: '100vh' }}>
      {/* Background Blobs */}
      <div className="bg-blob bg-blob-1"></div>
      <div className="bg-blob bg-blob-2"></div>
      <div className="bg-blob bg-blob-3"></div>

      {/* Navbar */}
      <nav style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 20px', margin: '12px auto', maxWidth: '1200px', width: '92%',
        background: 'rgba(255,253,247,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-sm)',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(184,148,58,0.3)'
          }}>
            <Brain size={22} color="#fff" />
          </div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, fontFamily: 'Playfair Display, serif', letterSpacing: '0.01em' }}>
            AI Student Companion
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link to="/login" className="btn btn-secondary" style={{ padding: '10px 24px', fontSize: '14px' }}>Login</Link>
          <Link to="/register" className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '14px' }}>Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container py-20 text-center" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'rgba(232,213,163,0.35)', border: '1px solid rgba(184,148,58,0.3)',
          borderRadius: '50px', padding: '6px 18px', marginBottom: '32px',
          fontSize: '13px', color: 'var(--accent-deep)', fontWeight: 500, letterSpacing: '0.04em'
        }}>
          <Star size={13} fill="currentColor" />
          Premium AI Learning Platform — 100% Free
        </div>

        <h1 style={{
          fontSize: 'clamp(2.8rem, 6vw, 5rem)',
          marginBottom: '28px',
          lineHeight: 1.1,
          fontFamily: 'Playfair Display, serif',
          color: 'var(--text-primary)',
          fontWeight: 700,
        }}>
          Your Personal <br />
          <span className="gradient-text">AI Learning Companion</span>
        </h1>

        <p style={{
          fontSize: '1.2rem', color: 'var(--text-secondary)',
          maxWidth: '660px', margin: '0 auto 48px auto', lineHeight: 1.75,
          fontWeight: 300,
        }}>
          Upload notes, chat with PDFs, generate quizzes, summarize content, and learn smarter with AI.
          The ultimate platform designed to elevate your academic journey.
        </p>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" className="btn btn-primary" style={{ padding: '16px 40px', fontSize: '16px' }}>
            Start Learning <ArrowRight size={18} />
          </Link>
          <button className="btn btn-secondary" style={{ padding: '16px 40px', fontSize: '16px' }}>
            Watch Demo
          </button>
        </div>

        {/* Social proof */}
        <div style={{ marginTop: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
          {[['10,000+', 'Students'], ['98%', 'Satisfaction'], ['50+', 'AI Tools']].map(([num, label]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'Playfair Display, serif', background: 'var(--gradient-gold)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>{num}</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '4px 0 0' }}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Decorative Divider */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '20px' }}>
        <div style={{ height: '1px', width: '100px', background: 'linear-gradient(to right, transparent, var(--accent-light))' }}></div>
        <Star size={14} style={{ color: 'var(--accent-primary)' }} fill="currentColor" />
        <div style={{ height: '1px', width: '100px', background: 'linear-gradient(to left, transparent, var(--accent-light))' }}></div>
      </div>

      {/* Features Section */}
      <section className="container py-20">
        <div className="text-center" style={{ marginBottom: '60px' }}>
          <p style={{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '12px' }}>Capabilities</p>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
            Supercharge Your <span className="gradient-text">Learning</span>
          </h2>
          <div className="divider-gold"></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {[
            { icon: FileText,  color: '#b8943a', bg: 'rgba(184,148,58,0.08)',  title: 'PDF Chat & RAG',      desc: 'Upload PDFs, PPTs, or DOCX files and instantly chat with your documents to clarify concepts and find answers fast.' },
            { icon: Target,    color: '#c9a84c', bg: 'rgba(201,168,76,0.08)',  title: 'Quiz Generator',      desc: 'Automatically generate MCQs, true/false, and subjective quizzes based on your course materials to test your knowledge.' },
            { icon: Layers,    color: '#a07828', bg: 'rgba(160,120,40,0.08)', title: 'Smart Flashcards',    desc: 'Turn any document into interactive flashcards in seconds. Use spaced repetition concepts to memorize effectively.' },
            { icon: LayoutList,color: '#b89050', bg: 'rgba(184,144,80,0.08)', title: 'Study Planner',       desc: 'Input your exam dates and subjects, and let AI generate a customized daily and weekly study roadmap for you.' },
            { icon: Mic,       color: '#c4a060', bg: 'rgba(196,160,96,0.08)', title: 'Voice Assistant',     desc: 'Talk to your AI mentor. Ask it to summarize units, explain complex data structures, or simply guide your learning.' },
            { icon: Zap,       color: '#8a6820', bg: 'rgba(138,104,32,0.08)', title: 'Career Mentor',       desc: "Set a career goal like 'AI Engineer' or 'Data Scientist' and receive a personalized learning path and project ideas." },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className="glass-card glow-effect" style={{ borderTop: `3px solid ${color}22` }}>
              <div style={{ background: bg, width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', border: `1px solid ${color}22` }}>
                <Icon size={26} style={{ color }} />
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '10px', fontFamily: 'Playfair Display, serif' }}>{title}</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '14px' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-20 text-center">
        <div style={{
          padding: '72px 48px', maxWidth: '780px', margin: '0 auto',
          background: 'linear-gradient(135deg, rgba(255,253,247,0.95) 0%, rgba(240,232,216,0.95) 100%)',
          border: '1px solid var(--glass-border)',
          borderRadius: '28px',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'radial-gradient(ellipse at top, rgba(232,213,163,0.3) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}></div>
          <p style={{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '16px' }}>Get Started Today</p>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '16px' }}>100% Free Learning Platform</h2>
          <div className="divider-gold"></div>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', margin: '24px auto 36px', maxWidth: '520px', lineHeight: 1.7 }}>
            Education should be accessible to everyone. Experience premium AI tools without the premium price tag.
          </p>
          <Link to="/register" className="btn btn-primary" style={{ padding: '18px 48px', fontSize: '16px' }}>
            Start Learning Now <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        margin: '20px 24px 24px',
        padding: '40px 32px',
        background: 'rgba(255,253,247,0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: '16px',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Brain size={18} color="#fff" />
          </div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>AI Student Companion</h3>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>© 2026 AI Student Companion. Crafted for the future of education.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
