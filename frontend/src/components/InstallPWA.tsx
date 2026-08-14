import { useEffect, useState } from 'react';
import { Download, X, Share, PlusSquare, Smartphone, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPWA() {
  const [promptInstall, setPromptInstall] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // 1. Check if running as Standalone PWA app already
    const checkIsStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isStandaloneIOS = (navigator as unknown as { standalone?: boolean }).standalone === true;
      return isStandaloneMedia || isStandaloneIOS;
    };

    if (checkIsStandalone()) {
      setIsInstalled(true);
      return;
    }

    // 2. Check if device is iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    // Check last dismissal (suppress for 3 days if dismissed, unless manually triggered)
    const dismissedTime = localStorage.getItem('pwa_prompt_dismissed');
    const isDismissed = dismissedTime && (Date.now() - parseInt(dismissedTime, 10)) < 3 * 24 * 60 * 60 * 1000;

    // 3. Listen for Chrome/Android beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setPromptInstall(e as BeforeInstallPromptEvent);
      if (!isDismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowBanner(false);
      setShowIOSModal(false);
    });

    // Custom event to trigger PWA install modal/prompt from Sidebar or Settings anytime
    const handleCustomTrigger = () => {
      if (iosDevice) {
        setShowIOSModal(true);
      } else if (promptInstall) {
        promptInstall.prompt();
      } else {
        setShowBanner(true);
      }
    };

    window.addEventListener('pwa-trigger-install', handleCustomTrigger);

    // If iOS and not dismissed, show iOS install banner after 3 seconds
    if (iosDevice && !isDismissed && !checkIsStandalone()) {
      const timer = setTimeout(() => setShowBanner(true), 2500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handler);
        window.removeEventListener('pwa-trigger-install', handleCustomTrigger);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('pwa-trigger-install', handleCustomTrigger);
    };
  }, [promptInstall]);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      setShowBanner(false);
      return;
    }

    if (!promptInstall) {
      setShowIOSModal(true);
      return;
    }
    
    await promptInstall.prompt();
    const { outcome } = await promptInstall.userChoice;
    
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
  };

  if (isInstalled) {
    return null;
  }

  return (
    <>
      {/* ── Mobile PWA Installation Bottom Sheet / Floating Banner ────────────────── */}
      {showBanner && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)',
          maxWidth: '460px',
          zIndex: 9999,
          background: 'rgba(255, 253, 247, 0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1.5px solid var(--accent-secondary, rgba(184, 148, 58, 0.3))',
          borderRadius: '20px',
          padding: '16px 18px',
          boxShadow: '0 12px 32px rgba(26, 18, 8, 0.18)',
          animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img
              src="/icons/icon-192x192.png"
              alt="App Icon"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(184, 148, 58, 0.25)',
                objectFit: 'cover',
                flexShrink: 0
              }}
            />
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  fontWeight: 700,
                  fontSize: '15px',
                  color: 'var(--text-primary)',
                  fontFamily: 'Playfair Display, serif'
                }}>
                  Install AI Student App
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  background: 'rgba(184, 148, 58, 0.15)',
                  color: 'var(--accent-deep)',
                  padding: '2px 6px',
                  borderRadius: '6px'
                }}>
                  PWA
                </span>
              </div>
              <p style={{
                margin: '2px 0 0',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.3
              }}>
                {isIOS ? 'Add to Home Screen for fast mobile access' : 'Install for offline access & app experience'}
              </p>
            </div>

            <button
              onClick={handleDismiss}
              aria-label="Close install prompt"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={handleInstallClick}
              className="btn btn-primary"
              style={{
                flex: 1,
                padding: '9px 16px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <Download size={16} />
              <span>{isIOS ? 'Instructions for iOS' : 'Install App'}</span>
            </button>
            <button
              onClick={handleDismiss}
              style={{
                padding: '9px 14px',
                fontSize: '13px',
                borderRadius: '12px',
                background: 'rgba(0,0,0,0.04)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Not Now
            </button>
          </div>
        </div>
      )}

      {/* ── iOS Step-by-Step Installation Modal Guide ───────────────────────── */}
      {showIOSModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          background: 'rgba(26, 18, 8, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: '16px',
          animation: 'fadeIn 0.25s ease'
        }}>
          <div style={{
            background: 'rgba(255, 253, 247, 0.98)',
            border: '1.5px solid var(--accent-secondary, rgba(184, 148, 58, 0.3))',
            borderRadius: '24px',
            padding: '24px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            animation: 'slideUp 0.3s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Smartphone size={22} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontFamily: 'Playfair Display, serif' }}>
                  Install on iOS Home Screen
                </h3>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.4 }}>
              Safari on iOS requires manual installation. Follow these 3 simple steps to add AI Student Companion to your home screen:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'rgba(184,148,58,0.08)', padding: '12px 14px', borderRadius: '14px' }}>
                <div style={{ background: 'var(--accent-primary)', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>1</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                  Tap the <strong style={{ color: 'var(--accent-deep)' }}>Share icon</strong> <Share size={15} style={{ verticalAlign: 'middle', display: 'inline' }} /> in the Safari toolbar (bottom or top).
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'rgba(184,148,58,0.08)', padding: '12px 14px', borderRadius: '14px' }}>
                <div style={{ background: 'var(--accent-primary)', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>2</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                  Scroll down the share menu and select <strong style={{ color: 'var(--accent-deep)' }}>"Add to Home Screen"</strong> <PlusSquare size={15} style={{ verticalAlign: 'middle', display: 'inline' }} />.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'rgba(184,148,58,0.08)', padding: '12px 14px', borderRadius: '14px' }}>
                <div style={{ background: 'var(--accent-primary)', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>3</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                  Tap <strong style={{ color: 'var(--accent-deep)' }}>"Add"</strong> in the top right corner to install.
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowIOSModal(false);
                localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
              }}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '14px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Check size={18} /> Got it!
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}

