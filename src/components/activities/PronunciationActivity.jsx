import { useState, useRef } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { chatCompletion, transcribeAudio, parseJsonResponse } from '../../utils/openai';
import { buildPronunciationPrompt } from '../../utils/prompts';
import { saveActivityScore } from '../../firebase/firestore';
import { SUPPORTED_LANGUAGES } from '../../data/languages';
import { LEVEL_DESCRIPTORS } from '../../data/levelDescriptors';
import toast from 'react-hot-toast';

const DIFFICULTIES = ['sentence', 'paragraph'];

export default function PronunciationActivity() {
  const { activeProfile, activeLanguage } = useProfile();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [difficulty, setDifficulty] = useState('sentence');
  const [totalScore, setTotalScore] = useState(0);
  const [rounds, setRounds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const lang = activeLanguage ? SUPPORTED_LANGUAGES[activeLanguage] : null;

  async function generateText() {
    if (!activeProfile || !activeLanguage) return;
    setGenerating(true);
    setResult(null);
    const level = activeProfile.languages?.[activeLanguage]?.level || 1;
    const levelInfo = LEVEL_DESCRIPTORS[level];
    const keywords = activeProfile.keywords || [];

    const prompt = `Generate a ${difficulty === 'paragraph' ? 'short paragraph (4-5 sentences)' : 'single sentence'} in ${lang.name} suitable for a level ${level} learner (${levelInfo.label}).
Tie it to their interests: ${keywords.join(', ')}.
Requirements:
- Level-appropriate vocabulary
- Natural, interesting content
- ${difficulty === 'paragraph' ? '4-5 sentences' : '8-15 words'}
Respond with ONLY the ${lang.name} text, nothing else.`;

    try {
      const generated = await chatCompletion([{ role: 'user', content: prompt }]);
      setText(generated.trim());
    } catch {
      toast.error('Could not generate text.');
    }
    setGenerating(false);
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
        await analyzeRecording(blob);
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

  async function analyzeRecording(blob) {
    setLoading(true);
    try {
      const transcription = await transcribeAudio(blob, lang?.whisperCode);
      if (!transcription?.trim()) {
        toast.error('Could not hear you clearly. Try again.');
        setLoading(false);
        return;
      }

      const prompt = buildPronunciationPrompt({
        profile: activeProfile,
        language: activeLanguage,
        originalText: text,
        transcription,
      });

      const raw = await chatCompletion([{ role: 'user', content: prompt }]);
      const evalResult = await parseJsonResponse(raw);
      setResult({ ...evalResult, transcription });
      setTotalScore(prev => prev + (evalResult.score || 0));
      setRounds(prev => prev + 1);
      saveActivityScore(user.uid, activeProfile.id, activeLanguage, 'pronunciation', evalResult.score || 0).catch(() => {});
    } catch {
      toast.error('Error analyzing pronunciation.');
    }
    setLoading(false);
  }

  return (
    <div className="activity-container">
      <div className="game-header">
        <h3>Pronunciation Practice</h3>
        <div className="score-display">Avg: {rounds > 0 ? Math.round(totalScore / rounds) : '—'}/100</div>
      </div>

      <div className="difficulty-row">
        {DIFFICULTIES.map(d => (
          <button
            key={d}
            className={`diff-btn ${difficulty === d ? 'active' : ''}`}
            onClick={() => setDifficulty(d)}
          >
            {d === 'sentence' ? '1 Sentence' : 'Paragraph'}
          </button>
        ))}
      </div>

      {!text && (
        <div className="game-start">
          <p>Generate text to practice reading aloud in {lang?.name}.</p>
          <button className="btn-primary" onClick={generateText} disabled={generating}>
            {generating ? 'Generating...' : 'Generate Text'}
          </button>
        </div>
      )}

      {text && (
        <div className="pronunc-card">
          <div className="pronunc-text">
            <span className="lang-label">{lang?.flag} Read this aloud:</span>
            <p className="target-text">{text}</p>
          </div>

          <div className="record-controls">
            {!recording && !loading && (
              <div className="record-actions">
                <button
                  className="mic-btn"
                  onPointerDown={startRecording}
                  onPointerUp={stopRecording}
                  onPointerLeave={stopRecording}
                >
                  🎙️
                  <span>Hold to record</span>
                </button>
                <button className="text-btn" onClick={generateText} disabled={generating}>
                  Regenerate text
                </button>
              </div>
            )}
            {recording && (
              <button
                className="mic-btn recording"
                onPointerUp={stopRecording}
                onPointerLeave={stopRecording}
              >
                🔴
                <span>Recording... release to analyze</span>
              </button>
            )}
            {loading && (
              <div className="loading-card">
                <div className="spinner" />
                <p>Analyzing pronunciation...</p>
              </div>
            )}
          </div>

          {result && (
            <div className="pronunc-result">
              <div className="score-ring">
                <div className={`score-circle ${result.score >= 80 ? 'great' : result.score >= 60 ? 'good' : 'needs-work'}`}>
                  {result.score}
                </div>
                <span>/ 100</span>
              </div>

              <div className="transcription">
                <strong>What you said:</strong>
                <p>"{result.transcription}"</p>
              </div>

              <p className="feedback-text">{result.feedback}</p>

              {result.tips?.length > 0 && (
                <div className="tips-list">
                  <strong>💡 Tips for {activeProfile.nativeLanguage} speakers:</strong>
                  {result.tips.map((tip, i) => <div key={i} className="tip-item">• {tip}</div>)}
                </div>
              )}

              {result.corrections?.length > 0 && (
                <div className="corrections-list">
                  <strong>Words to practice:</strong>
                  {result.corrections.map((c, i) => (
                    <div key={i} className="correction-item">
                      <span className="correction-word">{c.word}</span>
                      <span className="correction-note">{c.note}</span>
                    </div>
                  ))}
                </div>
              )}

              <button className="btn-primary mt-16" onClick={generateText}>
                Try Another
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
