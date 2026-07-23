"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  allQuestions,
  briefSections,
  editableSections,
  isAnswered,
  isQuestionVisible,
  type Question,
} from "@/content/brief-config";
import { publicApi } from "@/lib/api";

type Session = { id: string; token: string; publicCode: string };
type Attachment = {
  id: string;
  questionId: string;
  referenceGroupId?: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  preview?: string;
};
type SaveState = "idle" | "saving" | "saved" | "error";
type ChoiceValue = { selected: string | string[]; custom?: string; comment?: string };
type ReferenceValue = {
  id: string;
  title?: string;
  url?: string;
  notes?: string[];
  likes?: string;
  mood?: string;
  avoid?: string;
  dislikes?: string;
};

const sessionKey = "tbd-visual-session";
const reviewSectionIndex = briefSections.length - 1;
const sectionCount = briefSections.length;

function Arrow({ back = false }: { back?: boolean }) {
  return <span aria-hidden="true">{back ? "←" : "↗"}</span>;
}

function selectedOf(value: unknown, single: boolean): string | string[] {
  if (value && typeof value === "object" && "selected" in value) {
    const selected = (value as ChoiceValue).selected;
    return single ? String(selected ?? "") : Array.isArray(selected) ? selected : [];
  }
  return single ? String(value ?? "") : Array.isArray(value) ? value as string[] : [];
}

