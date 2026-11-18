'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useTranslation} from 'react-i18next';
/** Native modal supplies focus containment, Escape semantics and background inertness. */
export function MobileDrawer({open,onClose,title,children}:{open:boolean;onClose:()=>void;title:string;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),close=useRef(onClose);const {t}=useTranslation();
 useEffect(()=>{close.current=onClose;},[onClose]);
 useEffect(()=>{if(!open)return;const dialog=ref.current;if(!dialog)return;const before=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;dialog.showModal();document.body.style.overflow='hidden';const dismiss=()=>close.current();window.addEventListener('hashchange',dismiss);const resize=()=>{if(!matchMedia('(max-width:700px)').matches)dismiss();};window.addEventListener('resize',resize);return()=>{window.removeEventListener('hashchange',dismiss);window.removeEventListener('resize',resize);dialog.close();document.body.style.overflow=overflow;if(before?.isConnected)before.focus();};},[open]);
 if(!open||typeof document==='undefined')return null;
 return createPortal(<dialog ref={ref} className="mobile-panel" aria-label={title} onKeyDown={e=>{
 if(e.key!=='Tab')return;
 const items=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
 const first=items[0],last=items.at(-1);if(!first){e.preventDefault();return;}
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }} onCancel={e=>{e.preventDefault();close.current();}} onClick={e=>{if(e.target===e.currentTarget){const box=e.currentTarget.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)close.current();}}}><header><h2>{title}</h2><button type="button" className="chip" onClick={()=>close.current()}>{t('Close')}</button></header>{children}</dialog>,document.body);
}
