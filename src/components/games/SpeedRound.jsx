import { useState, useEffect, useRef } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { chatCompletion, parseJsonResponse } from '../../utils/openai';
import { buildSpeedRoundPrompt } from '../../utils/prompts';
import { saveActivityScore } from '../../firebase/firestore';
import { SUPPORTED_LANGUAGES } from '../../data/languages';
import toast from 'react-hot-toast';

const CONTENT_TYPES = [
  { id: 'word', icon: '🔤', label: 'Words' },
  { id: 'phrase', icon: '💬', label: 'Expressions' },
  { id: 'sentence', icon: '📝', label: 'Sentences' },
];
const COUNT_OPTIONS = [10, 25, 50];
const TIME_LIMITS = { word: 10, phrase: 14, sentence: 18 };

export default function SpeedRound() {
  const { activeProfile, activeLanguage } = useProfile();
  const { user } = useAuth();
  const [cards, setCards] = useState([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [phase, setPhase] = useState('setup'); // 'setup' | 'playing' | 'results'
  const [contentType, setContentType] = useState('word');
  const [count, setCount] = useState(10);
  const [selectedTopics, setSelectedTopics] = useState(() => activeProfile?.keywords || []);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMITS.word);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [choices, setChoices] = useState([]);
  const timerRef = useRef(null);

  const lang = activeLanguage ? SUPPORTED_LANGUAGES[activeLanguage] : null;
  const timeLimit = TIME_LIMITS[contentType] || 10;
  const allKeywords = activeProfile.keywords || [];

  function handleTimeout() {
    handleAnswer(null);
  }

  useEffect(() => {
    if (phase === 'playing') {
      setTimeLeft(timeLimit);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [cardIdx, phase]);

  function toggleTopic(kw) {
    setSelectedTopics(prev => prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw]);
  }

  async function loadCards() {
    setLoading(true);
    setPhase('playing');
    const level = activeProfile.languages?.[activeLanguage]?.level || 1;
    const keywords = selectedTopics.length > 0 ? selectedTopics : allKeywords;

    try {
      const raw = await chatCompletion([{
        role: 'user',
        content: buildSpeedRoundPrompt({ language: activeLanguage, level, keywords, count, contentType })
      }]);
      const data = await parseJsonResponse(raw);
      setCards(data.cards);
      setCardIdx(0);
      setAnswers([]);
      generateChoices(data.cards, 0);
    } catch {
      toast.error('Could not load flashcards.');
      setPhase('setup');
    }
    setLoading(false);
  }

  function generateChoices(cardList, idx) {
    if (!cardList[idx]) return;
    const correct = cardList[idx].target;
    const others = cardList
      .filter((_, i) => i !== idx)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(c => c.target);
    const all = [correct, ...others].sort(() => Math.random() - 0.5);
    setChoices(all);
  }

  function handleAnswer(chosen) {
    clearInterval(timerRef.current);
    const card = cards[cardIdx];
    const isCorrect = chosen === card.target;
    const timeTaken = timeLimit - timeLeft;
    const pts = isCorrect ? Math.max(10 - timeTaken, 1) : 0;
    const newAnswers = [...answers, { card, chosen, isCorrect, pts }];
    setAnswers(newAnswers);

    if (cardIdx + 1 >= cards.length) {
      finishGame(newAnswers);
    } else {
      const nextIdx = cardIdx + 1;
      setCardIdx(nextIdx);
      generateChoices(cards, nextIdx);
    }
  }

  function finishGame(finalAnswers) {
    const totalPts = finalAnswers.reduce((sum, a) => sum + a.pts, 0);
    setScore(prev => prev + totalPts);
    setPhase('results');
    saveActivityScore(user.uid, activeProfile.id, activeLanguage, 'speed-round', totalPts).catch(() => {});
  }

  const card = cards[cardIdx];
  const progress = cards.length > 0 ? ((cardIdx) / cards.length) * 100 : 0;
  const canStart = allKeywords.length === 0 || selectedTopics.length > 0;

  return (
    <div className="game-container">
      <div className="game-header">
        <h3>Speed Round</h3>
        <div className="score-display">Score: {score}</div>
      </div>

      {phase === 'setup' && (
        <div className="game-start speed-setup">
          <p>Tap the correct {lang?.name} translation as fast as you can!</p>

          <div className="setup-section">
            <h4>What kind of content?</h4>
            <div className="lang-grid compact three-col">
              {CONTENT_TYPES.map(ct => (
                <button
                  key={ct.id}
                  className={`lang-card ${contentType === ct.id ? 'selected' : ''}`}
                  onClick={() => setContentType(ct.id)}
                >
                  <span className="lang-flag">{ct.icon}</span>
                  <span className="lang-name">{ct.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="setup-section">
            <h4>How many cards?</h4>
            <div className="count-options">
              {COUNT_OPTIONS.map(n => (
                <button
                  key={n}
                  className={`count-btn ${count === n ? 'selected' : ''}`}
                  onClick={() => setCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {allKeywords.length > 0 && (
            <div className="setup-section">
              <h4>Which topics?</h4>
              <div className="topic-chips">
                {allKeywords.map(kw => (
                  <button
                    key={kw}
                    className={`topic-chip ${selectedTopics.includes(kw) ? 'selected' : ''}`}
                    onClick={() => toggleTopic(kw)}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button className="btn-primary" onClick={loadCards} disabled={!canStart}>Start Game</button>
        </div>
      )}

      {phase === 'playing' && loading && (
        <div className="game-start"><div className="spinner" /></div>
      )}

      {phase === 'playing' && !loading && card && (
        <div className="flashcard-game">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>

          <div className="timer-display">
            <div className={`timer-circle ${timeLeft <= 3 ? 'urgent' : ''}`}>{timeLeft}</div>
          </div>

          <div className="flash-card">
            <div className="flash-english">{card.english}</div>
            {card.hint && <div className="flash-hint">💡 {card.hint}</div>}
          </div>

          <div className={`choices-grid ${contentType === 'sentence' ? 'single-col' : ''}`}>
            {choices.map((choice, i) => (
              <button
                key={i}
                className="choice-btn"
                onClick={() => handleAnswer(choice)}
              >
                {choice}
              </button>
            ))}
          </div>

          <div className="card-counter">{cardIdx + 1} / {cards.length}</div>
        </div>
      )}

      {phase === 'results' && (
        <div className="result-card">
          <div className="result-score">
            {answers.filter(a => a.isCorrect).length}/{answers.length}
          </div>
          <p>Points this round: {answers.reduce((s, a) => s + a.pts, 0)}</p>
          <div className="answers-review compact">
            {answers.map((a, i) => (
              <div key={i} className={`answer-item ${a.isCorrect ? 'correct' : 'incorrect'}`}>
                <span>{a.isCorrect ? '✓' : '✗'}</span>
                <span>{a.card.english}</span>
                <span className="answer-word">→ {a.card.target}</span>
              </div>
            ))}
          </div>
          <div className="result-actions">
            <button className="btn-primary" onClick={loadCards}>Play Again</button>
            <button className="text-btn" onClick={() => setPhase('setup')}>Change Settings</button>
          </div>
        </div>
      )}
    </div>
  );
}
