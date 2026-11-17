"use client";
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, authError } from '../context/AuthContext';
import { backendRequest } from '../services/account/backendClient';
import { academyRequest, catalog, type Session } from '../features/academy/client';
import { link } from '../lib/router';

type Bookmark={id:string;contentType:string;contentRef:string;createdAt:string};
export default function AccountLearning(){
 const auth=useAuth(),{t,i18n}=useTranslation();
 const [sessions,setSessions]=useState<Session[]>([]),[bookmarks,setBookmarks]=useState<Bookmark[]>([]),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[search,setSearch]=useState(''),[category,setCategory]=useState('all'),[busy,setBusy]=useState('');
 useEffect(()=>{let live=true;setSessions([]);setBookmarks([]);setLoaded(false);setError('');if(!auth.user?.uid||auth.syncing)return;void(async()=>{try{const rows:Bookmark[]=[];let cursor:string|null=null;do{const r=await backendRequest<Bookmark[]>('/api/bookmarks?limit=50'+(cursor?'&cursor='+cursor:''));rows.push(...r.data);cursor=r.meta?.nextCursor||null;}while(cursor);const learning=await academyRequest<Session[]>('/sessions');if(live){setBookmarks(rows);setSessions(learning);setLoaded(true);}}catch(e){if(live)setError(authError(e));}})();return()=>{live=false;};},[auth.user?.uid,auth.syncing]);
 const title=(id:string)=>{const lesson=catalog.lessons.find(l=>l.id===id);return lesson?(i18n.language==='ur'?lesson.titleUr:lesson.title):id;};
 const destination=(b:Bookmark)=>b.contentType==='quran'?'/quran/'+b.contentRef.split(':')[0]+'?ayah='+b.contentRef.split(':')[1]:b.contentType==='dua'?'/duas/'+b.contentRef:b.contentType==='lesson'?'learn?lesson='+encodeURIComponent(b.contentRef):'hadith?collection=all&hadith='+encodeURIComponent(b.contentRef);
 const label=(b:Bookmark)=>b.contentType==='lesson'?title(b.contentRef):`${t(b.contentType==='quran'?'Quran':b.contentType==='dua'?'Dua':'Hadith')} ${b.contentRef}`;
 const activity=sessions.filter(s=>s.lastAccessedAt).sort((a,b)=>Date.parse(b.lastAccessedAt!)-Date.parse(a.lastAccessedAt!));
 return <>
 <section id="account-learning" className="account-card"><div className="account-section-heading"><div><span className="account-eyebrow">{t('YOUR JOURNEY')}</span><h2>{t('Learning overview')}</h2></div><a className="chip" href={link('learn')}>{t('Explore the academy')} ↗</a></div>
 {error?<p role="alert">{t(error)}</p>:!loaded?<p role="status">{t('Loading…')}</p>:<><div className="account-stat-grid"><div><strong>{sessions.filter(s=>s.status==='completed').length}</strong><span>{t('Completed academy lessons')}</span></div><div><strong>{new Set(sessions.filter(s=>s.status!=='completed').map(s=>catalog.lessons.find(l=>l.id===s.lessonId)?.trackId).filter(Boolean)).size}</strong><span>{t('Active learning tracks')}</span></div><div><strong>{bookmarks.length}</strong><span>{t('Saved references')}</span></div></div>
 <h3>{t('Recent learning activity')}</h3>{activity.length?<ol className="account-timeline">{activity.slice(0,5).map(s=><li key={s.id}><a href={link('learn?lesson='+encodeURIComponent(s.lessonId))}>{title(s.lessonId)}</a><span>{t(s.status==='completed'?'Completed':'Last studied')} · <time dateTime={s.lastAccessedAt}>{new Date(s.lastAccessedAt!).toLocaleString(i18n.language)}</time></span></li>)}</ol>:<div className="account-empty"><h3>{t('Your next chapter starts here')}</h3><p>{t('Choose a lesson and return here to follow your learning journey.')}</p></div>}</>}
 </section>
 <section id="account-saved" className="account-card"><span className="account-eyebrow">{t('KEEP CLOSE')}</span><h2>{t('Saved Islamic content')}</h2><div className="account-saved-controls"><label>{t('Search saved content')}<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>{t('Category')}<select value={category} onChange={e=>setCategory(e.target.value)}>{['all','quran','dua','hadith','lesson'].map(k=><option value={k} key={k}>{t({all:'All',quran:'Quran',dua:'Duas',hadith:'Hadith',lesson:'Lessons'}[k]!)}</option>)}</select></label></div>
 {loaded&&bookmarks.filter(b=>(category==='all'||b.contentType===category)&&label(b).toLowerCase().includes(search.toLowerCase())).map(b=><article className="account-saved-item" key={b.id}><a href={link(destination(b))}>{label(b)}<small>{new Date(b.createdAt).toLocaleDateString(i18n.language)}</small></a><button className="chip" disabled={!!busy} aria-label={t('Remove bookmark')+' '+label(b)} onClick={()=>{setBusy(b.id);void backendRequest('/api/bookmarks/'+b.id,{method:'DELETE'}).then(async()=>{setBookmarks(rows=>rows.filter(r=>r.id!==b.id));await auth.refresh();}).catch(e=>setError(authError(e))).finally(()=>setBusy(''));}}>{t('Remove')}</button></article>)}
 {loaded&&!bookmarks.some(b=>(category==='all'||b.contentType===category)&&label(b).toLowerCase().includes(search.toLowerCase()))&&<p className="account-empty">{t('No saved content matches. Save a verse, dua, hadith or lesson to find it here.')}</p>}
 </section></>;
}
