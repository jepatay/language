import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAllUsers, setUserActive, generateInviteCode } from '../../firebase/firestore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function AdminPanel() {
  const { userDoc } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatedCode, setGeneratedCode] = useState('');
  const [generating, setGenerating] = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const all = await getAllUsers();
      setUsers(all);
    } catch {
      toast.error('Error loading users.');
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!userDoc?.isAdmin) {
      navigate('/');
      return;
    }
    loadUsers();
  }, [userDoc]);

  async function toggleActive(uid, currentActive) {
    try {
      await setUserActive(uid, !currentActive);
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, active: !currentActive } : u));
      toast.success(currentActive ? 'Account deactivated.' : 'Account reactivated.');
    } catch {
      toast.error('Error updating account.');
    }
  }

  async function handleGenerateCode() {
    setGenerating(true);
    try {
      const code = await generateInviteCode();
      setGeneratedCode(code);
      toast.success('New invite code generated!');
    } catch {
      toast.error('Error generating code.');
    }
    setGenerating(false);
  }

  function formatDate(ts) {
    if (!ts) return 'Never';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div className="page admin-page">
      <div className="admin-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
        <h2>Admin Panel</h2>
      </div>

      <div className="page-content">
        <section className="settings-section">
          <h3>Invite Codes</h3>
          <button className="btn-primary" onClick={handleGenerateCode} disabled={generating}>
            {generating ? 'Generating...' : '+ Generate Invite Code'}
          </button>
          {generatedCode && (
            <div className="code-display">
              <span className="invite-code">{generatedCode}</span>
              <button
                className="text-btn"
                onClick={() => {
                  navigator.clipboard.writeText(generatedCode);
                  toast.success('Copied!');
                }}
              >
                Copy
              </button>
            </div>
          )}
        </section>

        <section className="settings-section">
          <h3>Registered Users ({users.length})</h3>
          <div className="users-table">
            {users.map(u => {
              return (
                <div key={u.id} className={`user-row ${!u.active ? 'inactive' : ''}`}>
                  <div className="user-info">
                    <span className="user-email">{u.email}</span>
                    <span className="user-meta">
                      {u.isAdmin && <span className="admin-tag">Admin</span>}
                      Last active: {formatDate(u.lastActive)}
                    </span>
                  </div>
                  <div className="user-actions">
                    <span className={`status-badge ${u.active ? 'active' : 'inactive'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                    {!u.isAdmin && (
                      <button
                        className={`text-btn ${u.active ? 'danger' : ''}`}
                        onClick={() => toggleActive(u.id, u.active)}
                      >
                        {u.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
