import { useState } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { chatCompletion, parseJsonResponse } from '../../utils/openai';
import { buildStoryPrompt } from '../../utils/prompts';
import { saveActivityScore } from '../../firebase/firestore';
import toast from 'react-hot-toast';

export default function StoryQuiz() {
  const { activeProfile, activeLanguage } = useProfile();
  const { user } = useAuth();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [phase, setPhase] = useState('story'); // 'story' | 'quiz' | 'results'
  const [answers, setAnswers] = useState({});
  const [questionIdx, setQuestionIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [rounds, setRounds] = useState(0);

  async function generateStory() {
    if (!activeProfile || !activeLanguage) return;
    setLoading(true);
    setPhase('story');
    setAnswers({});
    setShowTranslation(false);
    setQuestionIdx(0);
    const level = activeProfile.languages?.[activeLanguage]?.level || 1;
    const keywords = activeProfile.keywords || [];
    const prompt = buildStoryPrompt({ language: activeLanguage, level, keywords });

    try {
      const raw = await chatCompletion([{ role: 'user', content: prompt }]);
      const data = await parseJsonResponse(raw);
      setStory(data);
    } catch {
      toast.error('Could not generate story.');
    }
    setLoading(false);
  }

  function startQuiz() {
    setPhase('quiz');
    setQuestionIdx(0);
  }

  function answerQuestion(qIdx, option) {
    setAnswers(prev => ({ ...prev, [qIdx]: option }));
  }

  function submitQuiz() {
    let pts = 0;
    story.questions.forEach((q, i) => {
      const chosen = answers[i];
      const correct = chosen === q.correct || chosen?.startsWith(q.correct + '.');
      if (correct) pts++;
    });
    const totalPts = pts * 10;
    setScore(pts);
    setTotalScore(prev => prev + totalPts);
    setRounds(prev => prev + 1);
    setPhase('results');
    saveActivityScore(user.uid, activeProfile.id, activeLanguage, 'story-quiz', totalPts).catch(() => {});
  }

  if (loading) return <div className="game-container"><div className="loading-card"><div className="spinner" /></div></div>;

  return (
    <div className="game-container">
      <div className="game-header">
        <h3>Story Quiz</h3>
        <div className="score-display">Score: {totalScore} | Round {rounds}</div>
      </div>

      {!story && (
        <div className="game-start">
          <p>Read a story, then answer questions to earn points!</p>
          <button className="btn-primary" onClick={generateStory}>Generate Story</button>
        </div>
      )}

      {story && phase === 'story' && (
        <div className="story-card">
          <h4>{story.title}</h4>
          <div className="story-text">{story.story}</div>
          <button className="text-btn" onClick={() => setShowTranslation(!showTranslation)}>
            {showTranslation ? 'Hide translation' : 'Show translation'}
          </button>
          {showTranslation && <div className="translation-text">{story.translation}</div>}
          <button className="btn-primary mt-16" onClick={startQuiz}>Answer Questions →</button>
        </div>
      )}

      {story && phase === 'quiz' && (
        <div className="quiz-card">
          <div className="question-progress">
            Question {questionIdx + 1} / {story.questions.length}
          </div>
          {story.questions.map((q, i) => (
            <div key={i} className={`question-item ${i !== questionIdx ? 'hidden' : ''}`}>
              <p className="question-text">{q.question}</p>
              <div className="options-list">
                {q.options.map(opt => (
                  <button
                    key={opt}
                    className={`option-btn ${answers[i] === opt ? 'selected' : ''}`}
                    onClick={() => answerQuestion(i, opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div className="quiz-nav">
                {questionIdx < story.questions.length - 1 ? (
                  <button
                    className="btn-primary"
                    onClick={() => setQuestionIdx(i + 1)}
                    disabled={!answers[i]}
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={submitQuiz}
                    disabled={Object.keys(answers).length < story.questions.length}
                  >
                    Submit ✓
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {story && phase === 'results' && (
        <div className="result-card">
          <div className="result-score">{score}/{story.questions.length}</div>
          <p>{score === story.questions.length ? '🎉 Perfect score!' : score > 0 ? '👍 Good effort!' : '📚 Keep reading!'}</p>
          <div className="answers-review">
            {story.questions.map((q, i) => {
              const chosen = answers[i];
              const isCorrect = chosen === q.correct || chosen?.startsWith(q.correct + '.');
              return (
                <div key={i} className={`answer-item ${isCorrect ? 'correct' : 'incorrect'}`}>
                  <span>{isCorrect ? '✓' : '✗'}</span>
                  <span>{q.question}</span>
                  {!isCorrect && <span className="correct-answer">Answer: {q.correct}</span>}
                </div>
              );
            })}
          </div>
          <button className="btn-primary mt-16" onClick={generateStory}>New Story</button>
        </div>
      )}
    </div>
  );
}
