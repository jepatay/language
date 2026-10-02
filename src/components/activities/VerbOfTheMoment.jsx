import { useState, useEffect, useRef } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { chatCompletion, parseJsonResponse } from '../../utils/openai';
import { buildVerbConjugationPrompt } from '../../utils/prompts';
import { saveActivityScore } from '../../firebase/firestore';
import { SUPPORTED_LANGUAGES } from '../../data/languages';
import { pickRandomVerb, rememberVerb } from '../../data/verbs';
import { useSpeech } from '../../hooks/useSpeech';
import toast from 'react-hot-toast';

export default function VerbOfTheMoment() {
  const { activeProfile, activeLanguage } = useProfile();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [verb, setVerb] = useState(null);
  const [tenseIdx, setTenseIdx] = useState(0);
  const requestId = useRef(0);

  const lang = activeLanguage ? SUPPORTED_LANGUAGES[activeLanguage] : null;
  const level = activeProfile.languages?.[activeLanguage]?.level || 1;
  const { speakingKey, speak, stop } = useSpeech(lang?.ttsVoice || 'nova');

  // Only sets state after the network call, so it is safe to run from the mount effect.
  async function fetchVerb() {
    const id = ++requestId.current;
    const meaning = pickRandomVerb(level);
    try {
      const prompt = buildVerbConjugationPrompt({
        language: activeLanguage,
        nativeLanguage: activeProfile.nativeLanguage,
        level,
        verbMeaning: meaning,
      });
      const raw = await chatCompletion([{ role: 'user', content: prompt }], { temperature: 0.3 });
      const data = await parseJsonResponse(raw);
      if (id !== requestId.current) return;
      if (!data?.tenses?.length) throw new Error('empty');
      rememberVerb(meaning);
      setVerb(data);
      setTenseIdx(0);
      saveActivityScore(user.uid, activeProfile.id, activeLanguage, 'verbs', 1).catch(() => {});
    } catch {
      if (id === requestId.current) toast.error('Could not load a verb. Try again.');
    }
    if (id === requestId.current) setLoading(false);
  }

  function loadVerb() {
    stop();
    setLoading(true);
    fetchVerb();
  }

  // ActivitiesPage remounts this component when the language changes, so this runs once per language.
  useEffect(() => {
    // fetchVerb only sets state after awaiting the API, so no cascading render
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVerb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tense = verb?.tenses?.[tenseIdx];

  return (
    <div className="activity-container">
      <div className="game-header">
        <h3>Verb of the Moment</h3>
      </div>

      {loading && <div className="game-start"><div className="spinner" /></div>}

      {!loading && !verb && (
        <div className="game-start">
          <button className="btn-primary" onClick={loadVerb}>Try again</button>
        </div>
      )}

      {!loading && verb && (
        <div className="verb-card">
          <div className="verb-head">
            <div className="verb-title-row">
              <h4 className="verb-infinitive">{verb.infinitive}</h4>
              <button
                className={`speak-btn icon-only ${speakingKey === 'infinitive' ? 'active' : ''}`}
                onClick={() => speak(verb.infinitive, 'infinitive')}
                aria-label="Listen to the verb"
              >
                {speakingKey === 'infinitive' ? '⏹' : '🔊'}
              </button>
            </div>
            {verb.romanization && <p className="verb-romanization">{verb.romanization}</p>}
            <p className="verb-translation">{verb.translation}</p>
            {verb.irregular && <span className="verb-tag">Irregular</span>}
            {verb.note && <p className="verb-note">💡 {verb.note}</p>}
          </div>

          <div className="topic-chips verb-tenses">
            {verb.tenses.map((t, i) => (
              <button
                key={t.name}
                className={`topic-chip ${i === tenseIdx ? 'selected' : ''}`}
                onClick={() => { stop(); setTenseIdx(i); }}
              >
                {t.name}
              </button>
            ))}
          </div>
          {tense?.nameTranslation && <p className="verb-tense-translation">{tense.nameTranslation}</p>}

          <ul className="verb-rows">
            {tense?.rows?.map((row, i) => {
              const key = `${tenseIdx}-${i}`;
              return (
                <li key={key} className="verb-row">
                  <div className="verb-row-main">
                    <div>
                      <p className="verb-form">{row.form}</p>
                      {row.romanization && <p className="verb-romanization">{row.romanization}</p>}
                    </div>
                    <button
                      className={`speak-btn icon-only ${speakingKey === key ? 'active' : ''}`}
                      onClick={() => speak(row.example, key)}
                      aria-label={`Listen to the example for ${row.pronoun}`}
                    >
                      {speakingKey === key ? '⏹' : '🔊'}
                    </button>
                  </div>
                  <p className="verb-example">{row.example}</p>
                  <p className="verb-example-translation">{row.exampleTranslation}</p>
                </li>
              );
            })}
          </ul>

          <button className="btn-primary" onClick={loadVerb}>🎲 New verb</button>
        </div>
      )}
    </div>
  );
}
