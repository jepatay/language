import { useState } from 'react';
import Header from '../layout/Header';
import BottomNav from '../layout/BottomNav';
import PronunciationActivity from './PronunciationActivity';
import { useProfile } from '../../contexts/ProfileContext';

const ACTIVITIES = [
  { id: 'pronunciation', label: 'Pronunciation', icon: '🎯', desc: 'Read aloud and get feedback' },
];

export default function ActivitiesPage() {
  const [activeActivity, setActiveActivity] = useState(null);
  const { activeProfile, activeLanguage } = useProfile();

  if (!activeProfile || !activeLanguage) {
    return (
      <div className="page">
        <Header title="Practice" />
        <div className="page-content center-content">
          <p>Select a language profile to start practicing.</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page">
      <Header title="Practice 🎯" />
      <div className="page-content">
        {activeActivity ? (
          <>
            <button className="back-btn" onClick={() => setActiveActivity(null)}>← Back to Activities</button>
            {activeActivity === 'pronunciation' && <PronunciationActivity />}
          </>
        ) : (
          <div className="games-grid">
            {ACTIVITIES.map(activity => (
              <button
                key={activity.id}
                className="game-card"
                onClick={() => setActiveActivity(activity.id)}
              >
                <span className="game-icon">{activity.icon}</span>
                <h4>{activity.label}</h4>
                <p>{activity.desc}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
