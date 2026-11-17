import catalog from './catalog.json';
import { backendRequest } from '../../services/account/backendClient';
export { catalog };
export type Lesson = typeof catalog.lessons[number];
export type TutorLanguage = 'en' | 'ur' | 'roman-ur';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type Mode = 'guided' | 'ask' | 'story';
export type Session = { id: string; lessonId: string; currentStep: number; version: number; status: string; note?: string; selectedLanguage: TutorLanguage; selectedDifficulty: Difficulty; mode?: Mode; lastAccessedAt?: string };
export type Source = { title?:string;author?:string;reviewStatus?:string; footnotes?:string; id: string; kind: string; reference: string; excerpt: string; href: string; edition?: string; attribution?: string; authenticity?: string; language?: string };
export type Explanation = { generated: boolean; explanation?: string; sourceReferences: Source[]; keyTerms?: string[]; keyPoints?: string[]; uncertaintyNotes?: string[]; limitations?: string; knowledgeCheck?: { id: string; question: string; options: string[] }[] };
export async function academyRequest<T>(path: string, options: Parameters<typeof backendRequest>[1] = {}) { return (await backendRequest<T>('/api/academy' + path, options)).data; }
export function decodeExplanation(raw: unknown): Explanation {
  if (!raw || typeof raw !== 'object') throw new Error('The tutor returned an invalid response.');
  const value = raw as Explanation;
  if (typeof value.generated !== 'boolean' || !Array.isArray(value.sourceReferences) || (value.explanation !== undefined && typeof value.explanation !== 'string') || value.sourceReferences.some(s => typeof s.id !== 'string' || typeof s.reference !== 'string' || typeof s.excerpt !== 'string' || (s.footnotes!==undefined&&typeof s.footnotes!=='string') || !safeSourceURL(s.href)) || (value.generated && !value.sourceReferences.length)) throw new Error('The tutor returned an invalid response.');
  if ((value.limitations!==undefined&&typeof value.limitations!=='string') || [value.keyTerms,value.keyPoints,value.uncertaintyNotes].some(a=>a !== undefined && (!Array.isArray(a)||a.some(x=>typeof x !== 'string'))) || (value.knowledgeCheck && (!Array.isArray(value.knowledgeCheck)||value.knowledgeCheck.some(q=>typeof q.id !== 'string'||typeof q.question !== 'string'||!Array.isArray(q.options)||![2,4].includes(q.options.length)||q.options.some(x=>typeof x!=='string'))))) throw new Error('The tutor returned an invalid response.');
  return value;
}
export function safeSourceURL(value: string) { try { const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password; } catch { return false; } }
const KEY = 'deen-academy-guest-v1';
export function readGuestAcademy(): Record<string, Session> {
  try { const value=JSON.parse(localStorage.getItem(KEY)||'{}'); if (!value || Array.isArray(value)||typeof value!=='object') return {}; return Object.fromEntries(Object.entries(value).filter(([id,s])=>catalog.lessons.some(l=>l.id===id) && s && typeof s==='object' && Number.isInteger((s as Session).currentStep) && (s as Session).currentStep>=0 && (s as Session).currentStep<(catalog.lessons.find(l=>l.id===id)?.steps.length||0) && ['en','ur','roman-ur'].includes((s as Session).selectedLanguage) && ['beginner','intermediate','advanced'].includes((s as Session).selectedDifficulty) && ['in_progress','completed'].includes((s as Session).status) && typeof (s as Session).note==='string' && (s as Session).note!.length<=4000)) as Record<string,Session>; } catch { return {}; }
}
export function saveGuestAcademy(row: Session) { localStorage.setItem(KEY,JSON.stringify({...readGuestAcademy(),[row.lessonId]:row})); }
