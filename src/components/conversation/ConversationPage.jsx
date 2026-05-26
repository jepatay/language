import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../layout/Header';
import BottomNav from '../layout/BottomNav';
import TextConversation from './TextConversation';
import VoiceConversation from './VoiceConversation';
import { useProfile } from '../../contexts/ProfileContext';
import { SUPPORTED_LANGUAGES } from '../../data/languages';

export default function ConversationPage() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get('mode') === 'voice' ? 'voice' : 'text');
  const { activeProfile, activeLanguage, switchLanguage } = useProfile();

  const languages = activeProfile?.languages || {};
  const langCodes = Object.keys(languages);
  const lang = activeLanguage ? SUPPORTED_LANGUAGES[activeLanguage] : null;

  return (
    <div className="page">
      <Header title={`${lang?.flag || ''} Conversation`} />
      <div className="page-content no-pad conversation-page">

        {langCodes.length > 1 && (
          <div className="lang-tabs">
            {langCodes.map(code => {
              const l = SUPPORTED_LANGUAGES[code];
              return (
                <button
                  key={code}
                  className={`lang-tab ${activeLanguage === code ? 'active' : ''}`}
                  onClick={() => switchLanguage(code)}
                >
                  {l?.flag} {l?.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="mode-toggle">
          <button className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}>💬 Text</button>
          <button className={mode === 'voice' ? 'active' : ''} onClick={() => setMode('voice')}>🎙️ Voice</button>
        </div>

        {mode === 'text'
          ? <TextConversation onSwitchVoice={() => setMode('voice')} />
          : <VoiceConversation onSwitchText={() => setMode('text')} />
        }
      </div>
      <BottomNav />
    </div>
  );
}
