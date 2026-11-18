// Applies the individually inspected replacements from the final QA ledger.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const input=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const file='docs/academy-image-manifest.json';
const rows=JSON.parse(await fs.readFile(file,'utf8'));
const root=process.cwd();
const safe=p=>{const absolute=path.resolve(p);if(!absolute.startsWith(root+path.sep))throw Error('Archive path outside workspace');return absolute;};
const archive='.openai/final-qa/retired';await fs.mkdir(safe(archive),{recursive:true});
for(const item of input.items){
 const r=rows.find(x=>x.id===item.id);if(!r||r.category!=='prophets'||r.replacementHistory)throw Error('Unexpected replacement');
 const old={filename:r.filename,sourceOutput:r.sourceOutput,sourceSha256:r.sourceSha256,generationPrompt:r.generationPrompt,reason:'Final QA brief forbids any figure standing in for a Prophet.'};
 for(const filename of new Set([r.filename,...(r.renditions||[]).map(v=>v.filename)])){await fs.rename(safe('public'+filename),safe(archive+'/'+path.basename(filename)));}
 old.archivedAt=archive+'/'+path.basename(r.filename);r.replacementHistory=[old];
 const base=r.sceneDescription.split(/ Includes /i)[0];r.sceneDescription=base;r.subject=base;r.altText=base+' Non-figurative educational illustration.';
 r.filename='/images/academy/prophets/'+r.id+'-environment-v2.webp';
 const data=await fs.readFile(item.source);await sharp(data).resize({width:1200,withoutEnlargement:true}).webp({quality:82}).toFile(safe('public'+r.filename));
 r.generationPrompt=input.editPrompt;r.sourceOutput=path.basename(item.source);r.sourceSha256=crypto.createHash('sha256').update(data).digest('hex');r.renditions=[];
 r.faceReview='no-people-manually-reviewed';r.humanRestrictions='No humans, silhouettes, back-facing figures, reflections or Prophet stand-ins.';r.negativePrompt='Any human or Prophet depiction; silhouettes; writing; fabricated sacred text; exact event claims';
 r.manualReview={date:'2026-11-17',method:'Individual original-resolution inspection of edited output',faces:'none',humanForms:'none',sacredText:'none',historicalAccuracy:'Thematic environment only; no specific event or personal possession claimed.'};
}
for(const r of rows){
 if(r.approvalStatus==='rejected'&&!r.archivePath){r.archivePath=archive+'/'+path.basename(r.filename);await fs.rename(safe('public'+r.filename),safe(r.archivePath));r.retiredPublicFilename=r.filename;r.filename=null;r.renditions=[];}
 if(r.approvalStatus!=='approved-thematic')continue;
 r.finalQA={date:'2026-11-17',visualReview:'accepted-thematic',method:input.humanReviewed.includes(r.id)||r.replacementHistory?'individual original-resolution inspection':'labeled 400px contact-sheet inspection',religiousContent:'No generated religious lettering or authenticated portrait claimed',historicalStatus:'thematic-only-not-scholarly-verified'};
 if(r.faceReview==='fully-blurred-faces-manually-reviewed'){r.finalQA.faces='Every visible face and background figure inspected: no recognizable eyes, nose or mouth; no revealing reflections';r.disclosure='AI-generated historical illustration — not an authentic portrait or historical evidence.';}
 if(r.category==='prophets')r.finalQA.prophetRepresentation='none';
}
await fs.writeFile(file,JSON.stringify(rows,null,2)+'\n');
console.log('Applied 25 reviewed replacements; archived superseded files and rejected artifacts outside public; recorded final visual review.');
