import fs from 'node:fs/promises';
import {launch,mockProviders} from './lib/harness.mjs';
const base=process.env.BASE||'http://127.0.0.1:3000',phase=process.argv[2]||'after';
const browser=await launch();const results=[];
try{for(const width of [390,1440])for(const route of ['home','learn']){
 const context=await browser.newContext({viewport:{width,height:900}});await mockProviders(context);
 await context.addInitScript(()=>{window.qaPerf={cls:0,longTasks:[]};new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.qaPerf.cls+=e.value}).observe({type:'layout-shift',buffered:true});new PerformanceObserver(list=>window.qaPerf.longTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});});
 const page=await context.newPage();await page.goto(base+'/#/'+(route==='home'?'':route));await page.locator(route==='learn'?'.academy':'.hero-copy').waitFor();await page.waitForTimeout(2500);
 results.push(await page.evaluate(({route,width})=>{const resources=performance.getEntriesByType('resource');const js=resources.filter(x=>/\.js(?:\?|$)/.test(x.name)),images=resources.filter(x=>x.name.includes('/images/academy/'));return {route,width,jsBytes:js.reduce((n,x)=>n+x.encodedBodySize,0),jsRequests:js.length,academyImageRequests:images.length,academyImageBytes:images.reduce((n,x)=>n+x.encodedBodySize,0),loadedImageWidths:[...document.querySelectorAll('.academy-track img')].map(i=>({rendered:Math.round(i.getBoundingClientRect().width),selected:i.currentSrc.includes('600w')?600:1200})),cls:window.qaPerf.cls,longTasks:window.qaPerf.longTasks,paint:performance.getEntriesByType('paint').map(x=>({name:x.name,start:x.startTime}))}},{route,width}));
 await context.close();
}}finally{await browser.close();}
await fs.writeFile('.openai/final-qa/performance-'+phase+'.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
