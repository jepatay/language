export const LEVEL_DESCRIPTORS = {
  1: {
    label: 'Total Beginner',
    description: 'Greetings, colors, numbers, basic nouns. Single words and very short phrases.',
    topics: ['greetings', 'colors', 'numbers 1-20', 'basic nouns', 'yes/no'],
    grammar: ['basic nouns', 'simple present (am/is/are equivalent)'],
    vocabSize: '100-200 words',
  },
  2: {
    label: 'Elementary',
    description: 'Simple present tense, family, food. Short sentences about daily life.',
    topics: ['family members', 'food & drink', 'daily routine', 'shopping basics'],
    grammar: ['simple present tense', 'articles', 'basic plurals'],
    vocabSize: '300-500 words',
  },
  3: {
    label: 'Pre-Intermediate',
    description: 'Questions, daily routines, simple descriptions. Getting around conversations.',
    topics: ['asking directions', 'describing people', 'hobbies', 'weather', 'time expressions'],
    grammar: ['question formation', 'adjectives', 'basic conjunctions'],
    vocabSize: '600-900 words',
  },
  4: {
    label: 'Intermediate',
    description: 'Past tense, preferences, short stories. Can talk about what happened.',
    topics: ['talking about the past', 'likes & dislikes', 'travel', 'simple stories'],
    grammar: ['past tense', 'comparative adjectives', 'want/need/like + infinitive'],
    vocabSize: '1000-1500 words',
  },
  5: {
    label: 'Upper-Intermediate',
    description: 'Opinions, news topics, past + future tense. Can discuss current events simply.',
    topics: ['news & current events', 'expressing opinions', 'future plans', 'sports & culture'],
    grammar: ['future tense', 'present perfect', 'modal verbs', 'because/although'],
    vocabSize: '1500-2500 words',
  },
  6: {
    label: 'Advanced Intermediate',
    description: 'Conditionals, emotions, debating simple ideas. Nuanced conversations.',
    topics: ['hypothetical situations', 'emotions & feelings', 'simple debates', 'pop culture'],
    grammar: ['conditionals (if/when)', 'subjunctive intro', 'relative clauses'],
    vocabSize: '2500-4000 words',
  },
  7: {
    label: 'Advanced',
    description: 'Complex sentences, idioms intro, cultural references. Sounds much more natural.',
    topics: ['idioms & expressions', 'cultural references', 'storytelling', 'humor'],
    grammar: ['complex sentence structures', 'passive voice', 'reported speech'],
    vocabSize: '4000-6000 words',
  },
  8: {
    label: 'Upper Advanced',
    description: 'Nuanced grammar, humor, sarcasm. Can express subtlety and personality.',
    topics: ['sarcasm & irony', 'nuanced debate', 'abstract topics', 'regional expressions'],
    grammar: ['advanced subjunctive', 'nuanced tenses', 'pragmatic markers'],
    vocabSize: '6000-9000 words',
  },
  9: {
    label: 'Near-Native',
    description: 'Near-native topics, abstract concepts. Comfortable with almost anything.',
    topics: ['philosophy', 'politics', 'abstract ideas', 'wordplay', 'literature references'],
    grammar: ['full grammar range', 'stylistic variation', 'register switching'],
    vocabSize: '9000-12000 words',
  },
  10: {
    label: 'Fluent',
    description: 'Full fluency: idioms, debate, wordplay. Indistinguishable from a native speaker in writing.',
    topics: ['anything & everything', 'wordplay & puns', 'complex debate', 'literature & poetry'],
    grammar: ['complete mastery', 'stylistic nuance', 'dialectal awareness'],
    vocabSize: '12000+ words',
  },
};

export function getLevelLabel(level) {
  return LEVEL_DESCRIPTORS[level]?.label || `Level ${level}`;
}

export function getLevelDescription(level) {
  return LEVEL_DESCRIPTORS[level]?.description || '';
}
