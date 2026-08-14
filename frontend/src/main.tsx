import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { GoogleOAuthProvider } from '@react-oauth/google'

// Register Service Worker
import { registerSW } from 'virtual:pwa-register'

registerSW({
  onNeedRefresh() {
    // autoUpdate is enabled, so this won't fire unless configured differently
  },
  onOfflineReady() {
    console.log('PWA is ready to work offline.')
  },
})

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string

if (!googleClientId) {
  console.warn('VITE_GOOGLE_CLIENT_ID is not set. Google Sign-In will not work.')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId ?? ''}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
