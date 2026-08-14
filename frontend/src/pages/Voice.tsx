import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { Mic, MicOff, Volume2, VolumeX, Brain, User, Send } from 'lucide-react';
import { API } from '../lib/api';


interface Message { id: string; role: 'user' | 'ai'; content: string; }

// Extend window for Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const VoicePage = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'ai', content: 'Hi! I\'m your voice assistant. Press the microphone button and ask me anything about your uploaded study materials.' }
  ]);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true);
  const [manualInput, setManualInput] = useState('');
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setSupported(false); return; }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      const t = Array.from(event.results).map((r: any) => r[0].transcript).join('');
      setTranscript(t);
      if (event.results[0].isFinal) {
        sendQuery(t);
        setTranscript('');
      }
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleListening = () => {
    if (!supported) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
    } else {
      recognitionRef.current?.start();
      setListening(true);
      setTranscript('');
    }
  };

  const sendQuery = async (query: string) => {
    if (!query.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'ai', content: data.answer };
      setMessages(prev => [...prev, aiMsg]);

      // TTS
      if (ttsEnabled && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(data.answer);
        utter.rate = 0.95;
        utter.pitch = 1;
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) || voices[0];
        if (preferred) utter.voice = preferred;
        window.speechSynthesis.speak(utter);
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: 'Sorry, I encountered an error.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    sendQuery(manualInput);
    setManualInput('');
  };

  return (
    <div className="app-layout-container">
      <div className="bg-blob bg-blob-1" />
      <div className="bg-blob bg-blob-2" />
      <Sidebar />

      <div className="app-main-content" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{
          flex: 1, borderRadius: '20px', overflow: 'hidden',
          background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-md)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontFamily: 'Playfair Display, serif' }}>Voice Assistant</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>Speak or type your questions</p>
            </div>
            <button
              onClick={() => { setTtsEnabled(!ttsEnabled); window.speechSynthesis?.cancel(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px',
                borderRadius: '50px', border: `1.5px solid ${ttsEnabled ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                background: ttsEnabled ? 'rgba(184,148,58,0.08)' : 'transparent',
                color: ttsEnabled ? 'var(--accent-primary)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
              }}
            >
              {ttsEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              {ttsEnabled ? 'TTS On' : 'TTS Off'}
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, padding: '28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', gap: '14px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                  background: msg.role === 'user' ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'rgba(232,213,163,0.3)',
                  border: msg.role === 'ai' ? '1px solid var(--glass-border)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {msg.role === 'user' ? <User size={18} color="#fff" /> : <Brain size={18} style={{ color: 'var(--accent-primary)' }} />}
                </div>
                <div style={{ maxWidth: '70%', padding: '14px 18px', borderRadius: '18px', lineHeight: 1.65, fontSize: '14px',
                  background: msg.role === 'user' ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'rgba(255,253,247,0.98)',
                  border: msg.role === 'ai' ? '1px solid var(--glass-border)' : 'none',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                  borderTopRightRadius: msg.role === 'user' ? '6px' : '18px',
                  borderTopLeftRadius: msg.role === 'ai' ? '6px' : '18px',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: '14px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(232,213,163,0.3)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Brain size={18} style={{ color: 'var(--accent-primary)' }} />
                </div>
                <div style={{ padding: '14px 20px', borderRadius: '18px', borderTopLeftRadius: '6px', background: 'rgba(255,253,247,0.98)', border: '1px solid var(--glass-border)' }}>
                  <div className="typing-indicator"><span /><span /><span /></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice Control + Live Transcript */}
          <div style={{ padding: '24px 28px', borderTop: '1px solid var(--border-light)', background: 'rgba(255,253,247,0.98)' }}>
            {/* Transcript */}
            {transcript && (
              <div style={{ marginBottom: '16px', padding: '10px 16px', borderRadius: '10px', background: 'rgba(184,148,58,0.06)', border: '1px solid rgba(184,148,58,0.2)', fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                🎙️ {transcript}
              </div>
            )}

            {!supported && (
              <div style={{ marginBottom: '12px', padding: '10px 16px', borderRadius: '10px', background: 'rgba(181,71,58,0.06)', border: '1px solid rgba(181,71,58,0.2)', fontSize: '13px', color: '#b5473a' }}>
                Voice recognition is not supported in your browser. Use text input below.
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* Mic Button */}
              <button
                onClick={toggleListening}
                disabled={!supported}
                style={{
                  width: '56px', height: '56px', borderRadius: '50%', border: 'none',
                  background: listening
                    ? 'linear-gradient(135deg, #b5473a, #d4614f)'
                    : supported ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'var(--bg-tertiary)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: supported ? 'pointer' : 'not-allowed',
                  boxShadow: listening ? '0 0 0 8px rgba(181,71,58,0.2), 0 4px 16px rgba(181,71,58,0.4)' : '0 4px 16px rgba(184,148,58,0.35)',
                  transition: 'all 0.3s ease', flexShrink: 0,
                  animation: listening ? 'pulse 1.5s ease-in-out infinite' : 'none',
                }}
              >
                {listening ? <MicOff size={22} /> : <Mic size={22} />}
              </button>

              {/* Text input fallback */}
              <form onSubmit={handleManualSend} style={{ flex: 1, display: 'flex', gap: '10px' }}>
                <input
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  placeholder="Or type your question…"
                  style={{
                    flex: 1, padding: '14px 22px', borderRadius: '50px',
                    background: 'rgba(255,253,247,0.95)', border: '1.5px solid var(--glass-border)',
                    color: 'var(--text-primary)', outline: 'none', fontSize: '14px',
                    fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s',
                  }}
                />
                <button type="submit" disabled={!manualInput.trim() || loading} style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  background: manualInput.trim() && !loading ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' : 'var(--bg-tertiary)',
                  border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: manualInput.trim() && !loading ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}>
                  <Send size={19} />
                </button>
              </form>
            </div>
            <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
              {listening ? '🔴 Listening… speak now' : 'Click the mic to start speaking'}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 8px rgba(181,71,58,0.2), 0 4px 16px rgba(181,71,58,0.4); } 50% { box-shadow: 0 0 0 16px rgba(181,71,58,0.08), 0 4px 16px rgba(181,71,58,0.4); } }
        .typing-indicator span { display: inline-block; width: 8px; height: 8px; background-color: var(--accent-light); border-radius: 50%; margin: 0 2px; animation: bounce 1.4s infinite ease-in-out both; }
        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default VoicePage;
