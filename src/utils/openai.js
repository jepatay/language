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
