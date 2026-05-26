import { useState } from 'react';
import Header from '../layout/Header';
import BottomNav from '../layout/BottomNav';
import WordOrder from './WordOrder';
import StoryQuiz from './StoryQuiz';
import SentenceFixer from './SentenceFixer';
import SpeedRound from './SpeedRound';
import { useProfile } from '../../contexts/ProfileContext';

const GAMES = [
  { id: 'word-order', label: 'Word Order', icon: '🔀', desc: 'Arrange words into the correct sentence' },
  { id: 'story-quiz', label: 'Story Quiz', icon: '📖', desc: 'Read a story, answer questions' },
  { id: 'sentence-fixer', label: 'Sentence Fixer', icon: '✏️', desc: 'Spot and fix grammar errors' },
  { id: 'speed-round', label: 'Speed Round', icon: '⚡', desc: 'Fast-tap vocabulary flashcards' },
];

export default function GamesPage() {
  const [activeGame, setActiveGame] = useState(null);
  const { activeProfile, activeLanguage } = useProfile();

  if (!activeProfile || !activeLanguage) {
    return (
      <div className="page">
        <Header title="Games" />
        <div className="page-content center-content">
          <p>Select a language profile to play games.</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page">
      <Header title="Games 🎮" />
      <div className="page-content">
        {activeGame ? (
          <>
            <button className="back-btn" onClick={() => setActiveGame(null)}>← Back to Games</button>
            {activeGame === 'word-order' && <WordOrder />}
            {activeGame === 'story-quiz' && <StoryQuiz />}
            {activeGame === 'sentence-fixer' && <SentenceFixer />}
            {activeGame === 'speed-round' && <SpeedRound />}
          </>
        ) : (
          <div className="games-grid">
            {GAMES.map(game => (
              <button key={game.id} className="game-card" onClick={() => setActiveGame(game.id)}>
                <span className="game-icon">{game.icon}</span>
                <h4>{game.label}</h4>
                <p>{game.desc}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
