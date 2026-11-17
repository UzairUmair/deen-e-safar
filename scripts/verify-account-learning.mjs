// Local real Firebase SDK/Admin + temporary MongoDB. No production mutations.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launch,mockProviders} from './lib/harness.mjs';
const BASE='http://127.0.0.1:3100';
await mkdir('.openai/account-learning',{recursive:true});
const browser=await launch(),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
await mockProviders(context);const errors=[];page.on('pageerror',e=>errors.push(e.message));
const visit=async hash=>page.goto(BASE+'/#'+hash);
const synced=()=>page.waitForFunction(()=>!document.querySelector('.account-sync'),{timeout:20000});
try{
 await visit('/auth/signup');await page.getByLabel('Full Name',{exact:true}).fill('Redesign Test Reader');await page.getByLabel('Email Address',{exact:true}).fill(`redesign-${Date.now()}@emulator.example.test`);await page.getByLabel('Password',{exact:true}).fill('Controlled-Emulator-Password-123!');await page.getByLabel('Confirm Password',{exact:true}).fill('Controlled-Emulator-Password-123!');await page.getByRole('button',{name:'Create Account',exact:true}).click();await page.getByRole('link',{name:'Continue to dashboard',exact:true}).click();await synced();
 await visit('/account');await page.getByText('Your next chapter starts here',{exact:true}).waitFor();
 assert.deepEqual(await page.locator('.account-stat-grid strong').allTextContents(),['0','0','0']);
 await page.getByRole('button',{name:'Edit profile',exact:true}).click();assert.equal(await page.locator('#account-profile-name').evaluate(e=>e===document.activeElement),true);
 await page.getByLabel('Name',{exact:true}).fill('Updated Redesign Reader');await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByText('Saved.',{exact:true}).waitFor();
 await page.getByLabel('Preferred explanation language',{exact:true}).selectOption('roman-ur');await page.getByLabel('Preferred difficulty',{exact:true}).selectOption('intermediate');await page.getByLabel('Lesson text size',{exact:true}).selectOption('large');await synced();await page.reload();await page.getByLabel('Preferred explanation language',{exact:true}).waitFor();await synced();await page.waitForFunction(()=>document.querySelector('[aria-label="Preferred explanation language"]')?.value==='roman-ur');assert.equal(await page.getByLabel('Preferred explanation language',{exact:true}).inputValue(),'roman-ur');
 await page.getByLabel('Preferred explanation language',{exact:true}).selectOption('en');await synced();
 await visit('learn?preview=1&lesson=academy:patience');await page.locator('.academy-preview').waitFor();assert.equal(await page.locator('.academy-preview img').evaluate(e=>e.complete&&e.naturalWidth>0),true);await page.getByRole('link',{name:'Start Lesson',exact:true}).click();await page.getByRole('button',{name:'Save lesson',exact:true}).click();await page.getByText('Lesson saved to your account.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByText('Progress saved.',{exact:true}).waitFor();
 await visit('/account');await page.locator('.account-saved-item').waitFor();assert.deepEqual(await page.locator('.account-stat-grid strong').allTextContents(),['0','1','1']);
 await page.getByLabel('Search saved content',{exact:true}).fill('zz-no-match');await page.getByText('No saved content matches. Save a verse, dua, hadith or lesson to find it here.',{exact:true}).waitFor();await page.getByLabel('Search saved content',{exact:true}).fill('');await page.locator('.account-saved-item a').click();await page.locator('.academy-lesson').waitFor();await page.getByText('Step 2 / 3',{exact:true}).waitFor();
 await visit('/account');await page.locator('.account-saved-item').waitFor();await page.locator('.account-saved-item button').click();await page.getByText('No saved content matches. Save a verse, dua, hadith or lesson to find it here.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Delete account',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);
 let layouts=0;
 for(const language of ['en','ur']){
  await page.locator('#account-preferences select').first().selectOption(language);await synced();
  for(const width of [320,360,390,430,768,1024,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Account ${language} ${width}`);layouts++;if([390,1440].includes(width))await page.evaluate(()=>window.scrollTo(0,0));if([390,1440].includes(width))await page.screenshot({path:`.openai/account-learning/account-${language}-${width}.png`,fullPage:true});}
 }
 await page.locator('#account-preferences select').first().selectOption('en');await synced();
 await visit('learn');await page.locator('.academy-track img').last().scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('.academy-artwork img')].every(i=>i.complete&&i.naturalWidth>0));
 assert.equal(new Set(await page.locator('.academy-track img').evaluateAll(imgs=>imgs.map(i=>i.getAttribute('src')))).size,7);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'.openai/account-learning/academy.png',fullPage:true});
 await visit('/account');await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/#/dashboard');
 assert.deepEqual(errors,[]);console.log(`PASS: new-user empty state, real counters, profile edit, persisted learning preferences, illustrated preview, lesson bookmark/open/remove, resumed progress, deletion dialog cancel, sign-out, all 7 track assets load and are distinct; ${layouts} account EN/UR layouts.`);
}catch(e){await page.screenshot({path:'.openai/account-learning/failure.png',fullPage:true});throw e;}finally{await browser.close();}
