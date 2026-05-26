import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

export function AdminRoute({ children }) {
  const { user, userDoc, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!userDoc?.isAdmin) return <Navigate to="/" replace />;
  return children;
}
