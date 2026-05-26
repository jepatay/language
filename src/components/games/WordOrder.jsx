import { useState } from 'react';
import { DndContext, closestCenter, DragOverlay, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { chatCompletion, parseJsonResponse } from '../../utils/openai';
import { buildWordOrderPrompt } from '../../utils/prompts';
import { saveActivityScore } from '../../firebase/firestore';
import toast from 'react-hot-toast';

const WORD_COUNTS = [5, 7, 10, 15, 20];

function SortableWord({ id, word, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="word-chip draggable">
      {word}
    </div>
  );
}

export default function WordOrder() {
  const { activeProfile, activeLanguage } = useProfile();
  const { user } = useAuth();
  const [wordCount, setWordCount] = useState(7);
  const [gameData, setGameData] = useState(null);
  const [words, setWords] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [rounds, setRounds] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  );

  async function generateSentence() {
    if (!activeProfile || !activeLanguage) return;
    setLoading(true);
    setResult(null);
    setGameData(null);
    const level = activeProfile.languages?.[activeLanguage]?.level || 1;
    const keywords = activeProfile.keywords || [];
    const prompt = buildWordOrderPrompt({ language: activeLanguage, level, keywords, wordCount });

    try {
      const raw = await chatCompletion([{ role: 'user', content: prompt }]);
      const data = await parseJsonResponse(raw);
      const shuffled = [...data.words].sort(() => Math.random() - 0.5);
      // Assign stable IDs
      const wordsWithIds = shuffled.map((w, i) => ({ id: `word-${i}-${w}`, text: w }));
      setGameData(data);
      setWords(wordsWithIds);
    } catch {
      toast.error('Could not generate sentence.');
    }
    setLoading(false);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setWords(items => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    setActiveId(null);
  }

  function checkAnswer() {
    if (!gameData) return;
    const userSentence = words.map(w => w.text).join(' ');
    const correct = userSentence === gameData.sentence;
    const pts = correct ? 10 : 0;
    setResult({ correct, userSentence, pts });
    const newScore = score + pts;
    const newRounds = rounds + 1;
    setScore(newScore);
    setRounds(newRounds);
    saveActivityScore(user.uid, activeProfile.id, activeLanguage, 'word-order', pts).catch(() => {});
    toast(correct ? '🎉 Correct!' : '❌ Not quite...', { duration: 2000 });
  }

  const activeWord = words.find(w => w.id === activeId);

  return (
    <div className="game-container">
      <div className="game-header">
        <h3>Word Order</h3>
        <div className="score-display">Score: {score} | Round {rounds}</div>
      </div>

      <div className="difficulty-row">
        <span>Words:</span>
        {WORD_COUNTS.map(n => (
          <button
            key={n}
            className={`diff-btn ${wordCount === n ? 'active' : ''}`}
            onClick={() => setWordCount(n)}
          >
            {n}
          </button>
        ))}
      </div>

      {!gameData && !loading && (
        <div className="game-start">
          <p>Arrange the words into a correct sentence!</p>
          <button className="btn-primary" onClick={generateSentence}>Start Round</button>
        </div>
      )}

      {loading && <div className="loading-card"><div className="spinner" /></div>}

      {gameData && !loading && (
        <>
          <div className="translation-hint">
            🇬🇧 {gameData.translation}
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={e => setActiveId(e.active.id)}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={words.map(w => w.id)} strategy={horizontalListSortingStrategy}>
              <div className="words-area">
                {words.map(w => (
                  <SortableWord key={w.id} id={w.id} word={w.text} disabled={!!result} />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeWord && <div className="word-chip dragging">{activeWord.text}</div>}
            </DragOverlay>
          </DndContext>

          {result ? (
            <div className={`result-card ${result.correct ? 'correct' : 'incorrect'}`}>
              <p>{result.correct ? '🎉 Perfect!' : '❌ Not quite...'}</p>
              {!result.correct && (
                <>
                  <p><strong>Your answer:</strong> {result.userSentence}</p>
                  <p><strong>Correct:</strong> {gameData.sentence}</p>
                </>
              )}
              {gameData.explanation && <p className="grammar-note">💡 {gameData.explanation}</p>}
              <button className="btn-primary mt-12" onClick={generateSentence}>Next Round</button>
            </div>
          ) : (
            <button className="btn-primary" onClick={checkAnswer}>Check Answer ✓</button>
          )}
        </>
      )}
    </div>
  );
}
