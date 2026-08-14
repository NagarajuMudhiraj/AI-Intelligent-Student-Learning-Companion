import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { Layers, Sparkles, ChevronLeft, ChevronRight, Trash2, Loader, Plus, Check, RefreshCw, Calendar, Zap, Smile } from 'lucide-react';
import { API } from '../lib/api';

interface Flashcard {
  front: string;
  back: string;
  next_review?: string;
  interval?: number;
  ease_factor?: number;
  repetitions?: number;
}

interface Deck {
  id: string;
  deck_name: string;
  cards: Flashcard[];
  card_count: number;
  due_count: number;
  topic?: string;
  created_at: string;
}

interface Document {
  id: string;
  original_name: string;
}

const FlashcardsPage = () => {
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  
  // Study Modes:
  // 'spaced' = spaced repetition (only due cards)
  // 'classic' = classic study (browse all cards)
  const [studyMode, setStudyMode] = useState<'spaced' | 'classic'>('classic');
  
  // Classic Mode States
  const [currentCard, setCurrentCard] = useState(0);
  const [known, setKnown] = useState<Set<number>>(new Set());
  
  // Spaced Repetition States
  const [dueQueue, setDueQueue] = useState<number[]>([]); // indices of cards in activeDeck.cards that are due
  const [activeDueIndex, setActiveDueIndex] = useState(0); // active index inside dueQueue
  const [initialDueCount, setInitialDueCount] = useState(0); // tracker for progress calculation
  
  const [flipped, setFlipped] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState('');
  const [topic, setTopic] = useState('');
  const [numCards, setNumCards] = useState(10);
  const [deckName, setDeckName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetchDecks();
    fetch(`${API}/documents/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setDocs).catch(() => {});
  }, []);

  const fetchDecks = async () => {
    const res = await fetch(`${API}/flashcards/`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setDecks(await res.json());
  };

  const selectDeck = (deck: Deck) => {
    setActiveDeck(deck);
    setFlipped(false);
    setKnown(new Set());
    
    // Calculate due cards indices
    const now = new Date();
    const dueIndices: number[] = [];
    deck.cards.forEach((c, idx) => {
      if (!c.next_review) {
        dueIndices.push(idx);
      } else {
        const nextRev = new Date(c.next_review);
        if (nextRev <= now) {
          dueIndices.push(idx);
        }
      }
    });
    
    setDueQueue(dueIndices);
    setInitialDueCount(dueIndices.length);
    setActiveDueIndex(0);
    setCurrentCard(0);
    
    // Default mode based on whether due cards are available
    if (dueIndices.length > 0) {
      setStudyMode('spaced');
    } else {
      setStudyMode('classic');
    }
  };

  const generateDeck = async () => {
    setGenerating(true);
    try {
      const body: any = { num_cards: numCards };
      if (selectedDoc) body.document_id = selectedDoc;
      if (topic) body.topic = topic;
      if (deckName) body.deck_name = deckName;

      const res = await fetch(`${API}/flashcards/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); alert(e.detail); return; }
      const deck = await res.json();
      setDecks(prev => [deck, ...prev]);
      selectDeck(deck);
      setShowCreate(false);
      setTopic(''); setSelectedDoc(''); setDeckName('');
    } finally {
      setGenerating(false);
    }
  };

  const deleteDeck = async (id: string) => {
    if (!confirm('Delete this flashcard deck?')) return;
    setDeleting(id);
    try {
      await fetch(`${API}/flashcards/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setDecks(prev => prev.filter(d => d.id !== id));
      if (activeDeck?.id === id) setActiveDeck(null);
    } finally {
      setDeleting(null);
    }
  };

  const submitReview = async (rating: number) => {
    if (!activeDeck || studyMode !== 'spaced' || dueQueue.length === 0 || reviewing) return;
    
    setReviewing(true);
    const originalCardIndex = dueQueue[activeDueIndex];
    
    try {
      const res = await fetch(`${API}/flashcards/${activeDeck.id}/cards/${originalCardIndex}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating }),
      });
      
      if (res.ok) {
        const updatedDeck: Deck = await res.json();
        
        // Update decks list
        setDecks(prev => prev.map(d => d.id === updatedDeck.id ? updatedDeck : d));
        // Update active deck structure
        setActiveDeck(updatedDeck);
        
        // Remove current card index from the active dueQueue
        const newDueQueue = dueQueue.filter((_, idx) => idx !== activeDueIndex);
        setDueQueue(newDueQueue);
        
        // Shift activeDueIndex if necessary
        if (newDueQueue.length > 0) {
          if (activeDueIndex >= newDueQueue.length) {
            setActiveDueIndex(newDueQueue.length - 1);
          }
          setFlipped(false);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setReviewing(false);
    }
  };

  const nextCard = () => {
    setCurrentCard(i => Math.min(i + 1, (activeDeck?.cards.length ?? 1) - 1));
    setFlipped(false);
  };

  const prevCard = () => {
    setCurrentCard(i => Math.max(i - 1, 0));
    setFlipped(false);
  };

  const toggleKnown = () => {
    setKnown(prev => {
      const next = new Set(prev);
      if (next.has(currentCard)) next.delete(currentCard); else next.add(currentCard);
      return next;
    });
  };

  // Determine current card details based on mode
  const activeDeckCardIndex = studyMode === 'spaced' && dueQueue.length > 0
    ? dueQueue[activeDueIndex]
    : currentCard;

  const card = activeDeck?.cards[activeDeckCardIndex];

  // Calculate dynamic progress
  const progress = studyMode === 'spaced'
    ? (initialDueCount > 0 ? Math.round(((initialDueCount - dueQueue.length) / initialDueCount) * 100) : 100)
    : (activeDeck ? Math.round((known.size / activeDeck.cards.length) * 100) : 0);

  return (
    <div className="app-layout-container">
      <div className="bg-blob bg-blob-1" />
      <div className="bg-blob bg-blob-2" />
      <Sidebar />

      <div className="app-main-content" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {/* Deck List Sidebar */}
        <div style={{
          width: '290px', maxWidth: '100%', flexShrink: 0,
          background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)', borderRadius: '20px',
          boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'Playfair Display, serif' }}>Flashcard Decks</h3>
              <button
                onClick={() => setShowCreate(!showCreate)}
                style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: 'rgba(184,148,58,0.1)', border: '1px solid rgba(184,148,58,0.2)',
                  color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
              ><Plus size={16} /></button>
            </div>
          </div>

          {/* Create Form */}
          {showCreate && (
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', background: 'rgba(184,148,58,0.04)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input value={deckName} onChange={e => setDeckName(e.target.value)} placeholder="Deck name (optional)" style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
              <select value={selectedDoc} onChange={e => setSelectedDoc(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="">— All documents —</option>
                {docs.map(d => <option key={d.id} value={d.id}>{d.original_name}</option>)}
              </select>
              <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Or enter a topic" style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>Cards:</span>
                {[5, 10, 15, 20].map(n => (
                  <button key={n} onClick={() => setNumCards(n)} style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '12px', border: `1px solid ${numCards === n ? 'var(--accent-primary)' : 'var(--glass-border)'}`, background: numCards === n ? 'rgba(184,148,58,0.1)' : 'transparent', color: numCards === n ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>{n}</button>
                ))}
              </div>
              <button onClick={generateDeck} disabled={generating || (!selectedDoc && !topic && docs.length === 0)} className="btn btn-primary" style={{ padding: '10px', fontSize: '13px', gap: '6px', justifyContent: 'center' }}>
                {generating ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
                {generating ? 'Generating…' : 'Generate'}
              </button>
            </div>
          )}

          {/* Deck List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {decks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No decks yet.<br />Create one above!</p>
            ) : decks.map(deck => (
              <div
                key={deck.id}
                onClick={() => selectDeck(deck)}
                style={{
                  padding: '12px 14px', borderRadius: '12px', cursor: 'pointer',
                  background: activeDeck?.id === deck.id ? 'rgba(184,148,58,0.1)' : 'transparent',
                  border: `1px solid ${activeDeck?.id === deck.id ? 'rgba(184,148,58,0.3)' : 'transparent'}`,
                  marginBottom: '6px', transition: 'all 0.2s',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
                onMouseEnter={e => { if (activeDeck?.id !== deck.id) (e.currentTarget as HTMLElement).style.background = 'rgba(232,213,163,0.15)'; }}
                onMouseLeave={e => { if (activeDeck?.id !== deck.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ overflow: 'hidden', flex: 1, paddingRight: '10px' }}>
                  <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deck.deck_name}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{deck.card_count} cards</span>
                    {deck.due_count > 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', padding: '2px 6px', borderRadius: '20px', background: 'rgba(181,71,58,0.08)', color: '#b5473a', fontWeight: 600 }}>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#b5473a' }} />
                        {deck.due_count} due
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', padding: '2px 6px', borderRadius: '20px', background: 'rgba(58,170,92,0.08)', color: '#3aaa5c', fontWeight: 600 }}>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#3aaa5c' }} />
                        Review Done
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteDeck(deck.id); }}
                  style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#b5473a'; (e.currentTarget as HTMLElement).style.background = 'rgba(181,71,58,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {deleting === deck.id ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={12} />}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Flashcard Viewer */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!activeDeck ? (
            <div style={{
              flex: 1, background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)',
              border: '1px solid var(--glass-border)', borderRadius: '20px', boxShadow: 'var(--shadow-sm)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px',
            }}>
              <Layers size={56} style={{ color: 'var(--accent-light)' }} />
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.4rem', marginBottom: '8px', fontFamily: 'Playfair Display, serif' }}>Select or Create a Deck</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Choose a deck from the left panel to start studying</p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ gap: '8px' }}>
                <Sparkles size={15} /> Generate New Deck
              </button>
            </div>
          ) : (
            <>
              {/* Header Details / Mode Switcher */}
              <div style={{
                background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)',
                border: '1px solid var(--glass-border)', borderRadius: '16px',
                padding: '16px 24px', boxShadow: 'var(--shadow-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{activeDeck.deck_name}</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>Created {new Date(activeDeck.created_at).toLocaleDateString()}</p>
                </div>
                
                {/* Mode toggle */}
                <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                  <button 
                    onClick={() => { setStudyMode('spaced'); setFlipped(false); }} 
                    style={{ 
                      padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', border: 'none', cursor: 'pointer',
                      background: studyMode === 'spaced' ? 'rgba(255, 253, 247, 0.98)' : 'transparent',
                      color: studyMode === 'spaced' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      boxShadow: studyMode === 'spaced' ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <Zap size={12} />
                    Spaced Repetition ({dueQueue.length} due)
                  </button>
                  <button 
                    onClick={() => { setStudyMode('classic'); setFlipped(false); }} 
                    style={{ 
                      padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', border: 'none', cursor: 'pointer',
                      background: studyMode === 'classic' ? 'rgba(255, 253, 247, 0.98)' : 'transparent',
                      color: studyMode === 'classic' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      boxShadow: studyMode === 'classic' ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <Calendar size={12} />
                    Browse All ({activeDeck.card_count})
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{
                background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)',
                border: '1px solid var(--glass-border)', borderRadius: '16px',
                padding: '16px 24px', boxShadow: 'var(--shadow-sm)',
                display: 'flex', alignItems: 'center', gap: '16px',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                  {studyMode === 'spaced' ? 'Review Progress' : 'Mastery Progress'}
                </span>
                <div style={{ flex: 1, height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #3aaa5c, #6bcf85)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {studyMode === 'spaced' 
                    ? `${initialDueCount - dueQueue.length}/${initialDueCount} reviewed` 
                    : `${known.size}/${activeDeck.cards.length} mastered`
                  }
                </span>
              </div>

              {/* Card or Celebration Screen */}
              {studyMode === 'spaced' && dueQueue.length === 0 ? (
                <div style={{
                  flex: 1, background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)',
                  border: '1px solid var(--glass-border)', borderRadius: '20px', boxShadow: 'var(--shadow-sm)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '40px'
                }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(58,170,92,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3aaa5c', marginBottom: '8px' }}>
                    <Smile size={40} />
                  </div>
                  <h3 style={{ fontSize: '1.5rem', margin: 0, fontFamily: 'Playfair Display, serif', color: 'var(--text-primary)' }}>All caught up!</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', maxWidth: '380px', margin: 0, lineHeight: 1.5 }}>
                    You have reviewed all due cards in this deck. Spaced repetition keeps your memory strong. Come back tomorrow for new cards!
                  </p>
                  <button className="btn btn-secondary" onClick={() => setStudyMode('classic')} style={{ marginTop: '12px' }}>
                    Browse All Cards
                  </button>
                </div>
              ) : (
                <>
                  {/* Card Flipper container */}
                  <div style={{ flex: 1, perspective: '1000px', cursor: 'pointer' }} onClick={() => setFlipped(!flipped)}>
                    <div style={{
                      width: '100%', height: '100%', position: 'relative',
                      transformStyle: 'preserve-3d', transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1)',
                      transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    }}>
                      {/* Front */}
                      <div style={{
                        position: 'absolute', width: '100%', height: '100%',
                        backfaceVisibility: 'hidden', background: 'rgba(255,253,247,0.96)',
                        backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)',
                        borderRadius: '20px', boxShadow: 'var(--shadow-md)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '40px', boxSizing: 'border-box'
                      }}>
                        <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '24px' }}>
                          Question — Click to flip
                        </p>
                        <p style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)', fontWeight: 600, textAlign: 'center', lineHeight: 1.6, color: 'var(--text-primary)', margin: 0, fontFamily: 'Playfair Display, serif' }}>
                          {card?.front}
                        </p>
                        <p style={{ marginTop: '32px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {studyMode === 'spaced' 
                            ? `Reviewing Card ${activeDueIndex + 1} of ${dueQueue.length}`
                            : `Card ${currentCard + 1} of ${activeDeck.cards.length}`
                          }
                        </p>
                      </div>

                      {/* Back */}
                      <div style={{
                        position: 'absolute', width: '100%', height: '100%',
                        backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
                        background: 'linear-gradient(135deg, rgba(184,148,58,0.08), rgba(201,168,76,0.05))',
                        backdropFilter: 'blur(20px)', border: '1px solid rgba(184,148,58,0.3)',
                        borderRadius: '20px', boxShadow: 'var(--shadow-md)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '40px', boxSizing: 'border-box'
                      }}>
                        <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '24px' }}>Answer</p>
                        <p style={{ fontSize: 'clamp(1rem, 2vw, 1.3rem)', textAlign: 'center', lineHeight: 1.7, color: 'var(--text-primary)', margin: 0 }}>
                          {card?.back}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Controls / Feedback Action Buttons */}
                  <div style={{
                    background: 'rgba(255,253,247,0.92)', backdropFilter: 'blur(20px)',
                    border: '1px solid var(--glass-border)', borderRadius: '16px',
                    padding: '16px 24px', boxShadow: 'var(--shadow-sm)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                  }}>
                    {studyMode === 'spaced' ? (
                      // Spaced Repetition Quality feedback buttons (Only when flipped!)
                      !flipped ? (
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setFlipped(true); }}
                            className="btn btn-primary"
                            style={{ gap: '8px', padding: '12px 32px' }}
                          >
                            <RefreshCw size={15} /> Reveal Answer
                          </button>
                        </div>
                      ) : (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>How well did you recall this?</p>
                          <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); submitReview(1); }}
                              disabled={reviewing}
                              style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 16px', borderRadius: '12px',
                                border: '1.5px solid rgba(181, 71, 58, 0.3)', background: 'rgba(181, 71, 58, 0.06)', color: '#b5473a',
                                cursor: 'pointer', fontSize: '13px', fontWeight: 600, minWidth: '80px', transition: 'all 0.2s',
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(181, 71, 58, 0.12)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(181, 71, 58, 0.06)'; }}
                            >
                              <span style={{ fontSize: '18px' }}>🟥</span>
                              Again
                              <span style={{ fontSize: '10px', color: 'rgba(181,71,58,0.8)', fontWeight: 'normal' }}>Forgot (1d)</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); submitReview(2); }}
                              disabled={reviewing}
                              style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 16px', borderRadius: '12px',
                                border: '1.5px solid rgba(201, 168, 76, 0.3)', background: 'rgba(201, 168, 76, 0.06)', color: 'var(--accent-primary)',
                                cursor: 'pointer', fontSize: '13px', fontWeight: 600, minWidth: '80px', transition: 'all 0.2s',
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(201, 168, 76, 0.12)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(201, 168, 76, 0.06)'; }}
                            >
                              <span style={{ fontSize: '18px' }}>🟨</span>
                              Hard
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>Struggled (1d)</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); submitReview(3); }}
                              disabled={reviewing}
                              style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 16px', borderRadius: '12px',
                                border: '1.5px solid rgba(54, 133, 243, 0.3)', background: 'rgba(54, 133, 243, 0.06)', color: '#2b75db',
                                cursor: 'pointer', fontSize: '13px', fontWeight: 600, minWidth: '80px', transition: 'all 0.2s',
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(54, 133, 243, 0.12)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(54, 133, 243, 0.06)'; }}
                            >
                              <span style={{ fontSize: '18px' }}>🟦</span>
                              Good
                              <span style={{ fontSize: '10px', color: 'rgba(54,133,243,0.8)', fontWeight: 'normal' }}>Recall OK (6d)</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); submitReview(4); }}
                              disabled={reviewing}
                              style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 16px', borderRadius: '12px',
                                border: '1.5px solid rgba(58, 170, 92, 0.3)', background: 'rgba(58, 170, 92, 0.06)', color: '#3aaa5c',
                                cursor: 'pointer', fontSize: '13px', fontWeight: 600, minWidth: '80px', transition: 'all 0.2s',
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(58, 170, 92, 0.12)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(58, 170, 92, 0.06)'; }}
                            >
                              <span style={{ fontSize: '18px' }}>🟩</span>
                              Easy
                              <span style={{ fontSize: '10px', color: 'rgba(58,170,92,0.8)', fontWeight: 'normal' }}>Flawless (15d+)</span>
                            </button>
                          </div>
                        </div>
                      )
                    ) : (
                      // Classic browse mode controls
                      <>
                        <button onClick={(e) => { e.stopPropagation(); prevCard(); }} disabled={currentCard === 0} className="btn btn-secondary" style={{ gap: '6px', padding: '10px 18px', fontSize: '13px' }}>
                          <ChevronLeft size={15} /> Prev
                        </button>

                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setFlipped(!flipped); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '50px',
                              border: '1.5px solid var(--glass-border)', background: 'transparent', color: 'var(--text-secondary)',
                              cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
                            }}
                          ><RefreshCw size={13} /> Flip</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleKnown(); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '50px',
                              border: `1.5px solid ${known.has(currentCard) ? '#3aaa5c' : 'var(--glass-border)'}`,
                              background: known.has(currentCard) ? 'rgba(58,170,92,0.1)' : 'transparent',
                              color: known.has(currentCard) ? '#3aaa5c' : 'var(--text-secondary)',
                              cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
                            }}
                          ><Check size={13} /> {known.has(currentCard) ? 'Mastered!' : 'Mark Mastered'}</button>
                        </div>

                        <button onClick={(e) => { e.stopPropagation(); nextCard(); }} disabled={currentCard === activeDeck.cards.length - 1} className="btn btn-secondary" style={{ gap: '6px', padding: '10px 18px', fontSize: '13px' }}>
                          Next <ChevronRight size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default FlashcardsPage;
