import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { Upload, Trash2, Loader, MessageSquare, CheckCircle, File, FilePlus } from 'lucide-react';
import { API } from '../lib/api';

interface Document {
  id: string;
  original_name: string;
  filename: string;
  file_type: string;
  size_bytes: number;
  created_at: string;
}


const fileIcon = (type: string, name: string) => {
  if (type.includes('pdf') || name.endsWith('.pdf')) return '📄';
  if (type.includes('word') || name.endsWith('.docx')) return '📝';
  if (type.includes('presentation') || name.endsWith('.pptx')) return '📊';
  if (type.includes('text') || name.endsWith('.txt')) return '📃';
  return '📁';
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const DocumentsPage = () => {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetchDocs();
  }, [navigate, token]);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/documents/`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setDocs(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API}/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const newDoc = await res.json();
        setDocs(prev => [newDoc, ...prev]);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(f => uploadFile(f));
  };

  const deleteDoc = async (id: string) => {
    if (!confirm('Delete this document and all its data?')) return;
    setDeleting(id);
    try {
      await fetch(`${API}/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setDocs(prev => prev.filter(d => d.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const chatWithDoc = (doc: Document) => {
    navigate('/chat', { state: { documentId: doc.id, documentName: doc.original_name } });
  };

  return (
    <div className="app-layout-container">
      <div className="bg-blob bg-blob-1" />
      <div className="bg-blob bg-blob-2" />
      <Sidebar />

      <div className="app-main-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Header */}
        <div style={{
          background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)', borderRadius: '20px',
          padding: '24px 28px', boxShadow: 'var(--shadow-sm)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '16px',
        }}>
          <div>
            <p style={{ fontSize: '12px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '6px' }}>Library</p>
            <h1 style={{ fontSize: '1.8rem', margin: 0 }}>My <span className="gradient-text">Documents</span></h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>{docs.length} document{docs.length !== 1 ? 's' : ''} uploaded</p>
          </div>
          <div>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} multiple accept=".pdf,.docx,.pptx,.txt" onChange={e => handleFiles(e.target.files)} />
            <button
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ gap: '10px' }}
            >
              {uploading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <FilePlus size={16} />}
              {uploading ? 'Uploading…' : 'Upload Document'}
            </button>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
            borderRadius: '16px', padding: '28px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
            background: dragOver ? 'rgba(184,148,58,0.06)' : 'rgba(255,253,247,0.5)',
            cursor: 'pointer', transition: 'all 0.2s ease',
          }}
        >
          <Upload size={28} style={{ color: dragOver ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
          <p style={{ color: dragOver ? 'var(--accent-primary)' : 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            Drop files here or <strong>click to browse</strong>
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>Supports PDF, DOCX, PPTX, TXT</p>
        </div>

        {/* Documents Grid */}
        <div style={{
          background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)', borderRadius: '20px',
          padding: '28px', boxShadow: 'var(--shadow-sm)', flex: 1,
        }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
              <Loader size={32} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : docs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '16px' }}>
              <File size={48} style={{ color: 'var(--accent-light)' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>No documents yet. Upload your first one!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {docs.map(doc => (
                <div
                  key={doc.id}
                  style={{
                    padding: '22px', borderRadius: '16px',
                    background: 'rgba(255,253,247,0.98)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    display: 'flex', flexDirection: 'column', gap: '14px',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '12px',
                      background: 'rgba(184,148,58,0.08)', border: '1px solid rgba(184,148,58,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '22px', flexShrink: 0,
                    }}>
                      {fileIcon(doc.file_type, doc.original_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)',
                        margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{doc.original_name}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '4px 0 0' }}>
                        {formatSize(doc.size_bytes)} · {formatDate(doc.created_at)}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3aaa5c', fontSize: '12px' }}>
                    <CheckCircle size={13} />
                    <span>Ready to query</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => chatWithDoc(doc)}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        padding: '9px', borderRadius: '10px', fontSize: '13px', fontWeight: 500,
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        color: '#fff', border: 'none', cursor: 'pointer',
                        boxShadow: '0 3px 10px rgba(184,148,58,0.3)', transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'none'}
                    >
                      <MessageSquare size={14} /> Chat
                    </button>
                    <button
                      onClick={() => deleteDoc(doc.id)}
                      disabled={deleting === doc.id}
                      style={{
                        width: '38px', height: '38px', borderRadius: '10px',
                        background: 'rgba(181,71,58,0.06)', border: '1px solid rgba(181,71,58,0.15)',
                        color: '#b5473a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(181,71,58,0.12)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(181,71,58,0.06)'; }}
                    >
                      {deleting === doc.id ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default DocumentsPage;
