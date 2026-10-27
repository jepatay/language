import { useState, useRef, useEffect } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { chatCompletion, parseJsonResponse, textToSpeech } from '../../utils/openai';
import { buildVerbConjugationPrompt } from '../../utils/prompts';
import { SUPPORTED_LANGUAGES } from '../../data/languages';
import { VERBS_BY_LANGUAGE } from '../../data/verbs';
import toast from 'react-hot-toast';

const CACHE_PREFIX = 'linguame-verb-v1|';

function readCache(key) {
  try {
    const value = localStorage.getItem(CACHE_PREFIX + key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
  } catch {
    // storage full or blocked — conjugations just won't be cached
  }
}

export default function VerbPractice() {
  const { activeProfile, activeLanguage } = useProfile();
  const [verb, setVerb] = useState(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [tenseIdx, setTenseIdx] = useState(0);
  const [speaking, setSpeaking] = useState(null); // text currently playing
  const audioRef = useRef(null);
  const audioCache = useRef(new Map()); // text -> object URL

  const lang = SUPPORTED_LANGUAGES[activeLanguage];
  const verbSet = VERBS_BY_LANGUAGE[activeLanguage];

  useEffect(() => {
    const cache = audioCache.current;
    return () => {
      audioRef.current?.pause();
      cache.forEach(url => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  function stopAudio() {
    audioRef.current?.pause();
    setSpeaking(null);
  }

  async function speak(text) {
    if (speaking === text) {
      stopAudio();
      return;
    }
    stopAudio();
    setSpeaking(text);
    try {
      let url = audioCache.current.get(text);
      if (!url) {
        url = await textToSpeech(text, lang?.ttsVoice || 'nova');
        audioCache.current.set(text, url);
      }
      if (!audioRef.current) audioRef.current = new Audio();
      const audio = audioRef.current;
      audio.src = url;
      audio.onended = () => setSpeaking(null);
      audio.onerror = () => setSpeaking(null);
      await audio.play();
    } catch {
      toast.error('Could not play audio.');
      setSpeaking(null);
    }
  }

  async function openVerb(v, { refresh = false } = {}) {
    stopAudio();
    setVerb(v);
    setTenseIdx(0);
    const cacheKey = `${activeLanguage}|${activeProfile.nativeLanguage}|${v.infinitive}`;
    const cached = !refresh && readCache(cacheKey);
    if (cached) {
      setData(cached);
      return;
    }
    setData(null);
    setLoading(true);
    try {
      const prompt = buildVerbConjugationPrompt({
        language: activeLanguage,
        nativeLanguage: activeProfile.nativeLanguage,
        level: activeProfile.languages?.[activeLanguage]?.level || 1,
        keywords: activeProfile.keywords || [],
        verb: v,
        tenses: verbSet.tenses,
      });
      const raw = await chatCompletion([{ role: 'user', content: prompt }], { temperature: 0.5 });
      const result = await parseJsonResponse(raw);
      if (!result.tenses?.length) throw new Error('empty');
      setData(result);
      writeCache(cacheKey, result);
    } catch {
      toast.error('Could not load this verb.');
      setVerb(null);
    }
    setLoading(false);
  }

  function closeVerb() {
    stopAudio();
    setVerb(null);
    setData(null);
  }

  if (!verbSet) {
    return (
      <div className="activity-container">
        <p>Verbs aren't available for {lang?.name || 'this language'} yet.</p>
      </div>
    );
  }

  if (verb) {
    const tense = data?.tenses?.[tenseIdx];
    return (
      <div className="activity-container">
        <button className="text-btn verb-back" onClick={closeVerb}>← All verbs</button>

        <div className="verb-hero">
          <h3>{verb.infinitive}</h3>
          {verb.romanization && <p className="verb-roman">{verb.romanization}</p>}
          <p className="verb-meaning">
            {verb.meaning}
            {data?.meaning && data.meaning.toLowerCase() !== verb.meaning.toLowerCase() && <> · {data.meaning}</>}
          </p>
        </div>

        {loading && <div className="game-start"><div className="spinner" /></div>}

        {data && (
          <>
            <div className="tense-tabs">
              {data.tenses.map((t, i) => (
                <button
                  key={t.name + i}
                  className={`topic-chip ${i === tenseIdx ? 'selected' : ''}`}
                  onClick={() => { stopAudio(); setTenseIdx(i); }}
                >
                  {t.name}
                </button>
              ))}
            </div>

            {tense && (
              <div className="conj-list">
                {tense.rows.map((row, i) => (
                  <div key={i} className="conj-row">
                    <div className="conj-main">
                      <p className="conj-form">{row.form}</p>
                      <p className="conj-example">{row.example}</p>
                      {row.romanization && <p className="conj-roman">{row.romanization}</p>}
                      <p className="conj-translation">{row.translation}</p>
                    </div>
                    <button
                      className={`speak-btn conj-speak ${speaking === row.example ? 'active' : ''}`}
                      onClick={() => speak(row.example)}
                      aria-label="Listen to example"
                    >
                      {speaking === row.example ? '⏹' : '🔊'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button className="text-btn verb-refresh" onClick={() => openVerb(verb, { refresh: true })}>
              ↻ New examples
            </button>
          </>
        )}
      </div>
    );
  }

  const q = filter.trim().toLowerCase();
  const visible = q
    ? verbSet.verbs.filter(v =>
        v.infinitive.toLowerCase().includes(q) ||
        v.meaning.toLowerCase().includes(q) ||
        v.romanization?.toLowerCase().includes(q))
    : verbSet.verbs;

  return (
    <div className="activity-container">
      <div className="game-header">
        <h3>Verbs</h3>
      </div>
      <p className="verb-intro">
        The 30 most-used {lang?.name} verbs. Tap one to see it in the 4 key tenses: {verbSet.tenses.join(', ')}.
      </p>
      <input
        className="verb-search"
        type="search"
        placeholder="Search a verb…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />
      <div className="verb-grid">
        {visible.map(v => (
          <button key={v.infinitive} className="verb-card" onClick={() => openVerb(v)}>
            <span className="verb-rank">{verbSet.verbs.indexOf(v) + 1}</span>
            <span className="verb-inf">{v.infinitive}</span>
            <span className="verb-gloss">{v.meaning}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
