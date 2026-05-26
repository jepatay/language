import { useState } from 'react';

export default function KeywordsInput({ keywords = [], onChange }) {
  const [input, setInput] = useState('');

  function addKeyword() {
    const trimmed = input.trim();
    if (!trimmed || keywords.includes(trimmed)) {
      setInput('');
      return;
    }
    onChange([...keywords, trimmed]);
    setInput('');
  }

  function removeKeyword(kw) {
    onChange(keywords.filter(k => k !== kw));
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
    if (e.key === 'Backspace' && input === '' && keywords.length > 0) {
      onChange(keywords.slice(0, -1));
    }
  }

  return (
    <div className="keywords-field">
      <div className="keywords-input-row">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a keyword and press Enter"
        />
        <button
          type="button"
          className="add-kw-btn"
          onClick={addKeyword}
          disabled={!input.trim()}
        >
          Add
        </button>
      </div>

      {keywords.length > 0 && (
        <div className="keywords-tags">
          {keywords.map(kw => (
            <span key={kw} className="kw-tag">
              {kw}
              <button
                type="button"
                className="kw-remove"
                onClick={() => removeKeyword(kw)}
                aria-label={`Remove ${kw}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
