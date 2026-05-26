import { useState, useRef, useEffect, useCallback } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { chatCompletion, fetchRecentNews } from '../../utils/openai';
import { buildSystemPrompt } from '../../utils/prompts';
import { saveMessage, getMessages, saveConversationSummary, getConversationMeta } from '../../firebase/firestore';
import { SUPPORTED_LANGUAGES } from '../../data/languages';
import toast from 'react-hot-toast';

const MAX_FULL_MESSAGES = 20;

export default function TextConversation({ onSwitchVoice }) {
  const { activeProfile, activeLanguage } = useProfile();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [summary, setSummary] = useState('');
  const chatEndRef = useRef(null);

  const lang = activeLanguage ? SUPPORTED_LANGUAGES[activeLanguage] : null;

  const loadHistory = useCallback(async () => {
    if (!user || !activeProfile || !activeLanguage) return;
    try {
      const meta = await getConversationMeta(user.uid, activeProfile.id, activeLanguage);
      if (meta?.summary) setSummary(meta.summary);
      const msgs = await getMessages(user.uid, activeProfile.id, activeLanguage, MAX_FULL_MESSAGES);
      const formatted = msgs.map(m => ({ role: m.role, content: m.content }));
      setMessages(formatted);
      if (formatted.length === 0) {
        await startConversation(meta?.summary);
      }
    } catch {
      await startConversation();
    }
    setInitialized(true);
  }, [user, activeProfile, activeLanguage]);

  useEffect(() => {
    setMessages([]);
    setInitialized(false);
    setSummary('');
    loadHistory();
  }, [activeProfile?.id, activeLanguage]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function startConversation(existingSummary) {
    setLoading(true);
    const keywords = activeProfile.keywords || [];
    let newsContext = '';

    if (!existingSummary && keywords.length > 0) {
      setLoadingStatus('Fetching today\'s news...');
      const news = await fetchRecentNews(keywords).catch(() => null);
      if (news) newsContext = `\n\nFRESH NEWS TO USE AS OPENER: "${news}" — weave this naturally into your opening as a conversation starter.`;
    }

    setLoadingStatus('');
    const systemPrompt = buildSystemPrompt({ profile: activeProfile, language: activeLanguage, mode: 'text' });
    const context = existingSummary
      ? `[Previous session summary: ${existingSummary}] Start with a brief warm continuation.`
      : `Start with a warm greeting and dive straight into a topic the learner cares about.${newsContext}`;

    try {
      const reply = await chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context }
      ]);
      const aiMsg = { role: 'assistant', content: reply };
      setMessages([aiMsg]);
      await saveMessage(user.uid, activeProfile.id, activeLanguage, aiMsg);
    } catch {
      toast.error('Could not start conversation. Check your OpenAI API key.');
    }
    setLoading(false);
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input.trim() };
    setInput('');
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    await saveMessage(user.uid, activeProfile.id, activeLanguage, userMsg);

    const systemPrompt = buildSystemPrompt({ profile: activeProfile, language: activeLanguage, mode: 'text' });
    const contextPrefix = summary ? [{ role: 'system', content: `Previous session summary: ${summary}` }] : [];

    try {
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...contextPrefix,
        ...newMessages.slice(-MAX_FULL_MESSAGES),
      ];
      const reply = await chatCompletion(apiMessages);
      const aiMsg = { role: 'assistant', content: reply };
      const finalMessages = [...newMessages, aiMsg];
      setMessages(finalMessages);
      await saveMessage(user.uid, activeProfile.id, activeLanguage, aiMsg);

      if (finalMessages.length > MAX_FULL_MESSAGES) {
        summarizeOldMessages(finalMessages);
      }
    } catch {
      toast.error('Error getting response.');
      setMessages(newMessages);
    }
    setLoading(false);
  }

  async function summarizeOldMessages(currentMessages) {
    const toSummarize = currentMessages.slice(0, -10);
    if (toSummarize.length === 0) return;
    try {
      const summaryText = await chatCompletion([
        { role: 'system', content: 'Summarize this conversation in 3-4 sentences, preserving key topics discussed, vocabulary introduced, and the learner\'s progress. Be concise.' },
        ...toSummarize,
      ]);
      const newSummary = summary ? `${summary} Then: ${summaryText}` : summaryText;
      setSummary(newSummary);
      await saveConversationSummary(user.uid, activeProfile.id, activeLanguage, newSummary);
    } catch {
      // Silent fail — summarization is non-critical
    }
  }

  if (!activeProfile || !activeLanguage) {
    return (
      <div className="center-content">
        <p>Select a language to start chatting.</p>
      </div>
    );
  }

  return (
    <div className="conversation-inner">
      <div className="convo-toolbar">
        <span className="lang-tag">{lang?.flag} {lang?.name}</span>
        <button className="icon-btn" onClick={onSwitchVoice} title="Switch to voice">🎙️</button>
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
              {loadingStatus
                ? <span className="loading-status">{loadingStatus}</span>
                : <><span /><span /><span /></>
              }
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="input-row">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder={`Message in ${lang?.name || 'the target language'}...`}
          disabled={loading || !initialized}
        />
        <button className="send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>
          ➤
        </button>
      </div>
    </div>
  );
}
