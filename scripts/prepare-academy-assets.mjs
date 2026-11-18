import fs from 'node:fs/promises';
import sharp from 'sharp';
const file='docs/academy-image-manifest.json';const rows=JSON.parse(await fs.readFile(file,'utf8'));const runtime=[];
for(const r of rows){if(r.approvalStatus!=='approved-thematic'||r.generationStatus!=='generated')continue;
 if(r.category==='prophets'&&r.faceReview!=='no-people-manually-reviewed')throw Error('Prophets artwork must be non-figurative: '+r.id);
 const original=await fs.readFile('public'+r.filename);const metadata=await sharp(original).metadata();r.width=metadata.width;r.height=metadata.height;r.fileSize=original.length;
 const variant=r.filename.replace(/\.webp$/,'-600w.webp');await sharp('public'+r.filename).resize({width:600,withoutEnlargement:true}).webp({quality:80}).toFile('public'+variant);
 r.renditions=[{filename:variant,width:600},{filename:r.filename,width:r.width}];
 runtime.push({containsPeople:r.faceReview==='fully-blurred-faces-manually-reviewed',...Object.fromEntries(['id','trackId','lessonId','step','placement','filename','altText','width','height','disclosure','renditions'].map(k=>[k,r[k]??null]))});
}
await fs.writeFile(file,JSON.stringify(rows,null,2)+'\n');await fs.writeFile('app/features/academy/illustrations.generated.json',JSON.stringify(runtime,null,2)+'\n');console.log(`Prepared ${runtime.length} approved assets and responsive renditions (not unique-image counts).`);
