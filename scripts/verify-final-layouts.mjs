import fs from 'node:fs/promises';
import {launch,mockProviders,preferences,fixtureDate} from './lib/harness.mjs';
const BASE=process.env.BASE||'http://127.0.0.1:3000';
const routes=[['home','/','.hero-copy'],['quran','/quran','.surah-tile'],['reader','/quran/1','.ayah'],['learn','learn','.academy'],['lesson','learn?preview=1&lesson=academy:patience','.academy-preview'],['ai','/ai','.assistant-workspace'],['duas','/duas','.dua-card'],['prayer','/prayer','.prayer-cards'],['dashboard','/dashboard','.app-screen'],['account','/account','.app-screen'],['signin','/auth/login','form'],['signup','/auth/signup','form']];
const widths=[320,360,390,430,768,1024,1440,1920];
const rows=[],errors=[];const b=await launch();await fs.mkdir('.openai/final-qa/screenshots',{recursive:true});
try{for(const lang of ['en','ur']){
 const c=await b.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await mockProviders(c);await c.addInitScript(data=>Object.entries(data).forEach(([k,v])=>localStorage.setItem(k,v)),preferences({language:lang}));const p=await c.newPage();await fixtureDate(p);p.on('pageerror',e=>errors.push({lang,message:e.message}));
 for(const [name,hash,selector]of routes){
  await p.goto(BASE+'/#'+hash);await p.locator(selector).first().waitFor();
  for(const width of widths){await p.setViewportSize({width,height:1000});await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(120);
   const row=await p.evaluate(()=>{const h=document.querySelector('h1'),nav=document.querySelector('.header');const hr=h?.getBoundingClientRect(),nr=nav?.getBoundingClientRect();return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,headingTop:hr?.top,navBottom:nr?.bottom,headingOverlap:hr&&nr?hr.top<nr.bottom&&hr.bottom>nr.top:false,dir:document.documentElement.dir,emptyButtons:[...document.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width>0&&!e.textContent.trim()&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')).length};});rows.push({name,lang,...row});
   if([390,1440].includes(width))await p.screenshot({path:`.openai/final-qa/screenshots/${name}-${lang}-${width}.png`});
  }
  if(name==='learn'){await p.locator('.academy-track').first().scrollIntoViewIfNeeded();await p.screenshot({path:`.openai/final-qa/screenshots/cards-${lang}.png`});}
 }
 await c.close();
}}finally{await b.close();}
const failures=rows.filter(r=>r.scrollWidth>r.width+1||r.headingOverlap||r.emptyButtons);await fs.writeFile('.openai/final-qa/layout-results.json',JSON.stringify({rows,errors,failures},null,2));console.log(JSON.stringify({checks:rows.length,failures,errors}));if(failures.length||errors.length)process.exitCode=1;
