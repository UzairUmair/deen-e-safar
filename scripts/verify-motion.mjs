import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fixtureDate, launch, mockProviders, BASE, test, report } from './lib/harness.mjs';

const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await mockProviders(context);
const page = await context.newPage();
await fixtureDate(page);
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.goto(`${BASE}/?3d=force&motion-debug`, { waitUntil: 'load' });
await page.waitForSelector('canvas[data-motion]', { timeout: 60000 });
const jump = p => page.evaluate(f => {
  const r = document.querySelector('.story-track').getBoundingClientRect();
  scrollTo({ top: r.top + scrollY + f * (r.height - innerHeight), behavior: 'instant' });
}, p);
const state = () => page.locator('canvas').evaluate(el => JSON.parse(el.dataset.motion));
const settled = async p => {
  await page.waitForFunction(f => {
    const data = document.querySelector('canvas')?.dataset.motion;
    return data && Math.abs(JSON.parse(data).p - f) < .003;
  }, p, { timeout: 15000 });
};
const evidence = {};
await test('temporal reversal: one progress drives pages and DOM without overshoot', async () => {
  await jump(0); await settled(0);
  const samples = await page.evaluate(() => {
    window.temporalMotion = [];
    window.recordMotion = true;
    const tick = t => {
      const canvas = document.querySelector('canvas');
      if (canvas?.dataset.motion) window.temporalMotion.push({ t, ...JSON.parse(canvas.dataset.motion), night: +getComputedStyle(document.querySelector('.stage-night')).opacity });
      if (window.recordMotion) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return true;
  });
  assert.ok(samples);
  for (const p of [.2, .8, .45, 0]) { await jump(p); await page.waitForTimeout(220); }
  await settled(0);
  evidence.temporal = await page.evaluate(() => { window.recordMotion = false; return window.temporalMotion; });
  assert.ok(evidence.temporal.length > 5);
  for (const sample of evidence.temporal) {
    assert.ok(sample.p >= 0 && sample.p <= 1);
    assert.ok(Math.abs(sample.open - Math.min(1, Math.max(0, (sample.p - .3) / .28))) < .00001);
    if (sample.p < .9) assert.ok(Math.abs(sample.night - Math.min(1, Math.max(0, (sample.p - .38) / .2))) < .002);
  }
});
await test('native mouse-wheel scrolling drives and reverses the story', async () => {
  await jump(0); await settled(0);
  await page.mouse.move(700, 750);
  await page.mouse.wheel(0, 450);
  await page.waitForFunction(() => {
    const s = JSON.parse(document.querySelector('canvas').dataset.motion);
    return scrollY > 100 && s.target > .02 && s.p > 0;
  });
  await page.mouse.wheel(0, -2000);
  await settled(0);
});
await test('mid-animation stop settles; resize and Urdu preserve story progress', async () => {
  await jump(.45); await settled(.45);
  const before = await state();
  await page.waitForTimeout(500);
  assert.ok(Math.abs((await state()).p - before.p) < .003);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await jump(.45); await settled(.45);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  await page.selectOption('.language select', 'ur');
  await page.waitForFunction(() => document.documentElement.dir === 'rtl');
  await page.waitForTimeout(450);
  await page.waitForFunction(() => {
    const s = JSON.parse(document.querySelector('canvas').dataset.motion);
    return Math.abs(s.p - s.target) < .003;
  }, null, { timeout: 15000 });
  assert.ok(Math.abs((await state()).p - (await state()).target) < .003, JSON.stringify(await state()));
  evidence.renderer = await state();
});
await test('refresh at a partial scroll preserves a coordinated scene', async () => {
  const y = await page.evaluate(() => scrollY);
  evidence.reloadBefore = await page.evaluate(() => ({ y: scrollY, state: history.state, saved: sessionStorage.getItem('deen-scroll:' + history.state.deenEntry) }));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('canvas[data-motion]', { timeout: 60000 });
  await page.waitForTimeout(1000);
  evidence.reloadAfter = await page.evaluate(() => ({ y: scrollY, state: history.state, saved: sessionStorage.getItem('deen-scroll:' + history.state.deenEntry) }));
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - y) < 8, JSON.stringify({ before: evidence.reloadBefore, after: evidence.reloadAfter }));
  const current = await state();
  assert.ok(Math.abs(current.p - current.target) < .003);
});
await test('scrolling past the settled story does not keep rendering WebGL', async () => {
  await jump(1.02); await settled(1);
  await page.waitForFunction(() => {
    const s = JSON.parse(document.querySelector('canvas').dataset.motion);
    return s.p === s.target && s.target === 1;
  }, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const before = await state();
  await page.evaluate(() => scrollTo({ top: scrollY + 240, behavior: 'instant' }));
  await page.waitForTimeout(600);
  assert.equal((await state()).frame, before.frame);
});
await test('hash Back/Forward restores positions and keeps application routes canvas-free', async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await jump(.75); await settled(.75);
  const y = await page.evaluate(() => scrollY);
  await page.click('.guide-copy .btn');
  await page.waitForSelector('.surah-tile');
  assert.equal(await page.locator('canvas').count(), 0);
  assert.equal(await page.evaluate(() => scrollY), 0);
  await page.goBack();
  await page.waitForSelector('canvas[data-motion]', { timeout: 60000 });
  await page.waitForFunction(top => Math.abs(scrollY - top) < 8, y);
  await settled(.75);
  await page.goForward();
  await page.waitForSelector('.surah-tile');
  assert.equal(await page.evaluate(() => scrollY), 0);
});
await test('no JavaScript or console errors through reversal, resize, reload and history', async () => assert.deepEqual(errors, []));
const output = new URL('../docs/motion-evidence/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('temporal.json', output), JSON.stringify(evidence, null, 2));
await context.close(); await browser.close();
report();
