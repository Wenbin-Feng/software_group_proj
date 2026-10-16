import {
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  FileText,
  MessageCircle,
  Play,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  answerQuestion,
  demoQuestions,
  id,
  today,
  uniqueTitle,
  type ChatMessage,
  type Material,
} from '../lib/domain';
import { useApp } from '../lib/store';
import { LifecycleAnimation } from './LifecycleAnimation';
import { Markdown } from './Markdown';

export function Assistant({ material, onSource }: { material: Material; onSource: () => void }) {
  const { state, user, setState, notify } = useApp();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [stream, setStream] = useState('');
  const [animation, setAnimation] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const bottom = useRef<HTMLDivElement>(null);
  const messages =
    state.conversations.find((c) => c.userId === user!.id && c.materialId === material.id)
      ?.messages || [];
  const append = (message: ChatMessage) =>
    setState((s) => {
      const index = s.conversations.findIndex(
        (c) => c.userId === user!.id && c.materialId === material.id,
      );
      return {
        ...s,
        conversations:
          index < 0
            ? [
                ...s.conversations,
                { userId: user!.id, materialId: material.id, messages: [message] },
              ]
            : s.conversations.map((c, i) =>
                i === index ? { ...c, messages: [...c.messages, message] } : c,
              ),
      };
    });
  useEffect(() => () => clearInterval(timer.current), []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length, pending]);
  const ask = (question: string) => {
    if (pending || !question.trim()) return;
    const prompt = question.trim();
    setInput('');
    append({ id: id(), role: 'user', content: prompt });
    const answer = answerQuestion(prompt, material);
    let cursor = 0;
    setStream('');
    setPending(true);
    // Reveal a prepared answer locally. No external model call or file transfer occurs.
    timer.current = setInterval(() => {
      cursor += 65;
      setStream(answer.content.slice(0, cursor));
      if (cursor >= answer.content.length) {
        clearInterval(timer.current);
        append({
          id: id(),
          role: 'assistant',
          content: answer.content,
          supported: answer.supported,
          sourceId: answer.sourceId,
        });
        setStream('');
        setPending(false);
      }
    }, 25);
  };
  const save = (message: ChatMessage) => {
    const noteId = id();
    const title = uniqueTitle(
      material.topic === 'lifecycle' ? 'Waterfall vs Agile' : `${material.title} — study notes`,
      state.notes.filter((n) => n.ownerId === user!.id),
    );
    setState((s) => ({
      ...s,
      notes: [
        {
          id: noteId,
          ownerId: user!.id,
          title,
          content: `# ${title}\n\n${message.content}\n\n## Connections\n\n${material.topic === 'lifecycle' ? '[[Requirements Analysis]] · [[Iterative Development]]' : 'Add a connection using [[Note Title]].'}\n\n---\nSource: ${material.title} · Prepared demo explanation`,
          tags: [
            'AI-assisted',
            material.topic === 'lifecycle' ? 'Software engineering' : 'Study notes',
          ],
          updatedAt: today(),
          sourceMaterialId: material.id,
        },
        ...s.notes,
      ],
    }));
    notify('Explanation saved to your Wiki. Make it your own.');
    navigate(`/wiki/${noteId}`);
  };
  return (
    <aside className="assistant-panel">
      <div className="assistant-header">
        <span className="assistant-icon">
          <Sparkles size={20} />
        </span>
        <div>
          <h3>Your study partner</h3>
          <span>Curiosity looks good on you.</span>
        </div>
        <span className="demo-ai-badge">Demo AI</span>
      </div>
      <div className="assistant-context">
        <FileText size={14} />
        <span>{material.title}</span>
        <span className="status-dot" />
      </div>
      <div className="assistant-messages">
        <div className="assistant-welcome">
          <span className="welcome-ai-icon">
            <Sparkles size={23} />
          </span>
          <h3>
            A little clarity,
            <br />
            right when you need it.
          </h3>
          <p>
            {material.seeded
              ? 'Ask a question about this material. Let’s make the tricky parts click.'
              : 'This file is available to read. Try a seeded guide to explore the prepared AI demo.'}
          </p>
        </div>
        {messages.map((message) => (
          <div key={message.id} className={`chat-message ${message.role}`}>
            <div className="message-role">
              {message.role === 'assistant' ? <Sparkles size={13} /> : <MessageCircle size={13} />}{' '}
              {message.role === 'assistant' ? 'Luma AI' : 'You'}
            </div>
            <Markdown content={message.content} />
            {message.role === 'assistant' && message.supported && (
              <>
                <button className="source-chip" onClick={onSource}>
                  <BookOpen size={13} />
                  Source: {material.filename}
                  <ArrowUpRight size={12} />
                </button>
                <div className="answer-actions">
                  {material.topic === 'lifecycle' && (
                    <button onClick={() => setAnimation(true)}>
                      <Play size={13} />
                      Explore animation
                    </button>
                  )}
                  <button onClick={() => save(message)}>
                    <Plus size={14} />
                    Save to Wiki
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {pending && (
          <div className="chat-message assistant streaming">
            <div className="message-role">
              <Sparkles size={13} />
              Luma AI <span className="typing-dots">•••</span>
            </div>
            <Markdown content={stream || 'Thinking through your question…'} />
          </div>
        )}
        <div ref={bottom} />
      </div>
      <div className="assistant-compose">
        <div className="suggested-questions">
          {(demoQuestions[material.topic] || demoQuestions.lifecycle)
            .slice(0, messages.length ? 1 : 3)
            .map((q) => (
              <button key={q} onClick={() => ask(q)} disabled={pending}>
                {q}
                <ArrowUpRight size={13} />
              </button>
            ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <textarea
            aria-label="Ask about this material"
            placeholder="Ask about this material…"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
          />
          <button aria-label="Send question" disabled={pending || !input.trim()}>
            <ArrowUp size={18} />
          </button>
        </form>
        <p>Prepared responses for demo · Always think critically.</p>
      </div>
      {animation && <LifecycleAnimation onClose={() => setAnimation(false)} />}
    </aside>
  );
}