export default function SessionApp({ continueId }: { continueId?: string }) {
  const [phase, setPhase] = useState<"landing" | "session" | "thanks">("landing");
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [resumeAvailable, setResumeAvailable] = useState(() => {
    const stored = localStorage.getItem(sessionKey);
    if (!stored) return false;
    try {
      const candidate = JSON.parse(stored) as Session;
      return Boolean(candidate.id && candidate.token);
    } catch {
      localStorage.removeItem(sessionKey);
      return false;
    }
  });
  const [shareOpen, setShareOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSession = useCallback(async (candidate: Session) => {
    setError("");
    const data = await publicApi.getSubmission(candidate.id, candidate.token);
    const submission = data.submission as { publicCode: string; currentSection?: number; status: string };
    const restored = { ...candidate, publicCode: submission.publicCode };
    setSession(restored);
    setAnswers(data.answers ?? {});
    setAttachments((data.attachments ?? []) as Attachment[]);
    setSectionIndex(Math.min(submission.currentSection ?? 0, reviewSectionIndex));
    setPhase(submission.status === "submitted" ? "thanks" : "session");
  }, []);

  useEffect(() => {
    const queryToken = new URLSearchParams(location.search).get("token");
    if (continueId && queryToken) {
      const fromLink = { id: continueId, token: queryToken, publicCode: "" };
      localStorage.setItem(sessionKey, JSON.stringify(fromLink));
      const timer = setTimeout(() => {
        void loadSession(fromLink).catch((cause) => setError(cause.message));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [continueId, loadSession]);

  const save = useCallback(async (nextSection = sectionIndex, sourceAnswers = answers) => {
    if (!session || phase !== "session") return true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    try {
      await publicApi.save(session.id, session.token, sourceAnswers, nextSection);
    } catch {
      setSaveState("error");
      setError("Не удалось сохранить последние изменения. Проверьте соединение и повторите.");
      return false;
    }
    dirtyRef.current = false;
    setSaveState("saved");
    setError("");
    return true;
  }, [answers, phase, sectionIndex, session]);

  useEffect(() => {
    if (!dirtyRef.current || !session || phase !== "session") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [answers, phase, save, session]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current || saveState === "saving") event.preventDefault();
    };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [saveState]);

  const setAnswer = useCallback((questionId: string, value: unknown) => {
    dirtyRef.current = true;
    setSaveState("idle");
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }, []);

  const start = async (replaceExisting = false) => {
    if (replaceExisting && resumeAvailable &&
      !confirm("Локальная ссылка на текущий черновик будет заменена. Начать новую сессию?")) return;
    setStarting(true);
    setError("");
    let data: Session;
    try {
      data = await publicApi.start();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось начать сессию. Попробуйте ещё раз.");
      setStarting(false);
      return;
    }
    localStorage.setItem(sessionKey, JSON.stringify(data));
    setSession(data);
    setAnswers({});
    setAttachments([]);
    setSectionIndex(0);
    setResumeAvailable(true);
    setPhase("session");
    setStarting(false);
  };

  const resume = async () => {
    const stored = localStorage.getItem(sessionKey);
    if (!stored) return;
    try {
      await loadSession(JSON.parse(stored));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось продолжить.");
    }
  };

  const changeSection = async (next: number) => {
    const safe = Math.max(0, Math.min(next, reviewSectionIndex));
    if (await save(safe)) {
      setSectionIndex(safe);
      scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const submit = async () => {
    if (!session || !confirmed) return;
    if (!await save(reviewSectionIndex)) return;
    let data: { publicCode: string };
    try {
      data = await publicApi.submit(session.id, session.token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отправить.");
      return;
    }
    localStorage.removeItem(sessionKey);
    setSession((current) => current ? { ...current, publicCode: data.publicCode } : current);
    setPhase("thanks");
    scrollTo({ top: 0 });
  };

  if (phase === "landing") {
    return (
      <main className="landing">
        <header className="topbar">
          <a className="wordmark" href="/" aria-label="TBD — на главную">TBD<span>●</span></a>
          <a className="admin-link" href="/admin/login">Вход для дизайн-лида <Arrow /></a>
        </header>
        <section className="hero">
          <div className="hero-index mono">SESSION / 01—09</div>
          <div className="hero-title">
            <p className="eyebrow">Visual Identity Session</p>
            <h1>TO BE<br /><em>DETERMINED</em></h1>
          </div>
          <div className="hero-copy">
            <p>Эта визуальная сессия поможет определить будущий образ TBD: характер бренда, визуальное направление, принципы фирменного стиля и возможный подход к логотипу.</p>
            <p className="hero-secondary">Здесь нет правильных или неправильных ответов. Можно отвечать коротко, выбирать наиболее близкие варианты, добавлять свои ассоциации и прикреплять визуальные референсы.</p>
            <p className="hero-secondary">Ответы сохраняются автоматически. Заполнение можно прервать и продолжить позже с этого же устройства.</p>
            <div className="meta-line"><span>Около 30–45 минут</span><span>Автосохранение включено</span></div>
            {resumeAvailable ? <>
              <button className="primary" onClick={() => void resume()}>Продолжить сессию <Arrow /></button>
              <button className="ghost" disabled={starting} onClick={() => void start(true)}>{starting ? "Создаём сессию…" : "Начать заново"} <Arrow /></button>
            </> : <button className="primary" disabled={starting} onClick={() => void start()}>{starting ? "Создаём сессию…" : "Начать сессию"} <Arrow /></button>}
            {error && <p className="error" role="alert">{error}</p>}
          </div>
        </section>
        <footer className="landing-footer mono"><span>INPUT → CHARACTER → SYSTEM</span><span>© TBD / 2026</span></footer>
      </main>
    );
  }

  if (phase === "thanks") {
    return (
      <main className="thanks-screen">
        <div className="status-orbit"><span>✓</span></div>
        <p className="eyebrow">SESSION COMPLETE</p>
        <h1>Спасибо.<br />Визуальный портрет TBD сохранён.</h1>
        <p>Ответы и референсы переданы дизайн-лиду.</p>
        <div className="public-code mono"><span>ПУБЛИЧНЫЙ КОД</span><strong>{session?.publicCode}</strong></div>
      </main>
    );
  }

  const section = briefSections[sectionIndex];
  const progress = Math.round((sectionIndex / reviewSectionIndex) * 100);
  const visibleQuestions = section.questions.filter((question) => isQuestionVisible(question, answers));
  return (
    <main className="session-shell">
      <header className="session-header">
        <a className="wordmark" href="/">TBD<span>●</span></a>
        <div className="progress-wrap" aria-label={`Прогресс прохождения ${progress}%`}>
          <div className="progress-meta mono">
            <span>{progress}% JOURNEY</span>
            <span>{saveState === "saving" ? "Сохраняем…" : saveState === "error" ? "Ошибка сохранения" : saveState === "saved" ? "Сохранено ✓" : "Автосохранение"}</span>
          </div>
          <div className="progress-track"><i style={{ width: `${Math.max(2, progress)}%` }} /></div>
        </div>
        <button className="quiet" onClick={() => setShareOpen(true)}>Сохранить и позже</button>
      </header>
      <div className="session-grid">
        <aside className="section-rail">
          <div className="giant-number">{section.number}</div>
          <p className="mono">РАЗДЕЛ {section.number} / {String(sectionCount).padStart(2, "0")}</p>
          <nav aria-label="Разделы">
            {briefSections.map((item, index) => (
              <button key={item.id} className={index === sectionIndex ? "active" : ""} onClick={() => void changeSection(index)}>
                <span>{item.number}</span>{item.title}
              </button>
            ))}
          </nav>
        </aside>
        <section className="question-stage">
          <div className="section-title">
            <p className="eyebrow">TBD / {section.number}</p>
            <h2>{section.title}</h2>
            <p>{section.kicker}</p>
            {section.intro && <div className="section-intro">{section.intro}</div>}
            {sectionIndex === 0 && <div className="section-intro">
              Вопросы постепенно пройдут путь от общего впечатления до деталей визуальной системы, логотипа и характера графики. Необязательно давать длинный ответ на каждый вопрос — иногда нескольких слов или одного точного референса достаточно.
            </div>}
          </div>
          {sectionIndex < reviewSectionIndex ? visibleQuestions.map((question) => (
            <QuestionBlock
              key={question.id}
              question={question}
              value={answers[question.id]}
              onChange={(value) => setAnswer(question.id, value)}
              attachments={attachments.filter((file) => file.questionId === question.id)}
              session={session!}
              answers={answers}
              onUploaded={(file) => setAttachments((current) => [...current, file])}
              onDeleted={(fileId) => setAttachments((current) => current.filter((file) => file.id !== fileId))}
            />
          )) : (
            <Review
              publicCode={session?.publicCode ?? ""}
              answers={answers}
              attachments={attachments}
              onEdit={(index) => void changeSection(index)}
              confirmed={confirmed}
              onConfirm={setConfirmed}
            />
          )}
          {error && <p className="error error-panel" role="alert">{error}</p>}
          <div className="stage-actions">
            <button className="secondary" disabled={sectionIndex === 0} onClick={() => void changeSection(sectionIndex - 1)}><Arrow back /> Назад</button>
            {sectionIndex < reviewSectionIndex
              ? <button className="primary" onClick={() => void changeSection(sectionIndex + 1)}>Далее <Arrow /></button>
              : <button className="primary" disabled={!confirmed} onClick={() => void submit()}>Отправить финальную версию <Arrow /></button>}
          </div>
        </section>
      </div>
      {shareOpen && session && <ContinueModal session={session} onClose={() => setShareOpen(false)} onSave={() => void save()} />}
    </main>
  );
}

function QuestionBlock(props: {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
  attachments: Attachment[];
  session: Session;
  answers: Record<string, unknown>;
  onUploaded: (file: Attachment) => void;
  onDeleted: (id: string) => void;
}) {
  const { question, value, onChange } = props;
  return (
    <article className="question-card" id={question.id}>
      <div className="question-number mono">{question.number}</div>
      <div className="question-content">
        <h3>{question.title}</h3>
        {question.description && <p className="question-help">{question.description}</p>}
        {question.type === "shortText" && <input className="answer-input" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} placeholder="Продолжите фразу или ответьте коротко…" />}
        {question.type === "longText" && <textarea className="answer-input" rows={5} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} placeholder="Опишите своими словами…" />}
        {question.type === "singleSelect" && <ChoiceGrid question={question} value={value} onChange={onChange} single />}
        {(question.type === "multiSelect" || question.type === "limitedSelect") && <ChoiceGrid question={question} value={value} onChange={onChange} />}
        {question.type === "rank" && <Ranker question={question} value={value} onChange={onChange} />}
        {question.type === "scale" && <SingleScale question={question} value={value} onChange={onChange} />}
        {question.type === "scales" && <Scales options={question.options ?? []} value={value} onChange={onChange} />}
        {question.type === "tags" && <Tags value={value} onChange={onChange} max={question.maxSelections} />}
        {question.type === "repeatable" && <Repeatable question={question} value={value} onChange={onChange} />}
        {question.type === "colors" && <ColorCollection value={value} onChange={onChange} />}
        {question.type === "ratingGrid" && <RatingGrid question={question} value={value} onChange={onChange} />}
        {question.type === "matrix" && <Matrix question={question} value={value} onChange={onChange} />}
        {(question.type === "references" || question.type === "antiReferences") &&
          <ReferenceCards {...props} anti={question.type === "antiReferences"} />}
        {question.allowFiles && question.type !== "references" && question.type !== "antiReferences" &&
          <FileDrop {...props} referenceId={question.id} attachments={props.attachments} />}
      </div>
    </article>
  );
}

function ChoiceGrid({ question, value, onChange, single = false }: {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
  single?: boolean;
}) {
  const state: ChoiceValue = value && typeof value === "object" && "selected" in value
    ? value as ChoiceValue
    : { selected: selectedOf(value, single) };
  const selected = single ? String(state.selected ?? "") : Array.isArray(state.selected) ? state.selected : [];
  const choose = (option: string) => {
    if (single) return onChange({ ...state, selected: option });
    const current = selected as string[];
    if (current.includes(option)) return onChange({ ...state, selected: current.filter((item) => item !== option) });
    if (question.maxSelections && current.length >= question.maxSelections) return;
    onChange({ ...state, selected: [...current, option] });
  };
  const hasOther = single ? selected === "Другое" || selected === "другое" : (selected as string[]).some((item) => item.toLowerCase() === "другое");
  return (
    <div>
      <div className="choice-grid">
        {question.options?.map((option, index) => {
          const active = single ? selected === option : (selected as string[]).includes(option);
          return <button type="button" key={option} className={active ? "selected" : ""} onClick={() => choose(option)}>
            <span>{String(index + 1).padStart(2, "0")}</span>{option}<i>{active ? "✓" : "+"}</i>
          </button>;
        })}
      </div>
      {question.allowCustom && hasOther && <input className="answer-input followup-input" value={state.custom ?? ""} onChange={(event) => onChange({ ...state, custom: event.target.value })} placeholder="Ваш вариант…" />}
      {question.allowComment && <textarea className="answer-input followup-input" rows={3} value={state.comment ?? ""} onChange={(event) => onChange({ ...state, comment: event.target.value })} placeholder={question.commentLabel ?? "Пояснение — необязательно"} />}
    </div>
  );
}

function Ranker({ question, value, onChange }: { question: Question; value: unknown; onChange: (value: unknown) => void }) {
  const options = question.options ?? [];
  const current = Array.isArray(value) && value.length ? value as string[] : options;
  const move = (index: number, delta: number) => {
    const next = [...current];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(question.maxSelections ? next.slice(0, question.maxSelections) : next);
  };
  return <div><div className="ranker">{current.map((option, index) => <div key={option}><strong>{index + 1}</strong><span>{option}</span><button type="button" onClick={() => move(index, -1)} aria-label="Поднять">↑</button><button type="button" onClick={() => move(index, 1)} aria-label="Опустить">↓</button></div>)}</div>{!Array.isArray(value) && <button className="accept-order" type="button" onClick={() => onChange(question.maxSelections ? current.slice(0, question.maxSelections) : current)}>Сохранить этот порядок</button>}</div>;
}

function SingleScale({ question, value, onChange }: { question: Question; value: unknown; onChange: (value: unknown) => void }) {
  const current = value === "unknown" ? "unknown" : typeof value === "number" ? value : undefined;
  return <div className="scale">
    <div className="scale-labels"><span>{question.leftLabel}</span><b>{typeof current === "number" ? current : "—"}</b><span>{question.rightLabel}</span></div>
    <input type="range" min="1" max="7" value={typeof current === "number" ? current : 4} className={current == null ? "unset" : ""} onChange={(event) => onChange(Number(event.target.value))} aria-label={`${question.leftLabel} — ${question.rightLabel}`} />
    <button type="button" className={current === "unknown" ? "unknown active" : "unknown"} onClick={() => onChange("unknown")}>Не могу определить</button>
  </div>;
}

function Scales({ options, value, onChange }: { options: string[]; value: unknown; onChange: (value: unknown) => void }) {
  const values = (value && typeof value === "object" ? value : {}) as Record<string, number | "unknown">;
  return <div className="scales">{options.map((pair) => {
    const [left, right] = pair.split(" — ");
    return <SingleScale key={pair} question={{ id: pair, sectionId: "", number: "", title: pair, type: "scale", required: false, leftLabel: left, rightLabel: right }} value={values[pair]} onChange={(next) => onChange({ ...values, [pair]: next })} />;
  })}</div>;
}

function Tags({ value, onChange, max }: { value: unknown; onChange: (value: unknown) => void; max?: number }) {
  const tags = Array.isArray(value) ? value as string[] : [];
  const [draft, setDraft] = useState("");
  const add = () => {
    const tag = draft.trim();
    if (!tag || tags.includes(tag) || (max && tags.length >= max)) return;
    onChange([...tags, tag]);
    setDraft("");
  };
  return <div className="tag-editor"><div className="tag-list">{tags.map((tag) => <span key={tag}>{tag}<button type="button" onClick={() => onChange(tags.filter((item) => item !== tag))}>×</button></span>)}</div><div className="tag-input"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(); } }} placeholder={max ? `Добавьте до ${max} значений` : "Введите ассоциацию и нажмите Enter"} /><button type="button" onClick={add} disabled={Boolean(max && tags.length >= max)}>Добавить</button></div></div>;
}

function Repeatable({ question, value, onChange }: { question: Question; value: unknown; onChange: (value: unknown) => void }) {
  const items = Array.isArray(value) ? value as Array<{ title: string; url?: string }> : [];
  const actual = items.length ? items : [{ title: "", url: "" }];
  const update = (index: number, patch: Partial<{ title: string; url: string }>) => onChange(actual.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  return <div className="repeatable-list">{actual.map((item, index) => <div key={index}><input value={item.title} onChange={(event) => update(index, { title: event.target.value })} placeholder="Название или фраза" />{question.allowLinks && <input type="url" value={item.url ?? ""} onChange={(event) => update(index, { url: event.target.value })} placeholder="https://… — необязательно" />}{actual.length > 1 && <button type="button" onClick={() => onChange(actual.filter((_, itemIndex) => itemIndex !== index))}>×</button>}</div>)}{(!question.maxItems || actual.length < question.maxItems) && <button type="button" className="add-reference" onClick={() => onChange([...actual, { title: "", url: "" }])}>+ Добавить ещё</button>}</div>;
}

type ColorValue = { hex: string; name: string; comment: string };
function ColorCollection({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
  const colors = Array.isArray(value) ? value as ColorValue[] : [];
  const actual = colors.length ? colors : [{ hex: "#d7ff39", name: "", comment: "" }];
  const update = (index: number, patch: Partial<ColorValue>) => onChange(actual.map((color, itemIndex) => itemIndex === index ? { ...color, ...patch } : color));
  return <div className="color-collection">{actual.map((color, index) => <div key={index}><input type="color" value={color.hex} onChange={(event) => update(index, { hex: event.target.value })} /><input value={color.name} onChange={(event) => update(index, { name: event.target.value })} placeholder="Название цвета" /><input value={color.comment} onChange={(event) => update(index, { comment: event.target.value })} placeholder="Комментарий" />{actual.length > 1 && <button type="button" onClick={() => onChange(actual.filter((_, itemIndex) => itemIndex !== index))}>×</button>}</div>)}<button type="button" className="add-reference" onClick={() => onChange([...actual, { hex: "#777777", name: "", comment: "" }])}>+ Добавить цвет</button></div>;
}

function RatingGrid({ question, value, onChange }: { question: Question; value: unknown; onChange: (value: unknown) => void }) {
  const data = value && typeof value === "object" ? value as Record<string, string> : {};
  const [custom, setCustom] = useState("");
  const rows = question.options ?? [];
  return <div><div className="rating-grid">{rows.map((row) => <label key={row}><span>{row}</span><select value={data[row] ?? ""} onChange={(event) => onChange({ ...data, [row]: event.target.value })}><option value="">Не оценено</option>{question.ratingOptions?.map((rating) => <option key={rating}>{rating}</option>)}</select></label>)}</div>{question.allowCustom && <div className="custom-direction"><input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Собственное направление" /><select value={custom ? data[custom] ?? "" : ""} disabled={!custom} onChange={(event) => onChange({ ...data, [custom]: event.target.value })}><option value="">Не оценено</option>{question.ratingOptions?.map((rating) => <option key={rating}>{rating}</option>)}</select></div>}</div>;
}

function Matrix({ question, value, onChange }: { question: Question; value: unknown; onChange: (value: unknown) => void }) {
  const data = value && typeof value === "object" ? value as Record<string, string> : {};
  return <div className="rating-grid">{question.options?.map((row) => <label key={row}><span>{row}</span><select value={data[row] ?? ""} onChange={(event) => onChange({ ...data, [row]: event.target.value })}><option value="">Пропустить</option>{question.ratingOptions?.map((rating) => <option key={rating}>{rating}</option>)}</select></label>)}</div>;
}

function ReferenceCards(props: {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
  attachments: Attachment[];
  session: Session;
  answers: Record<string, unknown>;
  onUploaded: (file: Attachment) => void;
  onDeleted: (id: string) => void;
  anti: boolean;
}) {
  const cards = Array.isArray(props.value) ? props.value as ReferenceValue[] : [];
  const [initialId] = useState(() => crypto.randomUUID());
  const actual = cards.length ? cards : [{ id: initialId, notes: [] }];
  const update = (index: number, patch: Partial<ReferenceValue>) => props.onChange(actual.map((card, itemIndex) => itemIndex === index ? { ...card, ...patch } : card));
  return <div className="references">{actual.map((card, index) => <div className="reference-card" key={card.id}>
    <div className="reference-head"><span className="mono">{props.anti ? "ANTI" : "REF"} / {String(index + 1).padStart(2, "0")}</span>{actual.length > 1 && <button type="button" onClick={() => props.onChange(actual.filter((_, itemIndex) => itemIndex !== index))}>Удалить</button>}</div>
    <label><span>Название или подпись</span><input value={card.title ?? ""} onChange={(event) => update(index, { title: event.target.value })} placeholder="Можно оставить только название" /></label>
    <label><span>Ссылка — необязательно</span><input type="url" placeholder="https://…" value={card.url ?? ""} onChange={(event) => update(index, { url: event.target.value })} /></label>
    <FileDrop {...props} referenceId={card.id} attachments={props.attachments.filter((file) => !file.referenceGroupId || file.referenceGroupId === card.id)} />
    {props.question.referencePrompts?.map((prompt, promptIndex) => <label key={prompt}><span>{prompt}</span><textarea value={card.notes?.[promptIndex] ?? ""} onChange={(event) => {
      const notes = [...(card.notes ?? [])];
      notes[promptIndex] = event.target.value;
      update(index, { notes });
    }} /></label>)}
    {props.anti ? <>
      <label><span>Что именно не подходит</span><textarea value={card.dislikes ?? ""} onChange={(event) => update(index, { dislikes: event.target.value })} /></label>
      <label><span>Почему это не подходит TBD</span><textarea value={card.mood ?? ""} onChange={(event) => update(index, { mood: event.target.value })} /></label>
      <label><span>Какие элементы нельзя повторять</span><textarea value={card.avoid ?? ""} onChange={(event) => update(index, { avoid: event.target.value })} /></label>
    </> : !props.question.referencePrompts?.length && <>
      <label><span>Что именно нравится</span><textarea value={card.likes ?? ""} onChange={(event) => update(index, { likes: event.target.value })} /></label>
      <label><span>Что подходит только как настроение</span><textarea value={card.mood ?? ""} onChange={(event) => update(index, { mood: event.target.value })} /></label>
      <label><span>Что не стоит повторять буквально</span><textarea value={card.avoid ?? ""} onChange={(event) => update(index, { avoid: event.target.value })} /></label>
    </>}
  </div>)}{(!props.question.maxItems || actual.length < props.question.maxItems) && <button type="button" className="add-reference" onClick={() => props.onChange([...actual, { id: crypto.randomUUID(), notes: [] }])}>+ Добавить {props.anti ? "антиреференс" : "референс"}</button>}</div>;
}

function FileDrop(props: {
  question: Question;
  attachments: Attachment[];
  session: Session;
  onUploaded: (file: Attachment) => void;
  onDeleted: (id: string) => void;
  referenceId: string;
}) {
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");
  const upload = async (list: FileList | null) => {
    if (!list) return;
    for (const file of Array.from(list)) {
      setUploading(file.name);
      try {
        const data = await publicApi.upload(
          props.session.id,
          props.session.token,
          props.question.id,
          props.referenceId,
          file,
        );
        props.onUploaded({ ...data, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Ошибка загрузки.");
      }
    }
    setUploading("");
  };
  const remove = async (id: string) => {
    try {
      await publicApi.deleteFile(props.session.id, props.session.token, id);
      props.onDeleted(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить файл.");
    }
  };
  return <div><label className="file-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void upload(event.dataTransfer.files); }}>
    <input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.svg,.pdf,.mp4,.mov,.ppt,.pptx" onChange={(event) => void upload(event.target.files)} />
    <strong>{uploading ? `Загружаем ${uploading}…` : "Перетащите файлы или выберите"}</strong>
    <span>Файл не обязателен, если добавлена ссылка · до 50 МБ</span>
  </label>{error && <p className="error">{error}</p>}<div className="file-list">{props.attachments.map((file) => <div key={file.id}>{file.preview ? <img src={file.preview} alt="" /> : <i>{file.mimeType.split("/")[1]?.toUpperCase()}</i>}<span><strong>{file.originalFilename}</strong><small>{(file.sizeBytes / 1024 / 1024).toFixed(1)} МБ · Загружено</small></span><button type="button" onClick={() => void remove(file.id)} aria-label="Удалить файл">×</button></div>)}</div></div>;
}

function Review({ publicCode, answers, attachments, onEdit, confirmed, onConfirm }: {
  publicCode: string;
  answers: Record<string, unknown>;
  attachments: Attachment[];
  onEdit: (index: number) => void;
  confirmed: boolean;
  onConfirm: (value: boolean) => void;
}) {
  const referenceCount = allQuestions.filter((question) => question.type === "references" || question.type === "antiReferences")
    .reduce((total, question) => total + (Array.isArray(answers[question.id]) ? (answers[question.id] as unknown[]).length : 0), 0);
  return <div className="review-list"><div className="review-code"><span className="mono">ПУБЛИЧНЫЙ КОД</span><strong>{publicCode}</strong></div>{editableSections.map((section, index) => {
    const questions = section.questions.filter((question) => isQuestionVisible(question, answers));
    const count = questions.filter((question) => isAnswered(answers[question.id])).length;
    const summary = questions.map((question) => answers[question.id]).filter(isAnswered).slice(0, 2).map((value) => typeof value === "string" ? value : Array.isArray(value) ? value.map(String).join(", ") : "Данные собраны").join(" · ");
    return <article key={section.id}><div className="review-num">{section.number}</div><div><h3>{section.title}</h3><p>{count} заполнено · {questions.length - count} пропущено</p><small>{summary || "Пока без ответов"}</small></div><button type="button" onClick={() => onEdit(index)}>Редактировать</button></article>;
  })}<div className="review-files"><span className="mono">МАТЕРИАЛЫ</span><strong>{attachments.length}</strong><p>{attachments.length} файлов · {referenceCount} карточек референсов</p><p>{attachments.map((file) => file.originalFilename).join(" · ") || "Файлы не добавлены"}</p></div><label className="confirm"><input type="checkbox" checked={confirmed} onChange={(event) => onConfirm(event.target.checked)} /><span>Я проверил(а) ответы и готов(а) отправить финальную версию.</span></label></div>;
}

function ContinueModal({ session, onClose, onSave }: { session: Session; onClose: () => void; onSave: () => void }) {
  const url = `${location.origin}/continue/${session.id}?token=${session.token}`;
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="continue-title"><div className="modal"><button className="modal-close" onClick={onClose}>×</button><p className="eyebrow">ПРОДОЛЖИТЬ ПОЗЖЕ</p><h2 id="continue-title">Прогресс сохранён на этом устройстве.</h2><p>Чтобы вернуться с другого устройства, сохраните персональную ссылку. Не пересылайте её посторонним: она даёт доступ к редактированию.</p><div className="copy-link mono">{url}</div><button className="primary" onClick={() => { onSave(); void navigator.clipboard.writeText(url); }}>Скопировать ссылку <Arrow /></button></div></div>;
}
