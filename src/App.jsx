import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { ProtectedRoute, AdminRoute } from './components/layout/ProtectedRoute';
import AuthScreen from './components/auth/AuthScreen';
import Home from './components/home/Home';
import ConversationPage from './components/conversation/ConversationPage';
import GamesPage from './components/games/GamesPage';
import ActivitiesPage from './components/activities/ActivitiesPage';
import ProfileSettings from './components/profile/ProfileSettings';
import ProfileOnboarding from './components/profile/ProfileOnboarding';
import AdminPanel from './components/admin/AdminPanel';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProfileProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              style: { background: '#1e1e2e', color: '#cdd6f4', border: '1px solid #313244' },
              success: { iconTheme: { primary: '#a6e3a1', secondary: '#1e1e2e' } },
              error: { iconTheme: { primary: '#f38ba8', secondary: '#1e1e2e' } },
            }}
          />
          <Routes>
            <Route path="/auth" element={<AuthScreen />} />

            <Route path="/" element={
              <ProtectedRoute><Home /></ProtectedRoute>
            } />

            <Route path="/conversation" element={
              <ProtectedRoute><ConversationPage /></ProtectedRoute>
            } />

            <Route path="/games" element={
              <ProtectedRoute><GamesPage /></ProtectedRoute>
            } />

            <Route path="/activities" element={
              <ProtectedRoute><ActivitiesPage /></ProtectedRoute>
            } />

            <Route path="/profile" element={
              <ProtectedRoute><ProfileSettings /></ProtectedRoute>
            } />

            <Route path="/profile/new" element={
              <ProtectedRoute><ProfileOnboarding /></ProtectedRoute>
            } />

            <Route path="/admin" element={
              <AdminRoute><AdminPanel /></AdminRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
