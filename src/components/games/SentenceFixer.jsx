import { useState } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { chatCompletion, parseJsonResponse } from '../../utils/openai';
import { buildSentenceFixerPrompt } from '../../utils/prompts';
import { saveActivityScore } from '../../firebase/firestore';
import toast from 'react-hot-toast';

export default function SentenceFixer() {
  const { activeProfile, activeLanguage } = useProfile();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [rounds, setRounds] = useState(0);

  async function newRound() {
    setLoading(true);
    setResult(null);
    setUserAnswer('');
    const level = activeProfile.languages?.[activeLanguage]?.level || 1;
    const keywords = activeProfile.keywords || [];

    try {
      const raw = await chatCompletion([{
        role: 'user',
        content: buildSentenceFixerPrompt({ language: activeLanguage, level, keywords })
      }]);
      const parsed = await parseJsonResponse(raw);
      setData(parsed);
    } catch {
      toast.error('Could not generate sentence.');
    }
    setLoading(false);
  }

  function checkAnswer() {
    if (!userAnswer.trim()) return;
    const normalized = s => s.trim().toLowerCase().replace(/[.,!?;:]/g, '');
    const isCorrect = normalized(userAnswer) === normalized(data.fixed);
    const pts = isCorrect ? 10 : 0;
    setResult({ isCorrect, pts });
    setScore(prev => prev + pts);
    setRounds(prev => prev + 1);
    saveActivityScore(user.uid, activeProfile.id, activeLanguage, 'sentence-fixer', pts).catch(() => {});
  }

  return (
    <div className="game-container">
      <div className="game-header">
        <h3>Sentence Fixer</h3>
        <div className="score-display">Score: {score} | Round {rounds}</div>
      </div>

      {!data && !loading && (
        <div className="game-start">
          <p>Fix the broken sentence and earn points!</p>
          <button className="btn-primary" onClick={newRound}>Start Round</button>
        </div>
      )}

      {loading && <div className="loading-card"><div className="spinner" /></div>}

      {data && !loading && (
        <div className="fixer-card">
          <div className="broken-sentence">
            <span className="label">Fix this:</span>
            <p className="sentence-text error">{data.broken}</p>
          </div>

          {!result ? (
            <>
              <textarea
                value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                placeholder="Type the corrected sentence..."
                rows={3}
                className="fixer-input"
              />
              <button className="btn-primary" onClick={checkAnswer} disabled={!userAnswer.trim()}>
                Check ✓
              </button>
            </>
          ) : (
            <div className={`result-card ${result.isCorrect ? 'correct' : 'incorrect'}`}>
              <p>{result.isCorrect ? '🎉 Correct!' : '❌ Not quite...'}</p>
              <div className="answer-compare">
                <p><strong>Your answer:</strong> {userAnswer}</p>
                <p><strong>Correct answer:</strong> {data.fixed}</p>
              </div>
              <div className="errors-list">
                {data.errors.map((err, i) => (
                  <div key={i} className="error-item">⚠️ {err}</div>
                ))}
              </div>
              <p className="explanation">{data.explanation}</p>
              <button className="btn-primary mt-12" onClick={newRound}>Next Round</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
