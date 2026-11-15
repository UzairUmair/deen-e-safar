// Reproducible software-WebGL evidence; run with baseline or after as argv[2].
import { fileURLToPath } from 'node:url';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { launch, mockProviders, BASE } from './lib/harness.mjs';

const label = process.argv[2] || 'after';
const dir = fileURLToPath(new URL(`../docs/motion-evidence/${label}/`, import.meta.url));
await mkdir(dir, { recursive: true });
const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir, size: { width: 960, height: 600 } } });
await mockProviders(context);
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(`${BASE}/${process.env.MOTION_GPU === 'native' ? '' : '?3d=force'}`, { waitUntil: 'load' });
await page.waitForSelector('.story[data-timeline="ready"] .story-canvas[data-ready="true"]', { timeout: 90000 });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  window.motionSamples = { frames: [], longTasks: [] };
  let last = performance.now();
  window.motionRecording = true;
  const tick = now => {
    window.motionSamples.frames.push(now - last); last = now;
    if (window.motionRecording) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  new PerformanceObserver(list => window.motionSamples.longTasks.push(...list.getEntries().map(e => e.duration))).observe({ type: 'longtask', buffered: false });
});
const move = async (p, steps = 16) => {
  const [from, to] = await page.evaluate(f => {
    const el = document.querySelector('.story-track'); const r = el.getBoundingClientRect();
    return [scrollY, r.top + scrollY + f * (r.height - innerHeight)];
  }, p);
  for (let i = 1; i <= steps; i++) {
    await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), from + (to - from) * i / steps);
    await page.waitForTimeout(35);
  }
};
for (const p of [0, .15, .30, .45, .60, .75, .90, 1]) {
  await move(p); await page.waitForTimeout(650);
  await page.screenshot({ path: `${dir}/${Math.round(p * 100)}.png` });
}
for (const p of [.2, .8, .45, 0]) { await move(p, 1); await page.waitForTimeout(140); }
await page.waitForTimeout(700);
const samples = await page.evaluate(() => { window.motionRecording = false; return window.motionSamples; });
const frames = samples.frames.slice(1).sort((a,b) => a-b);
const renderer = await page.locator('canvas').evaluate(canvas => {
  const gl = canvas.getContext('webgl2');
  const extension = gl.getExtension('WEBGL_debug_renderer_info');
  return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
});
const result = { label, renderer, mode: process.env.MOTION_GPU === 'native' ? 'native' : 'software', server: BASE, frames: frames.length, medianMs: frames[Math.floor(frames.length * .5)], p95Ms: frames[Math.floor(frames.length * .95)], over33Ms: frames.filter(x => x > 33.4).length, longTasks: samples.longTasks, errors };
await writeFile(`${dir}/metrics.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
const recording = page.video();
await context.close();
await rename(await recording.path(), `${dir}/scroll-story.webm`);
await browser.close();
