import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
// Input must be a review ledger authored after actual full-resolution visual inspection.
const input=process.argv[2];if(!input)throw Error('Usage: node scripts/register-reviewed-images.mjs <review-ledger.json>');
const review=JSON.parse(await fs.readFile(input,'utf8'));const file='docs/academy-image-manifest.json';const rows=JSON.parse(await fs.readFile(file,'utf8'));
for(const item of review){const row=rows.find(r=>r.id===item.id);if(!row)throw Error('Unknown ID');if(row.approvalStatus==='approved-thematic')throw Error('Refusing to overwrite approved artwork');if(!['accepted-no-people-no-text-thematic','accepted-fully-blurred-faces-no-text-thematic'].includes(item.visualReview))throw Error('Manual visual review required');
 const data=await fs.readFile(item.source);const sourceHash=crypto.createHash('sha256').update(data).digest('hex');if(rows.some(r=>r.sourceSha256===sourceHash))throw Error('Duplicate source');
 const slug=row.sceneDescription.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,65).replace(/-$/,'');row.filename=`/images/academy/${row.category}/${row.id}-${slug}.webp`;await fs.mkdir(`public/images/academy/${row.category}`,{recursive:true});await sharp(data).resize({width:1200}).webp({quality:82}).toFile('public'+row.filename);
 Object.assign(row,{generationStatus:'generated',approvalStatus:'approved-thematic',storyboardStatus:'visually-reviewed-thematic',faceReview:item.visualReview==='accepted-fully-blurred-faces-no-text-thematic'?'fully-blurred-faces-manually-reviewed':'no-people-manually-reviewed',historicalReview:'thematic-only-not-historical-evidence',generatedDate:'2026-11-17',sourceOutput:path.basename(item.source),sourceSha256:sourceHash,manualReview:{date:'2026-11-17',method:item.reviewMethod||'full-resolution agent visual inspection',faces:item.visualReview==='accepted-fully-blurred-faces-no-text-thematic'?'all fully blurred; no recognizable features':'none',humanForms:item.visualReview==='accepted-fully-blurred-faces-no-text-thematic'?'thematic figures permitted by user revision 2026-11-17':'none',sacredText:'none',historicalAccuracy:'General thematic/environmental illustration only; no exact-event reconstruction approved'}});
}
await fs.writeFile(file,JSON.stringify(rows,null,2)+'\n');console.log(`Registered ${review.length} manually accepted assets. Run validation, responsive preparation and progress report.`);
