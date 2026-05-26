import { useState, useRef, useEffect, useCallback } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { chatCompletion, transcribeAudio, textToSpeech, fetchRecentNews } from '../../utils/openai';
import { buildSystemPrompt } from '../../utils/prompts';
import { saveMessage, getMessages, getConversationMeta } from '../../firebase/firestore';
import { SUPPORTED_LANGUAGES } from '../../data/languages';
import toast from 'react-hot-toast';

const MAX_MESSAGES = 20;

export default function VoiceConversation({ onSwitchText }) {
  const { activeProfile, activeLanguage } = useProfile();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [summary, setSummary] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);
  const chatEndRef = useRef(null);

  const lang = activeLanguage ? SUPPORTED_LANGUAGES[activeLanguage] : null;

  const loadHistory = useCallback(async () => {
    if (!user || !activeProfile || !activeLanguage) return;
    try {
      const meta = await getConversationMeta(user.uid, activeProfile.id, activeLanguage);
      if (meta?.summary) setSummary(meta.summary);
      const msgs = await getMessages(user.uid, activeProfile.id, activeLanguage, MAX_MESSAGES);
      const formatted = msgs.map(m => ({ role: m.role, content: m.content }));
      setMessages(formatted);
      if (formatted.length === 0) {
        await greetUser(meta?.summary);
      }
    } catch {
      await greetUser();
    }
    setInitialized(true);
  }, [user, activeProfile, activeLanguage]);

  useEffect(() => {
    setMessages([]);
    setInitialized(false);
    setSummary('');
    loadHistory();
    return () => stopRecording();
  }, [activeProfile?.id, activeLanguage]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function greetUser(existingSummary) {
    setProcessing(true);
    const keywords = activeProfile.keywords || [];
    let newsContext = '';

    if (!existingSummary && keywords.length > 0) {
      const news = await fetchRecentNews(keywords).catch(() => null);
      if (news) newsContext = `\n\nFRESH NEWS TO USE AS OPENER: "${news}" — use this as your conversation starter. Keep it short for voice.`;
    }

    const systemPrompt = buildSystemPrompt({ profile: activeProfile, language: activeLanguage, mode: 'voice' });
    const context = existingSummary
      ? `[Previous session summary: ${existingSummary}] Give a short warm greeting continuing from before.`
      : `Give a short warm voice greeting and start with a topic the learner cares about.${newsContext}`;

    try {
      const text = await chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context }
      ]);
      const aiMsg = { role: 'assistant', content: text };
      setMessages([aiMsg]);
      await saveMessage(user.uid, activeProfile.id, activeLanguage, aiMsg);
      await speakText(text);
    } catch {
      toast.error('Could not start voice session. Check API key.');
    }
    setProcessing(false);
  }

  async function speakText(text) {
    setPlaying(true);
    try {
      const url = await textToSpeech(text, lang?.ttsVoice || 'nova');
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
        await new Promise(res => {
          audioRef.current.onended = res;
          audioRef.current.onerror = res;
        });
        URL.revokeObjectURL(url);
      }
    } catch {
      toast.error('TTS failed.');
    }
    setPlaying(false);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      toast.error('Microphone access denied.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  async function processAudio(blob) {
    setProcessing(true);
    try {
      const whisperLang = lang?.whisperCode;
      const transcription = await transcribeAudio(blob, whisperLang);
      if (!transcription?.trim()) {
        toast.error('Could not hear you. Try again.');
        setProcessing(false);
        return;
      }

      const userMsg = { role: 'user', content: transcription };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      await saveMessage(user.uid, activeProfile.id, activeLanguage, userMsg);

      const systemPrompt = buildSystemPrompt({ profile: activeProfile, language: activeLanguage, mode: 'voice' });
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...newMessages.slice(-MAX_MESSAGES),
      ];

      const reply = await chatCompletion(apiMessages);
      const aiMsg = { role: 'assistant', content: reply };
      setMessages([...newMessages, aiMsg]);
      await saveMessage(user.uid, activeProfile.id, activeLanguage, aiMsg);
      await speakText(reply);
    } catch {
      toast.error('Error processing voice.');
    }
    setProcessing(false);
  }

  if (!activeProfile || !activeLanguage) {
    return <div className="center-content"><p>Select a language to start.</p></div>;
  }

  return (
    <div className="conversation-inner">
      <audio ref={audioRef} />

      <div className="convo-toolbar">
        <span className="lang-tag">{lang?.flag} {lang?.name} · Voice</span>
        <button className="icon-btn" onClick={onSwitchText} title="Switch to text">💬</button>
      </div>

      <div className="messages-container">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="bubble">
              {msg.role === 'user' && <span className="voice-label">🎙️ </span>}
              {msg.content}
            </div>
          </div>
        ))}
        {(processing || playing) && (
          <div className="message assistant">
            <div className="bubble typing"><span /><span /><span /></div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="voice-controls">
        {playing && <p className="voice-status">🔊 Speaking...</p>}
        {processing && !playing && <p className="voice-status">⏳ Processing...</p>}

        <button
          className={`mic-btn ${recording ? 'recording' : ''}`}
          onPointerDown={startRecording}
          onPointerUp={stopRecording}
          onPointerLeave={stopRecording}
          disabled={processing || playing || !initialized}
        >
          {recording ? '🔴' : '🎙️'}
          <span>{recording ? 'Release to send' : 'Hold to speak'}</span>
        </button>
      </div>
    </div>
  );
}
