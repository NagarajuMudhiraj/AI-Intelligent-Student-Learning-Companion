import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/Landing';
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import Dashboard from './pages/Dashboard';
import ChatPage from './pages/Chat';
import DocumentsPage from './pages/Documents';
import QuizzesPage from './pages/Quizzes';
import FlashcardsPage from './pages/Flashcards';
import PlannerPage from './pages/Planner';
import AnalyticsPage from './pages/Analytics';
import SettingsPage from './pages/Settings';
import VoicePage from './pages/Voice';
import CareerPage from './pages/Career';
import { InstallPWA } from './components/InstallPWA';
import AuthGuard from './components/AuthGuard';

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/"        element={<LandingPage />} />
          <Route path="/login"   element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes — redirect to /login if no token */}
          <Route path="/dashboard"  element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/chat"       element={<AuthGuard><ChatPage /></AuthGuard>} />
          <Route path="/documents"  element={<AuthGuard><DocumentsPage /></AuthGuard>} />
          <Route path="/quizzes"    element={<AuthGuard><QuizzesPage /></AuthGuard>} />
          <Route path="/flashcards" element={<AuthGuard><FlashcardsPage /></AuthGuard>} />
          <Route path="/planner"    element={<AuthGuard><PlannerPage /></AuthGuard>} />
          <Route path="/analytics"  element={<AuthGuard><AnalyticsPage /></AuthGuard>} />
          <Route path="/settings"   element={<AuthGuard><SettingsPage /></AuthGuard>} />
          <Route path="/voice"      element={<AuthGuard><VoicePage /></AuthGuard>} />
          <Route path="/career"     element={<AuthGuard><CareerPage /></AuthGuard>} />
        </Routes>
      </BrowserRouter>
      {/* Global PWA Install Banner & iOS Modal Manager */}
      <InstallPWA />
    </>
  );
}

export default App;
