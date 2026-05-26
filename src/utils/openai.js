const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const BASE_URL = 'https://api.openai.com/v1';

async function apiCall(endpoint, options) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI error ${res.status}`);
  }
  return res;
}

export async function chatCompletion(messages, { model = 'gpt-4o', temperature = 0.8 } = {}) {
  const res = await apiCall('/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature }),
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

export async function transcribeAudio(audioBlob, language) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'whisper-1');
  if (language) formData.append('language', language);

  const res = await apiCall('/audio/transcriptions', {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  return data.text;
}

export async function textToSpeech(text, voice = 'nova') {
  const res = await apiCall('/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', input: text, voice }),
  });
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function parseJsonResponse(content) {
  // Extract JSON from markdown code blocks if present
  const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = match ? match[1] : content;
  return JSON.parse(jsonStr.trim());
}

export async function correctMessage(text, languageName, nativeLanguage) {
  if (!text || text.trim().length < 6) return null;
  const prompt = `You are a language teacher. The learner's native language is ${nativeLanguage}, learning ${languageName}.

Their message: "${text}"

Analyze for grammar, spelling, or vocabulary errors in ${languageName}.

Respond ONLY with this JSON (no markdown):
{
  "hasError": boolean,
  "segments": [{"text": "...", "type": "ok"|"wrong"|"fix"}],
  "note": "brief English explanation or null"
}

Segments rules:
- "ok" = correct unchanged text
- "wrong" = what the learner wrote (wrong) — will show in red strikethrough
- "fix" = the correction — will show in green
- Pair each "wrong" immediately with its "fix"
- If no error, return segments as [{"text": "${text}", "type": "ok"}] and hasError: false`;

  const raw = await chatCompletion([{ role: 'user', content: prompt }], { temperature: 0.2 });
  return parseJsonResponse(raw);
}

export async function generateTopicSuggestions(keywords, languageName, newsSnippet) {
  const newsHint = newsSnippet
    ? `One topic should relate to this recent news: "${newsSnippet.slice(0, 120)}"`
    : '';
  const prompt = `Generate exactly 3 short conversation topic suggestions for a ${languageName} learner.
Their interests: ${keywords.length > 0 ? keywords.join(', ') : 'general topics'}.
${newsHint}
Make them specific, fun, and varied. Max 6 words each. Include a relevant emoji at the start.
JSON only: {"topics": ["🏀 topic one", "🌍 topic two", "🍕 topic three"]}`;

  const raw = await chatCompletion([{ role: 'user', content: prompt }], { temperature: 0.95 });
  const data = await parseJsonResponse(raw);
  return data.topics || [];
}

export async function fetchRecentNews(keywords) {
  if (!keywords || keywords.length === 0) return null;
  const topics = keywords.slice(0, 3).join(', ');
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      tools: [{ type: 'web_search_preview' }],
      input: `Today is ${today}. Search for the most recent news from the last 48 hours about: ${topics}. Return a single concise 2-sentence summary of the most interesting recent development. Include the date or "yesterday/today" if relevant. Be specific — no vague generalities.`,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const message = data.output?.find(item => item.type === 'message');
  const text = message?.content?.find(c => c.type === 'output_text')?.text;
  return text?.trim() || null;
}
