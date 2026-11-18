import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';
import path from 'node:path';
const file='docs/academy-image-manifest.json';
const rows=JSON.parse(await fs.readFile(file,'utf8'));const hashes=new Map();const counts={};const ids=new Set();const catalog=JSON.parse(await fs.readFile('app/features/academy/catalog.json','utf8'));
for(const row of rows){
 if(ids.has(row.id))throw Error('Duplicate ID');ids.add(row.id);
 if(!catalog.lessons.some(l=>l.id===row.lessonId&&l.trackId===row.trackId))throw Error('Invalid lesson association: '+row.id);
 if(!row.id||!row.category||!row.altText||!row.approvalStatus)throw Error('Missing metadata');
 const count=counts[row.category]??={planned:0,generated:0,approved:0,pending:0,rejected:0};count.planned++;
 if(row.generationStatus==='pending'){count.pending++;continue;}
 if(row.approvalStatus==='rejected'&&row.archivePath){const archived=path.resolve(row.archivePath);if(!archived.startsWith(path.resolve('.openai/final-qa/retired')+path.sep))throw Error('Invalid rejected archive');const data=await fs.readFile(archived);await sharp(data).metadata();count.generated++;count.rejected++;continue;}
 if(row.approvalStatus==='approved-thematic'&&row.category==='prophets'&&row.faceReview!=='no-people-manually-reviewed')throw Error('Prophets artwork must be non-figurative: '+row.id);
 if(row.approvalStatus==='approved-thematic'&&(!['no-people-manually-reviewed','fully-blurred-faces-manually-reviewed'].includes(row.faceReview)||row.historicalReview!=='thematic-only-not-historical-evidence'))throw Error('Missing review');
 const root=path.resolve('public/images/academy');const target=path.resolve('public'+row.filename);if(!target.startsWith(root+path.sep))throw Error('Asset outside academy directory');
 for(const rendition of row.renditions||[]){const file=path.resolve('public'+rendition.filename);if(!file.startsWith(root+path.sep))throw Error('Invalid rendition path');const info=await sharp(await fs.readFile(file)).metadata();if(info.width!==rendition.width)throw Error('Incorrect rendition width');}
 const data=await fs.readFile(target);const meta=await sharp(data).metadata();if(!meta.width||!meta.height)throw Error('Invalid image');
 const hash=crypto.createHash('sha256').update(data).digest('hex');if(hashes.has(hash))throw Error('Duplicate '+row.id);hashes.set(hash,row.id);
 count.generated++;if(row.approvalStatus==='approved-thematic')count.approved++;if(row.approvalStatus==='rejected')count.rejected++;
 row.width=meta.width;row.height=meta.height;row.fileSize=data.length;row.sha256=hash;
 if(Math.abs(meta.width/meta.height-4/3)>.03)throw Error('Wrong ratio');
}
await fs.writeFile(file,JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(counts,null,2));
