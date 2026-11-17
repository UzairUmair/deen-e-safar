// Real local Firebase SDK/Admin + temporary MongoDB; controlled Groq fixture only.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launch, mockProviders } from './lib/harness.mjs';
const BASE=process.env.AUTH_BASE||'http://127.0.0.1:3100';
if(new URL(BASE).hostname!=='127.0.0.1')throw Error('This integration check is local-demo-only.');
await mkdir('.openai/academy',{recursive:true});
const browser=await launch(),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
await mockProviders(context);const errors=[];page.on('pageerror',e=>errors.push(e.message));
const visit=async(hash)=>{await page.goto(BASE+'/#'+hash);await page.locator('.academy').waitFor();};
const text=async(value)=>page.getByText(value,{exact:true}).first().waitFor();
const email=`academy-${Date.now()}@emulator.example.test`;
let layouts=0;
try{
  await visit('learn');assert.equal(await page.locator('.academy-track').count(),7);
  await page.getByRole('button',{name:'Stories of the Sahaba',exact:true}).click();assert.equal(await page.locator('.academy-track').count(),1);
  await page.getByRole('link',{name:/Abu Bakr/}).waitFor();
  await page.getByRole('button',{name:'All topics',exact:true}).click();
  await page.getByLabel('What would you like to learn?',{exact:true}).fill('Mujhe Ghazwa-e-Badr sikhao');
  await page.getByRole('button',{name:'Find my lesson',exact:true}).click();await page.waitForURL('**/#learn?lesson=academy%3Abadr');
  await text('Badr: Quranic passages and their limits');
  await visit('learn?lesson=academy:patience');await page.locator('.academy-arabic').waitFor();
  assert.equal(await page.getByRole('button',{name:'Teach this step',exact:true}).isEnabled(),false);
  await page.getByLabel('Your private study notes',{exact:true}).fill('Controlled guest reflection');
  await page.getByRole('button',{name:'Continue',exact:true}).click();await text('Progress saved.');
  await page.reload();await page.waitForFunction(()=>document.querySelector('.academy-note textarea')?.value==='Controlled guest reflection');
  assert.match(await page.locator('.academy-outline').innerText(),/Step 2 \/ 3/);
  await page.goto(BASE+'/#/auth/signup');await page.getByLabel('Full Name',{exact:true}).fill('Academy Demo Learner');
  await page.getByLabel('Email Address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill('Local-Demo-Password-123!');await page.getByLabel('Confirm Password',{exact:true}).fill('Local-Demo-Password-123!');
  await page.getByRole('button',{name:'Create Account',exact:true}).click();await text('Your journey starts here');
  const codes=(await(await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-deen-e-safar/oobCodes')).json()).oobCodes;
  const code=codes.filter(c=>c.email===email&&c.requestType==='VERIFY_EMAIL').at(-1);assert.ok(code);
  await page.goto(BASE+'/?mode=verifyEmail&oobCode='+encodeURIComponent(code.oobCode));await page.getByRole('button',{name:'Confirm',exact:true}).click();await text('Email verified. Sign in or refresh your account.');
  await page.goto(BASE+'/#/account');await page.getByRole('button',{name:'I have verified my email',exact:true}).click();await text('Email verified');
  await visit('learn');await page.getByRole('checkbox',{name:/I consent to importing guest academy/}).check();await page.getByRole('button',{name:'Import guest learning',exact:true}).click();await text('Guest learning imported. Device data was kept.');
  await visit('learn?lesson=academy:patience');await page.locator('.academy-note textarea').waitFor();await page.waitForFunction(()=>document.querySelector('.academy-note textarea')?.value==='Controlled guest reflection');
  await page.getByRole('button',{name:'Teach this step',exact:true}).click();await text('This passage connects patience and prayer.');
  await text('Controlled local mock; not a live Groq answer.');
  await page.getByLabel('Your question or reflection',{exact:true}).fill('How does this relate to the passage?');await page.getByRole('button',{name:'Ask AI',exact:true}).click();await text('How does this relate to the passage?');
  await page.getByRole('button',{name:'Explain Simply',exact:true}).click();await page.locator('.academy-answer').last().waitFor();
  await page.getByRole('button',{name:'Take Quiz',exact:true}).click();await text('Which practice is paired with patience?');await page.getByRole('radio',{name:'Prayer',exact:true}).check();await page.getByRole('button',{name:'Check answer',exact:true}).click();await text('1 / 1');
  await page.getByLabel('Question format',{exact:true}).selectOption('true-false');await page.getByRole('button',{name:'Take Quiz',exact:true}).click();await text('The passage connects patience with prayer.');await page.getByRole('radio',{name:'True',exact:true}).waitFor();assert.equal(await page.getByRole('radio').count(),2);
  await page.getByRole('radio',{name:'True',exact:true}).check();await page.getByRole('button',{name:'Check answer',exact:true}).click();await text('1 / 1');
  await page.getByLabel('Learning language',{exact:true}).selectOption('ur');await page.getByRole('button',{name:'یہ مرحلہ سمجھائیں',exact:true}).click();await text('اس آیت میں صبر اور نماز کے ذریعے مدد طلب کرنے کا ذکر ہے۔');
  await page.getByLabel('مطالعے کی زبان',{exact:true}).selectOption('roman-ur');await page.getByRole('button',{name:'Yeh marhala samjhayein',exact:true}).click();await text('Is ayat mein sabr aur namaz ke zariye madad talab karne ka zikr hai.');
  await page.getByLabel('Parhnay ki zaban',{exact:true}).selectOption('en');
  await page.getByLabel('Your question or reflection',{exact:true}).fill('SIMULATE_UNAVAILABLE');await page.getByRole('button',{name:'Ask AI',exact:true}).click();await page.locator('.academy-error').filter({hasText:'The AI tutor is temporarily unavailable. Your progress is safe.'}).waitFor();
  await page.getByRole('button',{name:'Continue',exact:true}).click();await text('Progress saved.');await page.getByRole('button',{name:'Finish Lesson',exact:true}).click();await text('Lesson completed. Return whenever you want to review.');
  await page.reload();await text('Lesson completed. Return whenever you want to review.');
  await page.getByRole('button',{name:'Previous Step',exact:true}).click();await text('Progress saved.');
  // Validate dashboard/workspace in all learning languages, no WebGL and no overflow.
  for(const language of ['en','ur','roman-ur']){
    await visit('learn');await page.locator('.academy-settings select').first().selectOption(language);await page.waitForFunction(lang=>document.querySelector('.academy')?.lang===(lang==='roman-ur'?'ur-Latn':lang),language);
    for(const width of [320,360,390,430,768,1024,1440]){
      await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${language} dashboard ${width}`);assert.equal(await page.locator('canvas').count(),0);layouts++;
      if([390,1440].includes(width))await page.screenshot({path:`.openai/academy/dashboard-${language}-${width}.png`,fullPage:true,animations:'disabled'});
    }
    await visit('learn?lesson=academy:patience');await page.waitForFunction(()=>{const b=document.querySelector('.academy-actions .btn');return b&&!b.disabled;});await page.locator('.academy-settings select').first().selectOption(language);await page.waitForFunction(lang=>document.querySelector('.academy')?.lang===(lang==='roman-ur'?'ur-Latn':lang),language);await page.locator('.academy-source').first().waitFor();
    for(const width of [320,360,390,430,768,1024,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${language} workspace ${width}`);layouts++;if([390,1440].includes(width))await page.screenshot({path:`.openai/academy/workspace-${language}-${width}.png`,fullPage:true,animations:'disabled'});}
  }
  await page.locator('.academy-settings select').first().selectOption('en');await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Toggle dark mode',exact:true}).click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await page.screenshot({path:'.openai/academy/workspace-dark.png',fullPage:true,animations:'disabled'});
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('canvas').count(),0);
  await visit('learn?lesson=academy:badr');await page.getByRole('button',{name:'Teach this step',exact:true}).click();await page.locator('.academy-answer').waitFor();assert.match(await page.locator('.academy-answer').innerText(),/needs approved source/);
  assert.deepEqual(errors,[]);console.log(`PASS: academy real local SDK/Admin/Mongo integration, guest consent import, named account, teaching/follow-up, MCQ + true/false server scoring, EN/UR/Roman Urdu, outage, completion/restoration/previous, review gate, dark/reduced-motion; ${layouts} responsive layouts. Groq answers are controlled mocks, not live generation.`);
}catch(e){await page.screenshot({path:'.openai/academy/failure.png',fullPage:true});console.error(await page.locator('[role=alert]').allTextContents());throw e;}finally{await browser.close();}
