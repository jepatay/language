import { useProfile } from '../../contexts/ProfileContext';
import { useNavigate } from 'react-router-dom';
import { SUPPORTED_LANGUAGES } from '../../data/languages';
import { getLevelLabel } from '../../data/levelDescriptors';
import Header from '../layout/Header';
import BottomNav from '../layout/BottomNav';

export default function Home() {
  const { activeProfile, activeLanguage, switchLanguage, loading } = useProfile();
  const navigate = useNavigate();

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  if (!activeProfile) {
    return (
      <div className="page">
        <Header title="LinguaMe" />
        <div className="page-content center-content">
          <div className="empty-state">
            <span className="empty-icon">🗣️</span>
            <h3>Welcome to LinguaMe!</h3>
            <p>Create your first profile to get started.</p>
            <button className="btn-primary" onClick={() => navigate('/profile/new')}>
              Create Profile
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const languages = activeProfile.languages || {};

  return (
    <div className="page">
      <Header title="LinguaMe" />
      <div className="page-content">
        <div className="greeting">
          <h2>Hey, {activeProfile.name}! 👋</h2>
          <p>Ready to practice?</p>
        </div>

        <section className="section">
          <h3 className="section-title">Your Languages</h3>
          <div className="lang-cards-grid">
            {Object.entries(languages).map(([code, data]) => {
              const lang = SUPPORTED_LANGUAGES[code];
              if (!lang) return null;
              const level = data.level || 1;
              const isActive = activeLanguage === code;

              return (
                <div
                  key={code}
                  className={`lang-dash-card ${isActive ? 'active' : ''}`}
                  onClick={() => switchLanguage(code)}
                >
                  <div className="lang-dash-flag">{lang.flag}</div>
                  <div className="lang-dash-info">
                    <h4>{lang.name}</h4>
                    <div className="level-badge">Level {level} · {getLevelLabel(level)}</div>
                  </div>
                  <div className="level-circle">{level}</div>
                </div>
              );
            })}
            <button className="lang-add-card" onClick={() => navigate('/profile')}>
              + Add Language
            </button>
          </div>
        </section>

        {activeLanguage && (
          <section className="section">
            <h3 className="section-title">
              {SUPPORTED_LANGUAGES[activeLanguage]?.flag} Quick Start
            </h3>
            <div className="quick-actions">
              <button className="quick-card" onClick={() => navigate('/conversation')}>
                <span className="quick-icon">💬</span>
                <span>Text Chat</span>
              </button>
              <button className="quick-card" onClick={() => navigate('/conversation?mode=voice')}>
                <span className="quick-icon">🎙️</span>
                <span>Voice Chat</span>
              </button>
              <button className="quick-card" onClick={() => navigate('/activities')}>
                <span className="quick-icon">🎯</span>
                <span>Practice</span>
              </button>
              <button className="quick-card" onClick={() => navigate('/games')}>
                <span className="quick-icon">🎮</span>
                <span>Games</span>
              </button>
            </div>
          </section>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
