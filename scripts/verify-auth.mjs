// Real Firebase Auth emulator + Admin token verification + temporary MongoDB + browser UI.
// Run the three local processes documented in docs/backend-setup.md first.
import assert from 'node:assert/strict';
import { launch, mockProviders } from './lib/harness.mjs';
const BASE = process.env.AUTH_BASE || 'http://127.0.0.1:3100';
if (new URL(BASE).hostname !== '127.0.0.1') throw new Error('This test is local-emulator-only.');
const emulator = 'http://127.0.0.1:9099', project = 'demo-deen-e-safar';
const admin = path => `${emulator}/emulator/v1/projects/${project}/${path}`;
assert.equal((await fetch(admin('accounts'), { method: 'DELETE' })).status, 200);
const browser = await launch(), context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await mockProviders(context); const page = await context.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
const password = 'Controlled-Emulator-Password-123!';
const email = 'reader@emulator.example.test';
const expectText = async (text, timeout = 20000) => page.getByText(text, { exact: true }).first().waitFor({ timeout });
const synced = async () => { await page.waitForFunction(() => !document.querySelector('.account-sync'), { timeout: 20000 }); };
async function visit(hash) { await page.goto(BASE + '/#' + hash); await page.waitForSelector('html[data-theme]'); }
async function signOut() { await visit('/account'); await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await page.waitForURL('**/#/dashboard'); }
try {
  await visit('/account/dashboard'); await expectText('Sign in to your account');
  await visit('/quran/112'); await page.waitForSelector('#ayah-1');
  await page.locator('#ayah-1 button[aria-label="Bookmark verse 1"]').click();
  const guest = await page.evaluate(() => localStorage.getItem('deen-v2:guest:bookmarks'));
  await visit('/auth/signup'); await page.getByLabel('Name', { exact: true }).fill('Emulator Reader');
  await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForURL('**/#/account/dashboard'); await synced();
  await visit('/bookmarks'); await expectText('No saved verses yet');
  await visit('/account'); await page.getByLabel('Name', { exact: true }).fill('Updated Reader'); await page.getByRole('button', { name: 'Save profile', exact: true }).click(); await expectText('Saved.');
  await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Import selected guest data', exact: true }).click(); await expectText('Guest data imported. The guest copy remains on this device.');
  await page.getByRole('button', { name: 'Import selected guest data', exact: true }).click(); await expectText('Guest data imported. The guest copy remains on this device.');
  assert.equal(await page.evaluate(() => localStorage.getItem('deen-v2:guest:bookmarks')), guest);
  await visit('/bookmarks'); assert.equal(await page.locator('.bookmark-row').count(), 1);
  const codes = (await (await fetch(admin('oobCodes'))).json()).oobCodes;
  const verification = codes.filter(code => code.email === email && code.requestType === 'VERIFY_EMAIL').at(-1); assert.ok(verification);
  await page.goto(BASE + '/?mode=verifyEmail&oobCode=' + encodeURIComponent(verification.oobCode));
  await page.getByRole('button', { name: 'Confirm', exact: true }).click(); await expectText('Email verified. Sign in or refresh your account.');
  await visit('/account'); await page.getByRole('button', { name: 'I have verified my email', exact: true }).click(); await expectText('Email verified');
  await signOut(); await visit('/auth/login'); await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.waitForURL('**/#/account/dashboard'); await synced();
  await expectText('Good afternoon, Updated Reader').catch(async () => { assert.match(await page.locator('.feature-heading').innerText(), /Updated Reader/); });
  await signOut(); await visit('/auth/reset'); await page.getByLabel('Email', { exact: true }).fill(email); await page.getByRole('button', { name: 'Send reset email', exact: true }).click(); await expectText('If an account exists, a password reset email has been sent.');
  const resetCodes = (await (await fetch(admin('oobCodes'))).json()).oobCodes;
  const reset = resetCodes.filter(code => code.email === email && code.requestType === 'PASSWORD_RESET').at(-1); assert.ok(reset);
  await page.goto(BASE + '/?mode=resetPassword&oobCode=' + encodeURIComponent(reset.oobCode)); await page.getByLabel('Password', { exact: true }).fill(password + 'New'); await page.getByRole('button', { name: 'Confirm', exact: true }).click(); await expectText('Password reset. Sign in with your new password.');
  await visit('/auth/login'); await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(password + 'New'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.waitForURL('**/#/account/dashboard'); await synced();
  await visit('/account'); await page.getByRole('button', { name: 'Delete account', exact: true }).click(); await page.getByLabel('Current password', { exact: true }).fill(password + 'New'); await page.getByRole('button', { name: 'Confirm permanent deletion', exact: true }).click(); await page.waitForURL('**/#/dashboard');
  await visit('/account/dashboard'); await expectText('Sign in to your account');
  await visit('/auth/login');
  const popupEvent = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
  const popup = await popupEvent;
  // Emulator markup renders before its provider data; wait for initialization
  // before opening the form, which initialization would otherwise replace.
  await popup.getByText('Sign-in with Google.com', { exact: true }).waitFor();
  await popup.getByText('Add new account', { exact: true }).click();
  await popup.locator('#email-input').fill('google-reader@emulator.example.test');
  await popup.locator('#display-name-input').fill('Emulated Google Reader');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  await page.waitForURL('**/#/account/dashboard'); await synced();
  await visit('/account'); await expectText('google-reader@emulator.example.test'); await expectText('Email verified');
  assert.equal(await page.getByRole('button', { name: 'Link Google account', exact: true }).count(), 0);
  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Account overflow at ${width}px`);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.locator('.language select').selectOption('ur');
  await page.waitForFunction(() => document.documentElement.dir === 'rtl'); await synced();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Urdu account overflow');
  await page.screenshot({ path: '.openai/backend-account-ur-mobile.png', fullPage: true });
  await page.locator('.language select').selectOption('en'); await page.waitForFunction(() => document.documentElement.dir === 'ltr'); await synced();
  await page.setViewportSize({ width: 1280, height: 900 });
  await signOut();
  assert.deepEqual(errors, []);
  console.info('PASS: real local Firebase SDK signup/login and simulated Google popup, Admin verification, profile persistence, guest import/idempotency/isolation, email verification, password reset, protected routes, logout, recent-auth deletion and responsive English/Urdu Account UI; temporary MongoDB. No live credentials used.');
} catch (error) { console.error('Visible error:', await page.locator('[role=alert]').allTextContents()); await page.screenshot({ path: '.openai/backend-auth-failure.png', fullPage: true }); throw error; } finally { await context.close(); await browser.close(); }
