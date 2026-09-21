import { useState } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { chatCompletion, parseJsonResponse, fetchRecentNews } from '../../utils/openai';
import { buildTranslationReaderPrompt } from '../../utils/prompts';
import { saveActivityScore } from '../../firebase/firestore';
import { SUPPORTED_LANGUAGES } from '../../data/languages';
import toast from 'react-hot-toast';

const COUNT_OPTIONS = [6, 10, 15];

export default function TranslationReader() {
  const { activeProfile, activeLanguage } = useProfile();
  const { user } = useAuth();
  const [phase, setPhase] = useState('setup'); // 'setup' | 'reading' | 'done'
  const [count, setCount] = useState(8);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [useNews, setUseNews] = useState(true);
  const [loading, setLoading] = useState(false);
  const [piece, setPiece] = useState(null);
  const [idx, setIdx] = useState(0);

  const lang = activeLanguage ? SUPPORTED_LANGUAGES[activeLanguage] : null;
  const keywords = activeProfile.keywords || [];

  async function loadPiece() {
    setLoading(true);
    setPhase('reading');
    const level = activeProfile.languages?.[activeLanguage]?.level || 1;
    const topic = selectedTopic || null;

    try {
      let newsSnippet = null;
      if (useNews) {
        newsSnippet = await fetchRecentNews(topic ? [topic] : keywords).catch(() => null);
      }

      const prompt = buildTranslationReaderPrompt({
        language: activeLanguage,
        nativeLanguage: activeProfile.nativeLanguage,
        level,
        keywords,
        topic,
        newsSnippet,
        count,
      });
      const raw = await chatCompletion([{ role: 'user', content: prompt }]);
      const data = await parseJsonResponse(raw);
      setPiece({ ...data, sourcedFromNews: !!newsSnippet });
      setIdx(0);
    } catch {
      toast.error('Could not generate a reading.');
      setPhase('setup');
    }
    setLoading(false);
  }

  function next() {
    if (idx + 1 >= piece.sentences.length) {
      setPhase('done');
      saveActivityScore(user.uid, activeProfile.id, activeLanguage, 'translation-reader', piece.sentences.length).catch(() => {});
    } else {
      setIdx(idx + 1);
    }
  }

  function prev() {
    if (idx > 0) setIdx(idx - 1);
  }

  function reset() {
    setPiece(null);
    setPhase('setup');
  }

  const sentence = piece?.sentences?.[idx];
  const progress = piece ? ((idx) / piece.sentences.length) * 100 : 0;

  return (
    <div className="activity-container">
      <div className="game-header">
        <h3>Translation Reader</h3>
      </div>

      {phase === 'setup' && (
        <div className="game-start speed-setup">
          <p>Read short {lang?.name} texts on topics you like, sentence by sentence with translation.</p>

          <div className="setup-section">
            <h4>How many sentences?</h4>
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

          {keywords.length > 0 && (
            <div className="setup-section">
              <h4>Topic</h4>
              <div className="topic-chips">
                <button
                  className={`topic-chip ${selectedTopic === null ? 'selected' : ''}`}
                  onClick={() => setSelectedTopic(null)}
                >
                  Surprise me
                </button>
                {keywords.map(kw => (
                  <button
                    key={kw}
                    className={`topic-chip ${selectedTopic === kw ? 'selected' : ''}`}
                    onClick={() => setSelectedTopic(kw)}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="setup-section">
            <label className="toggle-row">
              <input type="checkbox" checked={useNews} onChange={e => setUseNews(e.target.checked)} />
              <span>Base it on today's news, when available</span>
            </label>
          </div>

          <button className="btn-primary" onClick={loadPiece}>Start Reading</button>
        </div>
      )}

      {phase === 'reading' && loading && (
        <div className="game-start"><div className="spinner" /></div>
      )}

      {phase === 'reading' && !loading && piece && sentence && (
        <div className="reader-card">
          {idx === 0 && (
            <div className="reader-title">
              <h4>{piece.title}</h4>
              <p className="reader-title-translation">{piece.titleTranslation}</p>
              {piece.sourcedFromNews && <span className="reader-source-tag">📰 Based on recent news</span>}
            </div>
          )}

          <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>

          <div className="sentence-pair">
            <p className="sentence-native">{sentence.native}</p>
            <p className="sentence-target">{sentence.target}</p>
          </div>

          <div className="card-counter">{idx + 1} / {piece.sentences.length}</div>

          <div className="reader-nav">
            <button className="text-btn" onClick={prev} disabled={idx === 0}>← Back</button>
            <button className="btn-primary" onClick={next}>
              {idx + 1 >= piece.sentences.length ? 'Finish ✓' : 'Next →'}
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="result-card">
          <div className="result-score">✓</div>
          <p>You read {piece.sentences.length} sentences in {lang?.name}!</p>
          <div className="result-actions">
            <button className="btn-primary" onClick={loadPiece}>Read Another</button>
            <button className="text-btn" onClick={reset}>Change Settings</button>
          </div>
        </div>
      )}
    </div>
  );
}
