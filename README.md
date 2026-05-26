# LinguaMe

A mobile-first language learning web app built with React + Vite, Firebase, and OpenAI.

## Features

- **Invite-only access** — no public signup; admin-generated codes required
- **Multi-profile support** — switch between profiles (e.g. Jeremy, daughter) within one account
- **Two target languages at launch** — Brazilian Portuguese and Danish
- **10-level system** — structured progression from beginner (Level 1) to fluent (Level 10)
- **Text & Voice Conversation** — GPT-4o chat with Whisper STT + TTS playback
- **Pronunciation Practice** — record yourself, get scored and native-language-specific feedback
- **4 Games** — Word Order (drag & drop), Story Quiz, Sentence Fixer, Speed Round
- **Smart memory** — conversation history and session summaries saved per profile per language
- **Admin panel** — user management, invite code generation, usage stats
- **SEO-blocked** — noindex/nofollow headers prevent search engine indexing

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite |
| Auth | Firebase Authentication |
| Database | Firebase Firestore |
| AI | OpenAI GPT-4o, Whisper, TTS |
| Hosting | Render (static site) |
| Drag & drop | @dnd-kit |

## Setup

### 1. Clone and Install

```bash
git clone <repo-url>
cd language
npm install
```

### 2. Firebase Setup

1. Create a Firebase project at console.firebase.google.com
2. Enable **Authentication** with Email/Password sign-in
3. Enable **Firestore Database** in production mode
4. Copy your Firebase config keys

### 3. Firestore Security Rules

Deploy these rules in the Firebase console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /inviteCodes/{codeId} {
      allow read: if true;
      allow write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      match /{subcollection=**} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
    match /users/{uid} {
      allow read: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
  }
}
```

### 4. Create Admin Account

1. In Firestore console, create a document in `inviteCodes` collection:
   ```json
   { "code": "ADMINCODE", "used": false }
   ```
2. Register in the app using that code
3. In Firestore console, find your user doc at `users/{uid}` and add `isAdmin: true`

### 5. Environment Variables

```bash
cp .env.example .env
```

Fill in:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_OPENAI_API_KEY=sk-...
```

> Note: The OpenAI API key is exposed client-side via Vite. For a private, invite-only app this is acceptable. For production at scale, proxy calls through a backend.

### 6. Run Locally

```bash
npm run dev
```

## Render Deployment

1. Push to GitHub
2. In Render, create a **Static Site**:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
3. Add all `VITE_*` environment variables in Render's Environment settings
4. The `render.yaml` configures:
   - `X-Robots-Tag: noindex, nofollow` on all routes
   - SPA fallback rewrite rule

## Adding New Languages

Edit `src/data/languages.js` and add an entry:

```js
'fr-FR': {
  code: 'fr-FR',
  name: 'French',
  nativeName: 'Francais',
  flag: '🇫🇷',
  whisperCode: 'fr',
  ttsVoice: 'alloy',
},
```

Everything else picks it up automatically.

## Architecture

```
src/
  firebase/
    config.js            Firebase initialization
    firestore.js         All Firestore read/write operations
  contexts/
    AuthContext.jsx      Auth state, login, register, logout
    ProfileContext.jsx   Active profile and language state
  data/
    levelDescriptors.js  Level 1-10 definitions
    languages.js         Supported language configs
  utils/
    openai.js            OpenAI API calls (chat, STT, TTS)
    prompts.js           All AI system prompts
  components/
    auth/                Login and invite code screen
    admin/               Admin panel
    profile/             Profile switcher, onboarding, settings
    conversation/        Text and voice chat pages
    games/               Word Order, Story Quiz, Sentence Fixer, Speed Round
    activities/          Pronunciation practice
    home/                Dashboard with language cards
    layout/              Header, BottomNav, route guards
```

## Jeremy's Profile

After setup, create a profile:
- Name: Jeremy
- Native Language: French
- Languages: Brazilian Portuguese + Danish (run assessment for each)
- Keywords: NBA, Wembanyama, San Antonio Spurs, ...
