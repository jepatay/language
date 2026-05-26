import { useState } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { SUPPORTED_LANGUAGES, NATIVE_LANGUAGES } from '../../data/languages';
import { LEVEL_DESCRIPTORS } from '../../data/levelDescriptors';
import KeywordsInput from './KeywordsInput';
import toast from 'react-hot-toast';
import Header from '../layout/Header';
import BottomNav from '../layout/BottomNav';

export default function ProfileSettings() {
  const { activeProfile, updateActiveProfile, switchLanguage, activeLanguage } = useProfile();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(activeProfile?.name || '');
  const [nativeLang, setNativeLang] = useState(activeProfile?.nativeLanguage || 'en');
  const [keywords, setKeywords] = useState(activeProfile?.keywords || []);
  const [saving, setSaving] = useState(false);

  if (!activeProfile) return <div className="loading-screen"><div className="spinner" /></div>;

  const languages = activeProfile.languages || {};

  async function handleSave() {
    setSaving(true);
    try {
      await updateActiveProfile({
        name: name.trim(),
        nativeLanguage: nativeLang,
        keywords,
      });
      toast.success('Profile saved!');
    } catch {
      toast.error('Error saving profile.');
    }
    setSaving(false);
  }

  async function handleLevelChange(langCode, newLevel) {
    const level = parseInt(newLevel);
    if (isNaN(level) || level < 1 || level > 10) return;
    const updated = {
      languages: {
        ...languages,
        [langCode]: { ...languages[langCode], level },
      },
    };
    await updateActiveProfile(updated);
    toast.success(`Level updated to ${level}`);
  }

  async function handleAddLanguage(langCode) {
    if (languages[langCode]) return;
    const updated = {
      languages: {
        ...languages,
        [langCode]: { level: 1, sessions: 0 },
      },
    };
    await updateActiveProfile(updated);
    switchLanguage(langCode);
    toast.success(`${SUPPORTED_LANGUAGES[langCode].name} added!`);
  }

  async function handleRemoveLanguage(langCode) {
    if (Object.keys(languages).length <= 1) {
      return toast.error("You need at least one language.");
    }
    const updated = { ...languages };
    delete updated[langCode];
    await updateActiveProfile({ languages: updated });
    if (activeLanguage === langCode) {
      switchLanguage(Object.keys(updated)[0]);
    }
    toast.success('Language removed.');
  }

  return (
    <div className="page">
      <Header title="Profile Settings" />
      <div className="page-content">

        <section className="settings-section">
          <h3>Profile Info</h3>
          <div className="field-group">
            <label>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="field-group">
            <label>Native Language</label>
            <select value={nativeLang} onChange={e => setNativeLang(e.target.value)}>
              {NATIVE_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label>Interests & Keywords</label>
            <KeywordsInput keywords={keywords} onChange={setKeywords} />
            <span className="field-hint">Used to personalize your lessons</span>
          </div>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </section>

        <section className="settings-section">
          <h3>Languages & Levels</h3>
          {Object.entries(languages).map(([code, data]) => {
            const lang = SUPPORTED_LANGUAGES[code];
            if (!lang) return null;
            const level = data.level || 1;
            const desc = LEVEL_DESCRIPTORS[level];
            return (
              <div key={code} className="lang-settings-card">
                <div className="lang-settings-header">
                  <span>{lang.flag} {lang.name}</span>
                  <button className="text-btn danger" onClick={() => handleRemoveLanguage(code)}>Remove</button>
                </div>
                <div className="level-picker">
                  <label>Level: {level} — {desc?.label}</label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={level}
                    onChange={e => handleLevelChange(code, e.target.value)}
                  />
                  <p className="level-desc">{desc?.description}</p>
                </div>
              </div>
            );
          })}

          <div className="add-lang-section">
            <h4>Add a Language</h4>
            <div className="lang-grid compact">
              {Object.values(SUPPORTED_LANGUAGES)
                .filter(l => !languages[l.code])
                .map(lang => (
                  <button key={lang.code} className="lang-card" onClick={() => handleAddLanguage(lang.code)}>
                    {lang.flag} {lang.name}
                  </button>
                ))}
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h3>Account</h3>
          <button className="btn-danger" onClick={logout}>Sign Out</button>
        </section>
      </div>
      <BottomNav />
    </div>
  );
}
