import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { jsPDF } from 'jspdf';
import {
  Send,
  FileText,
  Upload,
  Loader,
  User,
  Brain,
  Plus,
  MessageSquare,
  Edit2,
  Trash2,
  Check,
  X,
  Download,
} from 'lucide-react';
import { API } from '../lib/api';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  sources?: string[];
  follow_up_suggestions?: string[];
}

interface QueryBody {
  query: string;
  document_id?: string;
  session_id?: string;
}

interface Session {
  id: string;
  title: string;
  document_id?: string;
  created_at: string;
  updated_at: string;
}

const ChatPage = () => {
  const location = useLocation();
  const locationState = location.state as { documentId?: string; documentName?: string } | null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>(locationState?.documentId);
  const [selectedDocName, setSelectedDocName] = useState<string | undefined>(locationState?.documentName);
  
  // Sessions State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [clearingMemory, setClearingMemory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('token');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  // Load chat sessions
  const loadSessions = async (docId?: string) => {
    if (!token) return;
    try {
      const docQueryParam = docId ? `document_id=${docId}` : '';
      const response = await fetch(`${API}/chat/sessions?${docQueryParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setSessions(data);

      if (data.length > 0) {
        // Set the most recently updated session active
        setActiveSessionId(data[0].id);
      } else {
        // Auto-create a default session
        const createRes = await fetch(`${API}/chat/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: 'New Chat', document_id: docId }),
        });
        if (createRes.ok) {
          const newSession = await createRes.json();
          setSessions([newSession]);
          setActiveSessionId(newSession.id);
        }
      }
    } catch (e) {
      console.error('Failed to load sessions', e);
    }
  };

  // Load sessions when selectedDocId or token changes
  useEffect(() => {
    loadSessions(selectedDocId);
  }, [selectedDocId, token]);

  // Load chat history for the active session
  useEffect(() => {
    if (!token || !activeSessionId) {
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    fetch(`${API}/chat/history?session_id=${activeSessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then((history: { id: string; role: string; content: string; sources?: string[]; follow_up_suggestions?: string[] }[]) => {
        if (history.length > 0) {
          const mapped: Message[] = history.map(m => ({
            id: m.id,
            role: m.role === 'assistant' ? 'ai' : 'user',
            content: m.content,
            sources: m.sources || [],
            follow_up_suggestions: m.follow_up_suggestions || [],
          }));
          setMessages(mapped);
        } else {
          setMessages([{
            id: 'welcome',
            role: 'ai',
            content: selectedDocName
              ? `Loaded **"${selectedDocName}"**. Ask me anything about it!`
              : 'Hello! Upload a document or select an existing one to start chatting. I\'ll answer questions based on your study materials.',
            follow_up_suggestions: [
              "Can you summarize the document?",
              "What are the main concepts here?",
              "Generate a quick study guide."
            ]
          }]);
        }
      })
      .catch(() => {
        setMessages([{
          id: 'welcome',
          role: 'ai',
          content: 'Hello! Start asking questions about your study materials.',
        }]);
      })
      .finally(() => setHistoryLoading(false));
  }, [activeSessionId, token]);

  // Handle new session creation
  const handleNewSession = async () => {
    if (!token) return;
    try {
      const createRes = await fetch(`${API}/chat/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: 'New Chat', document_id: selectedDocId }),
      });
      if (createRes.ok) {
        const newSession = await createRes.json();
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
      }
    } catch (e) {
      console.error('Failed to create new session', e);
    }
  };

  // Handle session renaming
  const handleStartRename = (session: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitleInput(session.title);
  };

  const handleSaveRename = async (sessionId: string) => {
    if (!editTitleInput.trim() || !token) return;
    try {
      const res = await fetch(`${API}/chat/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: editTitleInput }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSessions(prev => prev.map(s => s.id === sessionId ? updated : s));
        setEditingSessionId(null);
      }
    } catch (e) {
      console.error('Failed to rename session', e);
    }
  };

  // Handle session deletion
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token || !window.confirm('Are you sure you want to delete this conversation?')) return;
    try {
      const res = await fetch(`${API}/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const updated = sessions.filter(s => s.id !== sessionId);
        setSessions(updated);
        
        if (activeSessionId === sessionId) {
          if (updated.length > 0) {
            setActiveSessionId(updated[0].id);
          } else {
            handleNewSession();
          }
        }
      }
    } catch (e) {
      console.error('Failed to delete session', e);
    }
  };

  // Handle clearing conversation memory and history
  const handleClearMemory = async () => {
    if (!activeSessionId || !token) return;
    if (!window.confirm("Are you sure you want to clear conversation memory and history? This resets the AI context for this session.")) return;
    
    setClearingMemory(true);
    try {
      const res = await fetch(`${API}/chat/sessions/${activeSessionId}/clear-memory`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMessages([{
          id: 'welcome',
          role: 'ai',
          content: 'Hello! I have cleared my memory and history for this session. What topic would you like to study next?',
          follow_up_suggestions: [
            "Can you summarize the document?",
            "What are the main concepts here?",
            "Generate a quick study guide."
          ]
        }]);
        alert("Conversation memory and history cleared successfully.");
      } else {
        alert("Failed to clear conversation memory.");
      }
    } catch (e) {
      console.error('Failed to clear memory', e);
    } finally {
      setClearingMemory(false);
    }
  };

  // Handle Send Message (supports custom text input for follow-ups)
  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || input;
    if (!textToSend.trim() || !token) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: textToSend };
    setMessages(prev => [...prev, userMessage]);
    if (!customText) setInput('');
    setLoading(true);

    try {
      const body: QueryBody = { query: userMessage.content };
      if (selectedDocId) body.document_id = selectedDocId;
      if (activeSessionId) body.session_id = activeSessionId;

      const response = await fetch(`${API}/chat/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to get response');
      const data = await response.json();

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: data.answer,
        sources: data.sources,
        follow_up_suggestions: data.follow_up_suggestions || [],
      }]);

      if (data.session_id && data.session_id !== activeSessionId) {
        setActiveSessionId(data.session_id);
      }
      
      // Refresh session titles/sorting
      loadSessions(selectedDocId);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'ai',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Handle clicking follow-up suggestion
  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(undefined, suggestion);
  };

  // Handle file uploads
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API}/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      const doc = await response.json();

      setSelectedDocId(doc.id);
      setSelectedDocName(doc.original_name);

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'ai',
        content: `✅ Successfully uploaded **"${file.name}"**! It's being processed in the background. You can start asking questions about it in a moment.`,
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'ai',
        content: '❌ Failed to upload document. Please check the file type (PDF, DOCX, PPTX, TXT) and try again.',
      }]);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Handle Export Conversation as PDF
  const handleExportPDF = () => {
    if (messages.length === 0) return;
    const doc = new jsPDF();
    
    // Header section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(184, 148, 58); // Gold color matching theme
    doc.text('AI Study Buddy', 20, 25);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const dateStr = new Date().toLocaleDateString();
    doc.text(`Conversation Export - ${dateStr}`, 20, 32);
    
    const activeSession = sessions.find(s => s.id === activeSessionId);
    const title = activeSession ? activeSession.title : 'Chat Session';
    const docName = selectedDocName || 'All Documents';
    
    doc.setFont('helvetica', 'bold');
    doc.text(`Session: ${title}`, 20, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(`Document Focus: ${docName}`, 20, 48);
    
    // Line separator
    doc.setDrawColor(220, 220, 220);
    doc.line(20, 52, 190, 52);
    
    let yPos = 62;
    const pageHeight = doc.internal.pageSize.height;
    
    messages.forEach((msg) => {
      // Skip welcome message if other messages exist
      if (msg.id === 'welcome' && messages.length > 1) return;
      
      const isUser = msg.role === 'user';
      const sender = isUser ? 'Student' : 'Companion';
      
      // Strip markdown annotations for cleaner PDF rendering
      const cleanContent = msg.content
        .replace(/`{3,}/g, '') // code fences
        .replace(/`([^`]+)`/g, '$1') // inline code
        .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
        .replace(/\*([^*]+)\*/g, '$1'); // italic
        
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(isUser ? 184 : 40, isUser ? 148 : 40, isUser ? 58 : 40);
      
      doc.text(`${sender}:`, 20, yPos);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      
      const textLines = doc.splitTextToSize(cleanContent, 160);
      
      if (yPos + (textLines.length * 6) + 15 > pageHeight) {
        doc.addPage();
        yPos = 25;
      }
      
      textLines.forEach((line: string) => {
        doc.text(line, 20, yPos + 6);
        yPos += 6;
      });
      
      yPos += 12; // Gap between messages
    });
    
    // Page Numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pageCount}`, 190 - 20, pageHeight - 10, { align: 'right' });
    }
    
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_chat.pdf`;
    doc.save(filename);
  };

  return (
    <div className="app-layout-container">
      <div className="bg-blob bg-blob-1"></div>
      <div className="bg-blob bg-blob-2"></div>

      <Sidebar />

      {/* Main Container splits into Sidebar-Sessions + Active Chat Window */}
      <div className="app-main-content" style={{ display: 'flex', flexDirection: 'row', gap: '16px', flexWrap: 'wrap' }}>
        
        {/* Chat Sessions List Panel */}
        <div style={{
          width: '260px',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          background: 'rgba(255,253,247,0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--shadow-md)',
          padding: '20px 14px',
          overflow: 'hidden',
          flexShrink: 0
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 6px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, fontFamily: 'Playfair Display, serif', color: 'var(--text-primary)' }}>Chat Sessions</h3>
            <button
              onClick={handleNewSession}
              title="Start New Chat"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '28px', height: '28px', borderRadius: '50%',
                backgroundColor: 'rgba(184,148,58,0.1)', color: 'var(--accent-primary)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--accent-primary)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(184,148,58,0.1)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Session List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {sessions.map(s => {
              const isActive = s.id === activeSessionId;
              const isEditing = s.id === editingSessionId;
              
              return (
                <div
                  key={s.id}
                  onClick={() => !isEditing && setActiveSessionId(s.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    cursor: isEditing ? 'default' : 'pointer',
                    background: isActive ? 'linear-gradient(135deg, rgba(184,148,58,0.12), rgba(232,213,163,0.18))' : 'transparent',
                    border: isActive ? '1px solid rgba(184,148,58,0.25)' : '1px solid transparent',
                    color: isActive ? 'var(--accent-deep)' : 'var(--text-primary)',
                    transition: 'all 0.2s',
                    position: 'relative',
                  }}
                  className={`session-item ${isActive ? 'active' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    <MessageSquare size={14} style={{ flexShrink: 0, color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editTitleInput}
                        onChange={e => setEditTitleInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveRename(s.id);
                          if (e.key === 'Escape') setEditingSessionId(null);
                        }}
                        autoFocus
                        style={{
                          width: '100%',
                          border: '1.5px solid var(--accent-primary)',
                          background: '#fff',
                          borderRadius: '6px',
                          padding: '2px 6px',
                          fontSize: '13px',
                          outline: 'none',
                          fontFamily: 'Inter, sans-serif'
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isActive ? 500 : 400 }}>
                        {s.title}
                      </span>
                    )}
                  </div>

                  {/* Actions (visible on hover) */}
                  {!isEditing && (
                    <div className="session-actions" style={{ display: 'flex', gap: '2px', opacity: isActive ? 1 : 0 }}>
                      <button
                        onClick={(e) => handleStartRename(s, e)}
                        title="Rename Chat"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}
                      >
                        <Edit2 size={12} className="action-icon" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteSession(s.id, e)}
                        title="Delete Chat"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}
                      >
                        <Trash2 size={12} className="action-icon" />
                      </button>
                    </div>
                  )}
                  
                  {isEditing && (
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button
                        onClick={() => handleSaveRename(s.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'green' }}
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={() => setEditingSessionId(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'red' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Chat Window */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', borderRadius: '20px', overflow: 'hidden',
          background: 'rgba(255,253,247,0.92)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--shadow-md)',
        }}>

          {/* Chat Header */}
          <div style={{
            padding: '20px 28px',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(255,253,247,0.95)',
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontFamily: 'Playfair Display, serif' }}>AI Document Chat</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {selectedDocName
                  ? <>Focused on: <strong style={{ color: 'var(--accent-primary)' }}>{selectedDocName}</strong></>
                  : 'Ask questions about your uploaded study materials'
                }
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  background: 'rgba(58,170,92,0.08)', border: '1px solid rgba(58,170,92,0.25)',
                  padding: '2px 8px', borderRadius: '8px', fontSize: '10.5px', fontWeight: 600,
                  color: '#3aaa5c', fontFamily: 'Inter, sans-serif'
                }}>
                  ⚡ Cache Optimized
                </span>
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Clear Memory Button */}
              <button
                onClick={handleClearMemory}
                disabled={clearingMemory || messages.length <= 1}
                className="btn btn-secondary"
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 20px', fontSize: '13px', cursor: (clearingMemory || messages.length <= 1) ? 'not-allowed' : 'pointer',
                  opacity: (clearingMemory || messages.length <= 1) ? 0.5 : 1,
                  borderColor: 'rgba(181, 71, 58, 0.3)', color: '#b5473a',
                  background: 'rgba(181, 71, 58, 0.04)',
                  margin: 0
                }}
              >
                {clearingMemory ? <Loader className="spin" size={15} /> : <Trash2 size={15} />}
                Clear Memory
              </button>

              {/* PDF Export Button */}
              <button
                onClick={handleExportPDF}
                disabled={messages.length <= 1}
                className="btn btn-secondary"
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 20px', fontSize: '13px', cursor: messages.length <= 1 ? 'not-allowed' : 'pointer',
                  opacity: messages.length <= 1 ? 0.5 : 1,
                  margin: 0
                }}
              >
                <Download size={15} />
                Export Chat
              </button>

              <input
                type="file" id="file-upload" style={{ display: 'none' }}
                onChange={handleFileUpload}
                accept=".pdf,.docx,.pptx,.txt"
              />
              <label htmlFor="file-upload" className="btn btn-secondary" style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 20px', fontSize: '13px', cursor: 'pointer',
                margin: 0
              }}>
                {uploading ? <Loader className="spin" size={16} /> : <Upload size={16} />}
                Upload Document
              </label>
            </div>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1, padding: '28px', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: '20px',
          }}>
            {historyLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                <Loader size={28} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : (
              messages.map((msg) => {
                const isLastAIMessage = messages.length > 0 && messages[messages.length - 1].id === msg.id && msg.role === 'ai';
                return (
                  <div key={msg.id} style={{
                    display: 'flex', gap: '14px',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                      background: msg.role === 'user'
                        ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                        : 'rgba(232,213,163,0.3)',
                      border: msg.role === 'ai' ? '1px solid var(--glass-border)' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: msg.role === 'user' ? '0 4px 12px rgba(184,148,58,0.3)' : 'none',
                    }}>
                      {msg.role === 'user'
                        ? <User size={18} color="#fff" />
                        : <Brain size={18} style={{ color: 'var(--accent-primary)' }} />
                      }
                    </div>

                    {/* Bubble */}
                    <div style={{
                      maxWidth: '68%', display: 'flex', flexDirection: 'column',
                      alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}>
                      <div style={{
                        padding: '14px 18px',
                        borderRadius: '18px',
                        background: msg.role === 'user'
                          ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                          : 'rgba(255,253,247,0.98)',
                        border: msg.role === 'ai' ? '1px solid var(--glass-border)' : 'none',
                        boxShadow: msg.role === 'user'
                          ? '0 4px 16px rgba(184,148,58,0.25)'
                          : 'var(--shadow-sm)',
                        borderTopRightRadius: msg.role === 'user' ? '6px' : '18px',
                        borderTopLeftRadius: msg.role === 'ai' ? '6px' : '18px',
                        color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                        lineHeight: 1.65, fontSize: '14px',
                      }}>
                        {msg.role === 'ai' ? (
                          <div className="markdown-body">
                            <ReactMarkdown
                              rehypePlugins={[rehypeSanitize]}
                              components={{
                                code({ className, children, ...props }) {
                                  const match = /language-(\w+)/.exec(className || '');
                                  return match ? (
                                    <SyntaxHighlighter
                                      style={vscDarkPlus as any}
                                      language={match[1]}
                                      PreTag="div"
                                      customStyle={{
                                        borderRadius: '8px',
                                        margin: '8px 0',
                                        fontSize: '13px',
                                      }}
                                    >
                                      {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                  ) : (
                                    <code className={className} {...props}>
                                      {children}
                                    </code>
                                  );
                                }
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                        )}
                      </div>

                      {/* Sources */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sources:</span>
                          {msg.sources.map((src, i) => (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', gap: '4px',
                              background: 'rgba(184,148,58,0.08)',
                              border: '1px solid rgba(184,148,58,0.2)',
                              padding: '3px 10px', borderRadius: '20px', fontSize: '11px',
                              color: 'var(--accent-deep)',
                            }}>
                              <FileText size={10} />
                              {src}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Follow-up Suggestions (Only shown under the latest AI response) */}
                      {isLastAIMessage && msg.follow_up_suggestions && msg.follow_up_suggestions.length > 0 && (
                        <div style={{
                          marginTop: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          alignItems: 'flex-start',
                        }}>
                          <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 500 }}>
                            Follow-up Suggestions:
                          </p>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {msg.follow_up_suggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSuggestionClick(suggestion)}
                                style={{
                                  background: 'rgba(184,148,58,0.05)',
                                  border: '1.5px solid rgba(184,148,58,0.18)',
                                  borderRadius: '20px',
                                  padding: '6px 14px',
                                  fontSize: '12.5px',
                                  color: 'var(--accent-deep)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  fontFamily: 'Inter, sans-serif',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(184,148,58,0.1)';
                                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(184,148,58,0.05)';
                                  e.currentTarget.style.borderColor = 'rgba(184,148,58,0.18)';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {loading && (
              <div style={{ display: 'flex', gap: '14px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%',
                  background: 'rgba(232,213,163,0.3)', border: '1px solid var(--glass-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Brain size={18} style={{ color: 'var(--accent-primary)' }} />
                </div>
                <div style={{
                  padding: '14px 20px', borderRadius: '18px', borderTopLeftRadius: '6px',
                  background: 'rgba(255,253,247,0.98)',
                  border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-sm)',
                }}>
                  <div className="typing-indicator"><span></span><span></span><span></span></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{
            padding: '20px 28px',
            borderTop: '1px solid var(--border-light)',
            background: 'rgba(255,253,247,0.98)',
          }}>
            <form onSubmit={(e) => handleSendMessage(e)} style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask something about your documents..."
                disabled={historyLoading}
                style={{
                  flex: 1, padding: '14px 22px', borderRadius: '50px',
                  background: 'rgba(255,253,247,0.95)',
                  border: '1.5px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  outline: 'none', fontSize: '14px',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxShadow: 'var(--shadow-sm)',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(184,148,58,0.12)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--glass-border)'; e.target.style.boxShadow = 'var(--shadow-sm)'; }}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading || historyLoading}
                style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  background: input.trim() && !loading
                    ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                    : 'var(--bg-tertiary)',
                  border: 'none',
                  color: input.trim() && !loading ? '#fff' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease',
                  boxShadow: input.trim() && !loading ? '0 4px 16px rgba(184,148,58,0.35)' : 'none',
                  flexShrink: 0,
                }}
              >
                <Send size={19} style={{ marginLeft: '2px' }} />
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        .typing-indicator span {
          display: inline-block;
          width: 8px; height: 8px;
          background-color: var(--accent-light);
          border-radius: 50%;
          margin: 0 2px;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        .markdown-body p { margin: 0 0 8px; }
        .markdown-body p:last-child { margin-bottom: 0; }
        .markdown-body ul, .markdown-body ol { margin: 4px 0 8px 20px; }
        .markdown-body li { margin-bottom: 2px; }
        .markdown-body code {
          background: rgba(184,148,58,0.1);
          border: 1px solid rgba(184,148,58,0.2);
          border-radius: 4px;
          padding: 1px 6px;
          font-size: 13px;
          font-family: 'Fira Code', monospace;
        }
        .markdown-body pre {
          background: rgba(26,18,8,0.06);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          padding: 12px 14px;
          overflow-x: auto;
          margin: 8px 0;
        }
        .markdown-body pre code {
          background: none;
          border: none;
          padding: 0;
        }
        .markdown-body strong { color: var(--accent-deep); }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 {
          font-family: 'Playfair Display', serif;
          margin: 10px 0 6px;
        }

        /* Sessions hover actions and effects */
        .session-item:hover .session-actions {
          opacity: 1 !important;
        }
        .action-icon {
          transition: color 0.15s ease;
        }
        .action-icon:hover {
          color: var(--accent-primary) !important;
        }
      `}</style>
    </div>
  );
};

export default ChatPage;
