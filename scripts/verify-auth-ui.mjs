// Visual and accessibility checks use the local demo Auth emulator only.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launch, mockProviders } from './lib/harness.mjs';
const BASE = process.env.AUTH_BASE || 'http://127.0.0.1:3100';
if (new URL(BASE).hostname !== '127.0.0.1') throw new Error('Use the local demo configuration for authentication UI checks.');
await mkdir('.openai/auth', { recursive: true });
const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
await mockProviders(context);
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
let layouts = 0;
try {
  for (const language of ['en', 'ur']) {
    for (const mode of ['login', 'signup']) {
      await page.goto(`${BASE}/#/auth/${mode}`);
      await page.locator('.language select').selectOption(language);
      await page.waitForFunction(lang => document.documentElement.lang === lang, language);
      for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1050 });
        await page.locator('.auth-card').waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${language} ${mode}: overflow at ${width}`);
        assert.ok(await page.locator('#auth-email').isVisible());
        assert.equal(await page.locator('#auth-email').getAttribute('dir'), 'ltr');
        assert.equal(await page.locator('#auth-password').getAttribute('autocomplete'), mode === 'signup' ? 'new-password' : 'current-password');
        assert.equal(await page.locator('canvas').count(), 0, 'Auth must not mount the homepage 3D scene');
        for (const control of ['.auth-primary', '.auth-google', '.auth-eye']) {
          const box = await page.locator(control).first().boundingBox();
          assert.ok(box && box.height >= 43.9 && box.width >= 43.9, `${control} tap target at ${width}: ${JSON.stringify(box)}`);
        }
        if ([390, 1440].includes(width)) {
          await page.waitForFunction(() => getComputedStyle(document.querySelector('#main > div')).opacity === '1');
          await page.screenshot({ path: `.openai/auth/${mode}-${language}-${width}.png`, fullPage: true, animations: 'disabled' });
        }
        layouts++;
      }
    }
  }
  await page.locator('.language select').selectOption('en');
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await page.goto(`${BASE}/#/auth/signup`);
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await page.getByText('Enter your full name.', { exact: true }).waitFor();
  assert.equal(await page.locator('#auth-name').evaluate(el => el === document.activeElement), true);
  assert.equal(await page.locator('#auth-name').getAttribute('aria-invalid'), 'true');
  await page.locator('#auth-password').fill('Sample-password');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  assert.equal(await page.locator('#auth-password').getAttribute('type'), 'text');
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  await page.locator('#auth-password').fill('');
  await page.getByRole('button', { name: 'Toggle dark mode', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page.screenshot({ path: '.openai/auth/signup-dark-1440.png', fullPage: true, animations: 'disabled' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.auth-form-side').evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.goto(`${BASE}/#/auth/reset`);
  await page.getByRole('button', { name: 'Send reset email', exact: true }).waitFor();
  assert.equal(await page.locator('#auth-password').count(), 0);
  assert.deepEqual(errors, []);
  console.info(`PASS: ${layouts} English/Urdu auth layouts across 320/360/390/430/768/1024/1440px, tap targets, LTR credentials, password-manager attributes, no 3D canvas, inline validation/focus, password visibility, dark theme, reduced motion and reset form. Screenshots: .openai/auth/.`);
} finally { await context.close(); await browser.close(); }
