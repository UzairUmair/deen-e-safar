import Image from 'next/image';
import {useState} from 'react';
// Generated from the canonical docs manifest; pending prompts never enter the browser bundle.
import manifest from './illustrations.generated.json';
import { useTranslation } from 'react-i18next';
const lessonCovers:Record<string,string>={'academy:yusuf':'prophets-002','academy:uhud':'events-011','academy:badr':'events-002','academy:khandaq':'events-021'};
export const trackArt:Record<string,string>={seerah:'seerah',sahaba:'sahaba',events:'badr',prophets:'prophets',quran:'quran',hadith:'hadith',fundamentals:'fundamentals'};
const descriptions:Record<string,string>={yusuf:'An empty stone well beside a quiet countryside path.',hudaybiyyah:'An acacia tree in a quiet empty desert valley.',khandaq:'Dark volcanic rocks on the outskirts of a palm oasis.',makkah:'An empty stone street between humble earthen houses.',hero:'A desert path leading toward a distant palm oasis.',seerah:'An empty early Arabian settlement among rugged hills.',sahaba:'A shaded empty courtyard arranged for community learning.',badr:'An open desert basin with an old stone well.',uhud:'A quiet rocky mountain landscape inspired by Uhud.',prophets:'A peaceful river, palms and distant earthen buildings.',quran:'A blank open book on a wooden rehal in a reading alcove.',hadith:'Unmarked books, blank parchment and a reed pen in a study.',fundamentals:'An empty prayer space with woven mats and soft daylight.'};
function AcademyImage({src,alt,width,height,renditions=[],eager=false,sizes='(max-width:700px) 100vw, 900px'}:{src:string;alt:string;width:number;height:number;renditions?:{filename:string;width:number|null}[];eager?:boolean;sizes?:string}){
 const [failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false);const {t}=useTranslation();
 if(failed)return <div className="academy-artwork-unavailable"><p role="status">{t('Illustration unavailable.')}</p></div>;
 return <picture data-loading={!loaded||undefined}>{renditions.length>0&&<source type="image/webp" srcSet={renditions.map(r=>r.filename+' '+r.width+'w').join(',')} sizes={sizes}/>}<Image src={src} alt={alt} width={width} height={height} unoptimized loading={eager?'eager':'lazy'} onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)}/></picture>;
}
export function Artwork({name,className='',priority=false}:{name:string;className?:string;priority?:boolean}){
 const {t}=useTranslation();const track=Object.keys(trackArt).find(id=>trackArt[id]===name);const asset=track?(manifest.find(a=>track==='prophets'&&a.id==='prophets-002')||manifest.find(a=>a.trackId===track&&a.containsPeople)||manifest.find(a=>a.trackId===track)):undefined;
 const src=asset?.filename||'/images/academy/'+name+'.webp';
 return <figure className={'academy-artwork '+className}><AcademyImage key={src} src={src} alt={t(asset?.altText||descriptions[name]||descriptions.hadith)} width={asset?.width||1440} height={asset?.height||(name==='hero'?810:1080)} renditions={asset?.renditions||[]} sizes={priority?'(max-width:700px) 100vw, 700px':'(max-width:700px) 100vw, (max-width:1100px) 45vw, 400px'} eager={priority}/><figcaption>{t(asset?.disclosure||'AI illustration · not historical evidence')}</figcaption></figure>;
}
export function lessonArt(id:string,track:string){if(id==='academy:hijrah')return 'hero';if(['uhud','khandaq','hudaybiyyah','makkah','yusuf'].includes(id.replace('academy:','')))return id.replace('academy:','');return trackArt[track]||'hadith';}

/** Deterministic, approved-only selection. Pending lessons keep the existing thematic fallback. */
export function AcademyIllustration({trackId,lessonId,step,placement='lesson',className=''}:{trackId:string;lessonId?:string;step?:string;placement?:string;className?:string}){
 const {t}=useTranslation();
 const [galleryOpen,setGalleryOpen]=useState(false),[visible,setVisible]=useState(4);
 const candidates=manifest.filter(a=>a.trackId===trackId&&(!lessonId||a.lessonId===lessonId)&&a.placement===placement);
 const cover=step===undefined&&lessonId?candidates.find(a=>a.id===lessonCovers[lessonId]):undefined;
 const asset=cover||candidates.find(a=>a.step===step&&a.containsPeople)||candidates.find(a=>a.step===step)||candidates.find(a=>!a.step)||(step===undefined?(candidates.find(a=>a.containsPeople)||candidates[0]):undefined);
 if(!asset)return <Artwork name={lessonId?lessonArt(lessonId,trackId):trackArt[trackId]||'hero'} className={className}/>;
 return <div className={className}><figure className="academy-artwork"><AcademyImage key={asset.filename} src={asset.filename} alt={asset.altText} width={asset.width||1200} height={asset.height||900} renditions={asset.renditions||[]}/><figcaption>{t(asset.disclosure)}</figcaption></figure>{candidates.length>1&&<details className="academy-image-gallery" onToggle={e=>setGalleryOpen(e.currentTarget.open)}><summary>{t('More illustrations')} · {candidates.length-1}</summary>{galleryOpen&&<><div>{candidates.filter(a=>a.id!==asset.id).slice(0,visible).map(a=><figure className="academy-artwork" key={a.id}><AcademyImage src={a.filename} alt={a.altText} width={a.width||1200} height={a.height||900} renditions={a.renditions||[]}/><figcaption>{t(a.disclosure)}</figcaption></figure>)}</div>{visible<candidates.length-1&&<button type="button" className="chip" onClick={()=>setVisible(n=>n+4)}>{t('Show more illustrations')}</button>}</>}</details>}</div>;
}
