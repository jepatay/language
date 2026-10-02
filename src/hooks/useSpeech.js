import { useState, useRef, useEffect, useCallback } from 'react';
import { textToSpeech } from '../utils/openai';
import toast from 'react-hot-toast';

// Plays text through OpenAI TTS. `speakingKey` tells the caller which item is
// playing; audio is cached per speed+text so replays cost no extra API calls.
export function useSpeech(voice = 'nova') {
  const [speakingKey, setSpeakingKey] = useState(null);
  const audioRef = useRef(null);
  const cacheRef = useRef(new Map());

  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      audioRef.current?.pause();
      cache.forEach(url => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setSpeakingKey(null);
  }, []);

  const speak = useCallback(async (text, key, speed = 1) => {
    if (speakingKey === key) {
      stop();
      return;
    }
    stop();
    const cacheKey = `${speed}|${text}`;
    setSpeakingKey(key);
    try {
      let url = cacheRef.current.get(cacheKey);
      if (!url) {
        url = await textToSpeech(text, voice, speed);
        cacheRef.current.set(cacheKey, url);
      }
      if (!audioRef.current) audioRef.current = new Audio();
      const audio = audioRef.current;
      audio.src = url;
      audio.onended = () => setSpeakingKey(null);
      audio.onerror = () => setSpeakingKey(null);
      await audio.play();
    } catch {
      toast.error('Could not play audio.');
      setSpeakingKey(null);
    }
  }, [speakingKey, stop, voice]);

  return { speakingKey, speak, stop };
}
