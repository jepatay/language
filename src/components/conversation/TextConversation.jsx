import { useState, useRef, useEffect, useCallback } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { chatCompletion, fetchRecentNews, correctMessage, generateTopicSuggestions, generateReplySuggestions } from '../../utils/openai';
import { buildSystemPrompt } from '../../utils/prompts';
import {
  saveMessage, getMessages, saveConversationSummary,
  getConversationMeta, clearConversation,
} from '../../firebase/firestore';
import { SUPPORTED_LANGUAGES } from '../../data/languages';
import { LEVEL_DESCRIPTORS } from '../../data/levelDescriptors';
import toast from 'react-hot-toast';

const MAX_FULL_MESSAGES = 20;

function CorrectionCard({ correction }) {
  if (!correction) return null;
  const { hasError, segments, note } = correction;

  return (
    <div className={`correction-card ${hasError ? 'has-error' : 'perfect'}`}>
      <span className="correction-label">{hasError ? '✏️' : '✓'}</span>
      <div className="correction-body">
        {hasError ? (
          <>
            <div className="correction-diff">
              {(segments || []).map((seg, i) => (
                <span key={i} className={`diff-${seg.type}`}>{seg.text}</span>
              ))}
            </div>
            {note && <p className="correction-note">💡 {note}</p>}
          </>
        ) : (
          <span className="correction-perfect">Perfect!</span>
        )}
      </div>
    </div>
  );
}

