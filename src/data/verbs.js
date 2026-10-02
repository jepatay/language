// Verbs are picked client-side (by English meaning) so each draw is truly random;
// the model then gives the infinitive and conjugations in the target language.
export const CORE_VERBS = [
  'to be', 'to have', 'to do', 'to go', 'to come', 'to say', 'to see', 'to know',
  'to want', 'to can / be able to', 'to eat', 'to drink', 'to sleep', 'to live',
  'to work', 'to speak', 'to understand', 'to give', 'to take', 'to make',
  'to like', 'to love', 'to need', 'to buy', 'to pay', 'to open', 'to close',
  'to read', 'to write', 'to listen', 'to look for', 'to find', 'to play',
  'to run', 'to walk', 'to drive', 'to learn', 'to begin', 'to finish', 'to wait',
  'to help', 'to ask', 'to answer', 'to think', 'to call', 'to cook', 'to travel',
  'to stay', 'to leave', 'to arrive',
];

export const ADVANCED_VERBS = [
  'to remember', 'to forget', 'to believe', 'to decide', 'to choose', 'to explain',
  'to improve', 'to suggest', 'to agree', 'to complain', 'to negotiate', 'to manage',
  'to achieve', 'to avoid', 'to borrow', 'to lend', 'to sell', 'to send', 'to receive',
  'to build', 'to grow', 'to change', 'to win', 'to lose', 'to fall', 'to break',
  'to fix', 'to measure', 'to deliver', 'to hire', 'to train', 'to compete',
  'to celebrate', 'to worry', 'to hope', 'to promise', 'to forgive', 'to share',
  'to discover', 'to require', 'to reduce', 'to increase', 'to launch', 'to expand',
  'to persuade', 'to warn', 'to cancel', 'to schedule', 'to invest', 'to prepare',
];

const RECENT_KEY = 'verbs:recent';
const RECENT_LIMIT = 25;

function readRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
}

export function rememberVerb(meaning) {
  try {
    const recent = [meaning, ...readRecent().filter(v => v !== meaning)].slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch {
    // storage unavailable — repeats are acceptable
  }
}

export function pickRandomVerb(level = 1) {
  const pool = [...new Set(level <= 4 ? CORE_VERBS : [...CORE_VERBS, ...ADVANCED_VERBS])];
  const recent = new Set(readRecent());
  const fresh = pool.filter(v => !recent.has(v));
  const candidates = fresh.length > 0 ? fresh : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
