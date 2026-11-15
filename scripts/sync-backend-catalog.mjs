// Extract literals only: never evaluate frontend code on the server.
import ts from 'typescript';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
const read = file => readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
function literal(node) {
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return literal(node.expression);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(p => {
    if (!ts.isPropertyAssignment(p)) throw Error('Non-literal catalog field');
    return [p.name.text, literal(p.initializer)];
  }));
  throw Error('Catalog must contain static literals');
}
function array(file, name) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let value;
  const walk = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) value = literal(node.initializer);
    ts.forEachChild(node, walk);
  };
  walk(source);
  if (!Array.isArray(value)) throw Error('Missing catalog array: ' + name);
  return value;
}
const lessonFile = 'app/features/Learn.tsx';
const lessons = array(lessonFile, 'lessons').map((l, i) => ({ id: String(i), courseId: l.path, title: l.title, question: l.question, options: l.options, correct: l.correct }));
const index = JSON.parse(read('public/content/quran-index.json'));
const duas = JSON.parse(read('public/content/duas.json'));
const hadiths = JSON.parse(read('public/content/hadiths.json'));
const result = {
  sourceHash: createHash('sha256').update(read(lessonFile).replace(/\r\n/g, '\n')).digest('hex'),
  lessons,
  quizzes: { discovery: { options: array('app/page.tsx', 'QUIZ_OPTIONS'), correct: 0 } },
  ayahCounts: index.chapters.map(ch => ch.count),
  duaRefs: duas.map(d => `${d.surah}-${d.id}`),
  hadithRefs: hadiths.map(h => String(h.id)),
};
const output = process.argv[2] ? pathToFileURL(resolve(process.argv[2]) + sep) : new URL('../generated/', import.meta.url);
mkdirSync(output, { recursive: true });
writeFileSync(new URL('catalog.json', output), JSON.stringify(result, null, 2) + '\n');
console.log(`Catalog: ${lessons.length} lessons, ${index.chapters.length} surahs; no source text approved for AI.`);