export default function TextConversation({ onSwitchVoice }) {
  const { activeProfile, activeLanguage } = useProfile();
  const { user } = useAuth();
  const [phase, setPhase] = useState('loading'); // 'loading' | 'topics' | 'chatting'
  const [topics, setTopics] = useState([]);
  const [newsSnippet, setNewsSnippet] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [summary, setSummary] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const chatEndRef = useRef(null);

  const lang = activeLanguage ? SUPPORTED_LANGUAGES[activeLanguage] : null;

  const loadHistory = useCallback(async () => {
    if (!user || !activeProfile || !activeLanguage) return;
    setPhase('loading');
    try {
      const meta = await getConversationMeta(user.uid, activeProfile.id, activeLanguage);
      if (meta?.summary) setSummary(meta.summary);
      const msgs = await getMessages(user.uid, activeProfile.id, activeLanguage, MAX_FULL_MESSAGES);
      const formatted = msgs.map(m => ({ role: m.role, content: m.content }));
      if (formatted.length > 0) {
        setMessages(formatted);
        setPhase('chatting');
      } else {
        await initTopics();
      }
    } catch {
      await initTopics();
    }
  }, [user, activeProfile, activeLanguage]);

  useEffect(() => {
    setMessages([]);
    setSummary('');
    setTopics([]);
    setNewsSnippet('');
    setSuggestions([]);
    setSuggestionsOpen(false);
    loadHistory();
  }, [activeProfile?.id, activeLanguage]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, phase]);

  async function initTopics() {
    setLoading(true);
    setLoadingStatus('Finding topics for you...');
    const keywords = activeProfile.keywords || [];

    const [newsResult, topicsResult] = await Promise.allSettled([
      keywords.length > 0 ? fetchRecentNews(keywords) : Promise.resolve(null),
      generateTopicSuggestions(keywords, lang?.name || activeLanguage, null),
    ]);

    const news = newsResult.status === 'fulfilled' ? newsResult.value : null;
    if (news) setNewsSnippet(news);

    // Re-generate topics with news if we got it
    let finalTopics = topicsResult.status === 'fulfilled' ? topicsResult.value : [];
    if (news && finalTopics.length > 0) {
      const withNews = await generateTopicSuggestions(keywords, lang?.name, news).catch(() => finalTopics);
      finalTopics = withNews;
    }
    if (finalTopics.length === 0) finalTopics = ['💬 Free conversation', '📰 Latest news', '🎯 Vocabulary practice'];

    setTopics(finalTopics);
    setLoading(false);
    setLoadingStatus('');
    setPhase('topics');
  }

  async function startWithTopic(topic) {
    setPhase('chatting');
    setLoading(true);
    const systemPrompt = buildSystemPrompt({ profile: activeProfile, language: activeLanguage, mode: 'text' });
    const newsCtx = newsSnippet ? ` Use this recent news as context: "${newsSnippet}"` : '';
    const context = `The learner chose this topic: "${topic}".${newsCtx} Start the conversation naturally in ${lang?.name} around this topic.`;

    try {
      const reply = await chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context },
      ]);
      const aiMsg = { role: 'assistant', content: reply };
      setMessages([aiMsg]);
      await saveMessage(user.uid, activeProfile.id, activeLanguage, aiMsg);
    } catch {
      toast.error('Could not start conversation. Check your OpenAI API key.');
      setPhase('topics');
    }
    setLoading(false);
  }

  async function resetConversation() {
    try {
      await clearConversation(user.uid, activeProfile.id, activeLanguage);
    } catch {
      // Non-critical — continue anyway
    }
    setMessages([]);
    setSummary('');
    setTopics([]);
    setNewsSnippet('');
    await initTopics();
  }

  async function toggleSuggestions() {
    if (suggestionsOpen) {
      setSuggestionsOpen(false);
      return;
    }
    setSuggestionsOpen(true);
    setSuggestionsLoading(true);
    try {
      const level = activeProfile.languages?.[activeLanguage]?.level || 1;
      const levelInfo = LEVEL_DESCRIPTORS[level];
      const result = await generateReplySuggestions({
        languageName: lang?.name || activeLanguage,
        level,
        levelLabel: levelInfo?.label || '',
        keywords: activeProfile.keywords || [],
        recentMessages: messages,
      });
      setSuggestions(result);
    } catch {
      toast.error('Could not load suggestions.');
      setSuggestions([]);
    }
    setSuggestionsLoading(false);
  }

  function applySuggestion(text) {
    setInput(text);
    setSuggestionsOpen(false);
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    setSuggestionsOpen(false);
    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    await saveMessage(user.uid, activeProfile.id, activeLanguage, userMsg);

    const systemPrompt = buildSystemPrompt({ profile: activeProfile, language: activeLanguage, mode: 'text' });
    const contextPrefix = summary ? [{ role: 'system', content: `Previous session summary: ${summary}` }] : [];
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...contextPrefix,
      ...newMessages.slice(-MAX_FULL_MESSAGES),
    ];

    const [replyResult, correctionResult] = await Promise.allSettled([
      chatCompletion(apiMessages),
      correctMessage(text, lang?.name, activeProfile.nativeLanguage || 'English'),
    ]);

    if (replyResult.status === 'rejected') {
      toast.error('Error getting response.');
      setMessages(prev => prev.slice(0, -1));
      setLoading(false);
      return;
    }

    const correction = correctionResult.status === 'fulfilled' ? correctionResult.value : null;
    const aiMsg = { role: 'assistant', content: replyResult.value };

    // Attach correction to the user message
    const finalMessages = [
      ...newMessages.slice(0, -1),
      { ...userMsg, correction },
      aiMsg,
    ];
    setMessages(finalMessages);
    await saveMessage(user.uid, activeProfile.id, activeLanguage, aiMsg);

    if (finalMessages.length > MAX_FULL_MESSAGES) summarizeOldMessages(finalMessages);
    setLoading(false);
  }

  async function summarizeOldMessages(currentMessages) {
    const toSummarize = currentMessages.slice(0, -10);
    if (toSummarize.length === 0) return;
    try {
      const summaryText = await chatCompletion([
        { role: 'system', content: 'Summarize this conversation in 3-4 sentences. Preserve key topics, vocabulary introduced, and learner progress.' },
        ...toSummarize.map(m => ({ role: m.role, content: m.content })),
      ]);
      const newSummary = summary ? `${summary} Then: ${summaryText}` : summaryText;
      setSummary(newSummary);
      await saveConversationSummary(user.uid, activeProfile.id, activeLanguage, newSummary);
    } catch { /* non-critical */ }
  }

  if (!activeProfile || !activeLanguage) {
    return <div className="center-content"><p>Select a language to start chatting.</p></div>;
  }

  return (
    <div className="conversation-inner">
      <div className="convo-toolbar">
        <span className="lang-tag">{lang?.flag} {lang?.name}</span>
        <div className="toolbar-actions">
          {phase === 'chatting' && (
            <button className="icon-btn" onClick={resetConversation} title="New topic">🔄</button>
          )}
          <button className="icon-btn" onClick={onSwitchVoice} title="Switch to voice">🎙️</button>
        </div>
      </div>

      {phase === 'topics' && (
        <div className="topics-container">
          <p className="topics-label">What do you want to talk about?</p>
          {newsSnippet && (
            <div className="news-pill">📰 {newsSnippet.slice(0, 100)}{newsSnippet.length > 100 ? '…' : ''}</div>
          )}
          <div className="topics-list">
            {topics.map((topic, i) => (
              <button key={i} className="topic-card" onClick={() => startWithTopic(topic)}>
                {topic}
              </button>
            ))}
          </div>
          <button className="text-btn mt-12" onClick={() => {
            const custom = prompt('What do you want to talk about?');
            if (custom?.trim()) startWithTopic(custom.trim());
          }}>
            Something else...
          </button>
        </div>
      )}

      {(phase === 'loading' || (phase === 'topics' && loading)) && (
        <div className="messages-container center-content">
          <div className="spinner" />
          {loadingStatus && <p className="loading-status">{loadingStatus}</p>}
        </div>
      )}

      {phase === 'chatting' && (
        <>
          <div className="messages-container">
            {messages.map((msg, i) => (
              <div key={i}>
                <div className={`message ${msg.role}`}>
                  <div className="bubble">{msg.content}</div>
                </div>
                {msg.role === 'user' && msg.correction && (
                  <CorrectionCard correction={msg.correction} />
                )}
              </div>
            ))}
            {loading && (
              <div className="message assistant">
                <div className="bubble typing"><span /><span /><span /></div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {suggestionsOpen && (
            <div className="suggestions-panel">
              {suggestionsLoading ? (
                <div className="spinner small" />
              ) : suggestions.length > 0 ? (
                suggestions.map((s, i) => (
                  <button key={i} className="suggestion-chip" onClick={() => applySuggestion(s.text)}>
                    <span className="suggestion-text">{s.text}</span>
                    <span className="suggestion-translation">{s.translation}</span>
                  </button>
                ))
              ) : (
                <span className="loading-status">No suggestions right now — try again.</span>
              )}
            </div>
          )}

          <div className="input-row">
            <button
              className={`icon-btn suggest-btn ${suggestionsOpen ? 'active' : ''}`}
              onClick={toggleSuggestions}
              disabled={loading}
              title="Suggest what to say"
              aria-label="Suggest what to say"
            >
              +
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={`Message in ${lang?.name || 'target language'}...`}
              disabled={loading}
            />
            <button className="send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>
              ➤
            </button>
          </div>
        </>
      )}
    </div>
  );
}
