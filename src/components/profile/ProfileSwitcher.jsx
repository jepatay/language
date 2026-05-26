import { useProfile } from '../../contexts/ProfileContext';
import { useNavigate } from 'react-router-dom';

export default function ProfileSwitcher({ onClose }) {
  const { profiles, activeProfile, switchProfile } = useProfile();
  const navigate = useNavigate();

  function handleSelect(profile) {
    switchProfile(profile);
    onClose();
  }

  function handleAddProfile() {
    onClose();
    navigate('/profile/new');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Switch Profile</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="profile-list">
          {profiles.map(profile => (
            <button
              key={profile.id}
              className={`profile-list-item ${activeProfile?.id === profile.id ? 'active' : ''}`}
              onClick={() => handleSelect(profile)}
            >
              <span className="avatar lg">{profile.name?.[0]?.toUpperCase()}</span>
              <div className="profile-info">
                <span className="profile-name">{profile.name}</span>
                <span className="profile-langs">
                  {Object.keys(profile.languages || {}).map(code => {
                    const level = profile.languages[code]?.level || 1;
                    return `${code.split('-')[0].toUpperCase()} Lv.${level}`;
                  }).join(' · ')}
                </span>
              </div>
              {activeProfile?.id === profile.id && <span className="check">✓</span>}
            </button>
          ))}
        </div>

        <button className="btn-secondary btn-full mt-12" onClick={handleAddProfile}>
          + Add Profile
        </button>
      </div>
    </div>
  );
}
