import { useState, useRef, useEffect } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { useNavigate } from 'react-router-dom';
import { chatCompletion } from '../../utils/openai';
import { buildOnboardingPrompt } from '../../utils/prompts';
import { SUPPORTED_LANGUAGES, NATIVE_LANGUAGES } from '../../data/languages';
import toast from 'react-hot-toast';

export default function ProfileOnboarding() {
  const { addProfile, switchProfile } = useProfile();
  const navigate = useNavigate();

  const [step, setStep] = useState('info'); // 'info' | 'language' | 'assessment'
  const [name, setName] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState('en');
  const [selectedLangs, setSelectedLangs] = useState([]);
  const [currentAssessLang, setCurrentAssessLang] = useState(null);
  const [assessIdx, setAssessIdx] = useState(0);
  const [keywords, setKeywords] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedLevel, setSuggestedLevel] = useState(null);
  const [langLevels, setLangLevels] = useState({});
  const [saving, setSaving] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function toggleLang(code) {
    setSelectedLangs(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  }

  function startAssessment() {
    if (selectedLangs.length === 0) return toast.error('Pick at least one language.');
    const lang = selectedLangs[assessIdx];
    setCurrentAssessLang(lang);
    setStep('assessment');
    startAssessmentChat(lang);
  }

  async function startAssessmentChat(lang) {
    setLoading(true);
    const profile = { name, nativeLanguage, keywords: keywords.split(',').map(k => k.trim()).filter(Boolean) };
    const systemPrompt = buildOnboardingPrompt({ profile, language: lang });
    try {
      const reply = await chatCompletion([{ role: 'user', content: 'Hello, I am ready for my assessment.' }], {
        model: 'gpt-4o',
      });
      // Use the system prompt approach properly
      const firstMsg = await chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Hi! I want to start my language assessment.' }
      ]);
      setMessages([{ role: 'assistant', content: firstMsg }]);
    } catch {
      toast.error('Could not start assessment. Check your OpenAI API key.');
    }
    setLoading(false);
  }

  async function sendAssessmentMessage() {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input.trim() };
    setInput('');
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    const profile = { name, nativeLanguage, keywords: keywords.split(',').map(k => k.trim()).filter(Boolean) };
    const systemPrompt = buildOnboardingPrompt({ profile, language: currentAssessLang });

    try {
      const reply = await chatCompletion([
        { role: 'system', content: systemPrompt },
        ...newMessages
      ]);

      const match = reply.match(/SUGGESTED_LEVEL:\s*(\d+)/);
      if (match) {
        const level = parseInt(match[1]);
        setSuggestedLevel(level);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      toast.error('Error communicating with AI.');
    }
    setLoading(false);
  }

  function acceptLevel() {
    const level = suggestedLevel || 1;
    const newLevels = { ...langLevels, [currentAssessLang]: { level } };
    setLangLevels(newLevels);

    const nextIdx = assessIdx + 1;
    if (nextIdx < selectedLangs.length) {
      setAssessIdx(nextIdx);
      const nextLang = selectedLangs[nextIdx];
      setCurrentAssessLang(nextLang);
      setMessages([]);
      setSuggestedLevel(null);
      setInput('');
      startAssessmentChat(nextLang);
    } else {
      finishProfile(newLevels);
    }
  }

  async function finishProfile(levels) {
    setSaving(true);
    const langData = {};
    selectedLangs.forEach(code => {
      langData[code] = { level: levels[code]?.level || 1, sessions: 0 };
    });

    try {
      const profile = await addProfile({
        name,
        nativeLanguage,
        languages: langData,
        keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
      });
      switchProfile(profile);
      navigate('/');
      toast.success(`Welcome, ${name}! Your profile is ready.`);
    } catch {
      toast.error('Error saving profile.');
    }
    setSaving(false);
  }

  if (step === 'info') {
    return (
      <div className="page">
        <div className="page-content center-content">
          <h2 className="page-title">Create Profile</h2>

          <div className="field-group">
            <label>Your name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jeremy" />
          </div>

          <div className="field-group">
            <label>Your native language</label>
            <select value={nativeLanguage} onChange={e => setNativeLanguage(e.target.value)}>
              {NATIVE_LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label>Your interests (comma-separated)</label>
            <input
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="NBA, cooking, travel, Wembanyama..."
            />
            <span className="field-hint">These help personalize your lessons</span>
          </div>

          <button
            className="btn-primary btn-full"
            onClick={() => setStep('language')}
            disabled={!name.trim()}
          >
            Next →
          </button>
        </div>
      </div>
    );
  }

  if (step === 'language') {
    return (
      <div className="page">
        <div className="page-content center-content">
          <h2 className="page-title">What are you learning?</h2>
          <p className="subtitle">Pick one or more languages</p>

          <div className="lang-grid">
            {Object.values(SUPPORTED_LANGUAGES).map(lang => (
              <button
                key={lang.code}
                className={`lang-card ${selectedLangs.includes(lang.code) ? 'selected' : ''}`}
                onClick={() => toggleLang(lang.code)}
              >
                <span className="lang-flag">{lang.flag}</span>
                <span className="lang-name">{lang.name}</span>
                {selectedLangs.includes(lang.code) && <span className="check-badge">✓</span>}
              </button>
            ))}
          </div>

          <button
            className="btn-primary btn-full mt-16"
            onClick={startAssessment}
            disabled={selectedLangs.length === 0}
          >
            Start Assessment →
          </button>
        </div>
      </div>
    );
  }

  const langInfo = SUPPORTED_LANGUAGES[currentAssessLang];

  return (
    <div className="page conversation-page">
      <div className="convo-header">
        <h3>{langInfo?.flag} {langInfo?.name} Assessment</h3>
        <span className="assess-progress">{assessIdx + 1}/{selectedLangs.length}</span>
      </div>

      <div className="messages-container">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="bubble">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="message assistant">
            <div className="bubble typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {suggestedLevel ? (
        <div className="assess-result">
          <p>Suggested starting level: <strong>Level {suggestedLevel}</strong></p>
          <div className="assess-actions">
            <button className="btn-primary" onClick={acceptLevel} disabled={saving}>
              {saving ? 'Saving...' : assessIdx + 1 < selectedLangs.length ? 'Next Language →' : 'Finish Setup ✓'}
            </button>
          </div>
        </div>
      ) : (
        <div className="input-row">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendAssessmentMessage()}
            placeholder="Type your response..."
            disabled={loading}
          />
          <button className="send-btn" onClick={sendAssessmentMessage} disabled={loading || !input.trim()}>
            ➤
          </button>
        </div>
      )}
    </div>
  );
}
