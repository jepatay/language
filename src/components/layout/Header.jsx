import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import ProfileSwitcher from '../profile/ProfileSwitcher';
import { SUPPORTED_LANGUAGES } from '../../data/languages';

export default function Header({ title }) {
  const { userDoc } = useAuth();
  const { activeProfile, activeLanguage, switchLanguage } = useProfile();
  const [showSwitcher, setShowSwitcher] = useState(false);

  const lang = activeLanguage ? SUPPORTED_LANGUAGES[activeLanguage] : null;

  return (
    <>
      <header className="app-header">
        <button
          className="profile-btn"
          onClick={() => setShowSwitcher(true)}
          aria-label="Switch profile"
        >
          <span className="avatar">{activeProfile?.name?.[0]?.toUpperCase() || '?'}</span>
          <span className="profile-name">{activeProfile?.name || 'Profile'}</span>
          <span className="chevron">▾</span>
        </button>

        <h2 className="header-title">{title || 'LinguaMe'}</h2>

        <div className="header-right">
          {lang && (
            <span className="lang-badge">
              {lang.flag} {lang.code.split('-')[0].toUpperCase()}
            </span>
          )}
          {userDoc?.isAdmin && (
            <a href="/admin" className="admin-badge">Admin</a>
          )}
        </div>
      </header>

      {showSwitcher && (
        <ProfileSwitcher onClose={() => setShowSwitcher(false)} />
      )}
    </>
  );
}
