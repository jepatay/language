import { useState, useEffect, useRef } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { chatCompletion, parseJsonResponse } from '../../utils/openai';
import { buildSpeedRoundPrompt } from '../../utils/prompts';
import { saveActivityScore } from '../../firebase/firestore';
import { SUPPORTED_LANGUAGES } from '../../data/languages';
import toast from 'react-hot-toast';

const TIME_LIMIT = 10; // seconds per card

export default function SpeedRound() {
  const { activeProfile, activeLanguage } = useProfile();
  const { user } = useAuth();
  const [cards, setCards] = useState([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [phase, setPhase] = useState('start'); // 'start' | 'playing' | 'results'
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [choices, setChoices] = useState([]);
  const timerRef = useRef(null);

  const lang = activeLanguage ? SUPPORTED_LANGUAGES[activeLanguage] : null;

  useEffect(() => {
    if (phase === 'playing') {
      setTimeLeft(TIME_LIMIT);
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

  async function loadCards() {
    setLoading(true);
    const level = activeProfile.languages?.[activeLanguage]?.level || 1;
    const keywords = activeProfile.keywords || [];

    try {
      const raw = await chatCompletion([{
        role: 'user',
        content: buildSpeedRoundPrompt({ language: activeLanguage, level, keywords, count: 10 })
      }]);
      const data = await parseJsonResponse(raw);
      setCards(data.cards);
      setCardIdx(0);
      setAnswers([]);
      setPhase('playing');
      generateChoices(data.cards, 0);
    } catch {
      toast.error('Could not load flashcards.');
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
    const timeTaken = TIME_LIMIT - timeLeft;
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

  function handleTimeout() {
    handleAnswer(null);
  }

  function finishGame(finalAnswers) {
    const totalPts = finalAnswers.reduce((sum, a) => sum + a.pts, 0);
    setScore(prev => prev + totalPts);
    setTotalRounds(prev => prev + 1);
    setPhase('results');
    saveActivityScore(user.uid, activeProfile.id, activeLanguage, 'speed-round', totalPts).catch(() => {});
  }

  const card = cards[cardIdx];
  const progress = cards.length > 0 ? ((cardIdx) / cards.length) * 100 : 0;

  return (
    <div className="game-container">
      <div className="game-header">
        <h3>Speed Round</h3>
        <div className="score-display">Score: {score}</div>
      </div>

      {phase === 'start' && (
        <div className="game-start">
          <p>Tap the correct {lang?.name} translation as fast as you can!</p>
          {loading
            ? <div className="spinner" />
            : <button className="btn-primary" onClick={loadCards}>Start Game</button>
          }
        </div>
      )}

      {phase === 'playing' && card && (
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

          <div className="choices-grid">
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
          <button className="btn-primary mt-16" onClick={loadCards}>Play Again</button>
        </div>
      )}
    </div>
  );
}
