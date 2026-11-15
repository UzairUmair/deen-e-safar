"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { authError } from "../context/AuthContext";
import { backendRequest } from "../services/account/backendClient";
import { PageHeading } from "../components/ui/states";
import { CitationCard } from "./IslamicAI";
import type { Citation } from "../services/ai/aiService";

type Conversation = { id: string; title: string };
type Message = { id: string; role: string; content: string; citations?: Citation[]; generated?: boolean };
type Answer = { mode: "generated" | "limited"; text: string; limitations?: string; citations: Citation[]; conversationId?: string; messageId?: string };
export default function CloudAssistant({ onSourceSearch }: { onSourceSearch: () => void }) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState(""), [messages, setMessages] = useState<Message[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [history, setHistory] = useState(false), [conversation, setConversation] = useState(""), [conversations, setConversations] = useState<Conversation[]>([]);
  const [cursor, setCursor] = useState<string | null>(null), [messageCursor, setMessageCursor] = useState<string | null>(null), [title, setTitle] = useState("");
  const [report, setReport] = useState(""), [reason, setReason] = useState(""), [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function list(after?: string) {
    const result = await backendRequest<Conversation[]>("/api/ai/conversations?limit=20" + (after ? "&cursor=" + after : ""));
    setConversations(old => after ? [...old, ...result.data] : result.data); setCursor(result.meta?.nextCursor || null);
  }
  async function task(run: () => Promise<void>) { setBusy(true); setError(""); try { await run(); } catch (e) { setError(authError(e)); } finally { setBusy(false); } }
  async function open(id: string, after?: string) {
    const result = await backendRequest<{ conversation: Conversation; messages: Message[] }>(`/api/ai/conversations/${id}?limit=20` + (after ? "&cursor=" + after : ""));
    setHistory(true); setConversation(id); setTitle(result.data.conversation.title); setMessageCursor(result.meta?.nextCursor || null);
    const rows = [...result.data.messages].reverse().map(m => ({ ...m, generated: m.role === "assistant" })); setMessages(old => after ? [...rows, ...old] : rows);
  }
  async function ask() {
    const question = draft.trim(); if (question.length < 3 || busy) return;
    const current = new AbortController(); controller.current = current;
    await task(async () => {
      const result = await backendRequest<Answer>("/api/ai/chat", { method: "POST", signal: current.signal, body: { question, language: ["en", "ur", "ar"].includes(i18n.language) ? i18n.language : "en", historyEnabled: history, ...(history && conversation ? { conversationId: conversation } : {}) } });
      const answer = result.data;
      setMessages(old => [...old, { id: crypto.randomUUID(), role: "user", content: question }, { id: answer.messageId || "unsaved:" + crypto.randomUUID(), role: "assistant", generated: answer.mode === "generated", content: answer.text + (answer.limitations ? "\n\n" + answer.limitations : ""), citations: answer.citations }]);
      setDraft(""); if (answer.conversationId) { setConversation(answer.conversationId); await list(); }
    });
  }
  return <div className="app-screen ai-screen"><PageHeading eyebrow={t("ISLAMIC AI ASSISTANT")} title={t("Source-grounded assistant")}>{t("Generated explanations use reviewed sources. Check the citations and consult a qualified scholar for personal rulings.")}</PageHeading>
    <button className="chip" onClick={onSourceSearch}>{t("Use source search")}</button>
    <section className="widget account-form"><label className="account-check"><input type="checkbox" checked={history} disabled={busy} onChange={e => { setHistory(e.target.checked); setConversation(""); setMessageCursor(null); setMessages([]); }} />{t("Save this conversation to my account")}</label><small>{t("History is off by default. Turn it on before asking to save messages.")}</small><div className="chip-row"><button className="chip" disabled={busy} onClick={() => void task(() => list())}>{t("Load saved conversations")}</button><button className="chip" disabled={busy} onClick={() => { setConversation(""); setMessages([]); setMessageCursor(null); setTitle(""); }}>{t("New conversation")}</button></div>
      {conversations.map(row => <button key={row.id} disabled={busy} className="chip" onClick={() => void task(() => open(row.id))}>{row.title}</button>)}{cursor && <button className="chip" disabled={busy} onClick={() => void task(() => list(cursor))}>{t("Load more")}</button>}
      {conversation && <form className="chip-row" onSubmit={e => { e.preventDefault(); void task(async () => { await backendRequest("/api/ai/conversations/" + conversation, { method: "PATCH", body: { title: title.trim() } }); await list(); }); }}><label>{t("Conversation title")}<input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></label><button className="chip" disabled={busy}>{t("Rename")}</button><button type="button" className="chip" disabled={busy} onClick={() => void task(async () => { await backendRequest("/api/ai/conversations/" + conversation, { method: "DELETE" }); setConversation(""); setMessages([]); setMessageCursor(null); await list(); })}>{t("Delete conversation")}</button></form>}
    </section>
    <section className="chat" aria-label={t("Conversation")}><div className="chat-status">{t("Source-grounded assistant")}</div>{messageCursor && conversation && <button className="chip" disabled={busy} onClick={() => void task(() => open(conversation, messageCursor))}>{t("Load earlier messages")}</button>}
      <div className="chat-thread" aria-live="polite">{messages.map(m => <article key={m.id} className={"chat-bubble " + (m.role === "user" ? "user" : "assistant")}>{m.role === "assistant" && <span className="reply-label">{t(m.generated ? "AI-generated explanation" : "Insufficient reviewed evidence")}</span>}<p style={{ whiteSpace: "pre-wrap" }}>{m.content}</p>{m.citations?.map(c => <CitationCard key={c.href + c.reference} citation={c} />)}{m.role === "assistant" && !m.id.startsWith("unsaved:") && <button className="chip" onClick={() => { setReport(m.id); setReason(""); setNotice(""); }}>{t("Report answer")}</button>}</article>)}</div>
      <form className="chat-composer" onSubmit={e => { e.preventDefault(); void ask(); }}><label className="sr-only" htmlFor="cloud-question">{t("Your question")}</label><input id="cloud-question" required minLength={3} maxLength={2000} value={draft} onChange={e => setDraft(e.target.value)} placeholder={t("Ask a question…")} /><button className="chip" disabled={busy || draft.trim().length < 3}>{t(busy ? "Please wait…" : "Send")}</button></form>
    </section>
    {report && <form className="widget account-form" onSubmit={e => { e.preventDefault(); void task(async () => { await backendRequest("/api/content-reports", { method: "POST", body: { targetType: "ai-message", targetId: report, reason } }); setReport(""); setNotice("Report submitted."); }); }}><label>{t("Reason for reporting")}<textarea required minLength={5} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label><button className="chip" disabled={busy}>{t("Submit report")}</button><button type="button" className="chip" onClick={() => setReport("")}>{t("Cancel")}</button></form>}
    {error && <p role="alert">{t(error)}</p>}{notice && <p role="status">{t(notice)}</p>}
  </div>;
}
