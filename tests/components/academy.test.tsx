import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { mockProviders, renderScreen } from '../helpers';
import Account from '../../app/screens/Account';
import Academy from '../../app/features/academy/Academy';
import { catalog, decodeExplanation, readGuestAcademy, saveGuestAcademy, type Session } from '../../app/features/academy/client';
const state=vi.hoisted(()=>({signedIn:false,admin:false}));
const identity=vi.hoisted(()=>({uid:'test-learner',providers:['google.com'],emailVerified:true,email:'controlled@example.test',displayName:'Controlled Learner'}));
vi.mock('../../app/context/AuthContext',()=>({authError:(e:unknown)=>e instanceof Error?e.message:'Request failed.',useAuth:()=>({user:state.signedIn?identity:null,profile:state.signedIn?{role:state.admin?'admin':'user',name:'Controlled Learner'}:null,loading:false,syncing:false})}));
const request=vi.hoisted(()=>vi.fn());
vi.mock('../../app/services/account/backendClient',()=>({backendRequest:(...args:unknown[])=>request(...args)}));
let row:Session;
const answer={generated:true,explanation:'Seek help through patience and prayer.',keyPoints:['Read the passage.'],uncertaintyNotes:[],sourceReferences:[{id:'quran:2:153:en',reference:'Quran 2:153',kind:'quran',excerpt:'Controlled evidence.',href:'https://quranenc.com/en/home/api'}],knowledgeCheck:[]};
beforeEach(()=>{
  state.signedIn=false;state.admin=false;localStorage.clear();window.location.hash='#learn';
  row={id:'123456789012345678901234',lessonId:'academy:patience',currentStep:0,version:0,status:'in_progress',note:'',selectedLanguage:'en',selectedDifficulty:'beginner'};
  mockProviders();request.mockReset();request.mockImplementation(async(path:string,options:{body?:Record<string,unknown>}={})=>{
    if(path.startsWith('/api/bookmarks'))return{data:[]};
    if(path.startsWith('/api/quiz-attempts'))return{data:[]};
    if(path.startsWith('/api/admin/sources'))return{data:options.body?{id:'test-source',reviewStatus:'pending'}:[]};
    if(path==='/api/academy/tracks')return{data:catalog};
    if(path.startsWith('/api/academy/lessons/'))return{data:{steps:[{available:true},{available:true},{available:true}]}};
    if(path==='/api/academy/sessions')return{data:options.body?row:[row]};
    if(path.endsWith('/explain'))return{data:options.body?.action==='quiz'?{...answer,knowledgeCheck:[{id:'quiz-1',question:'What helps?',options:['Prayer','Wealth','Travel','Silence']}]}:answer};
    if(path.endsWith('/quiz'))return{data:{score:1,total:1,explanation:'Read the verse in context.'}};
    if(options.body?.action){row={...row,currentStep:Math.max(0,Math.min(2,row.currentStep+Number(options.body.action==='next')-Number(options.body.action==='previous'))),version:row.version+1,note:String(options.body.note||''),selectedLanguage:options.body.language as Session['selectedLanguage']};}
    return{data:row};
  });
});
it('renders seven tracks, filters categories and keeps unsupported biographies visibly pending',async()=>{
  const user=userEvent.setup();renderScreen(<Academy/>);await screen.findByRole('heading',{name:/Explore the beauty/});
  expect(document.querySelectorAll('.academy-track')).toHaveLength(7);
  await user.click(screen.getByRole('button',{name:'Stories of the Sahaba'}));
  expect(document.querySelectorAll('.academy-track')).toHaveLength(1);
  expect(screen.getByText('Abu Bakr (RA): a biography to review')).toBeInTheDocument();
  expect(screen.getAllByText('Awaiting historical source review').length).toBeGreaterThan(0);
  expect(document.querySelector('canvas')).toBeNull();
});
it('guest navigation, notes, language and progress survive reload without an AI success',async()=>{
  window.location.hash='#learn?lesson=academy:patience';const user=userEvent.setup();const view=renderScreen(<Academy/>);
  await screen.findByText(/O you who have believed/);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Continue'})).toBeEnabled());
  expect(screen.getByRole('button',{name:'Teach this step'})).toBeDisabled();
  await user.type(screen.getByLabelText('Your private study notes'),'My reflection');
  await user.selectOptions(screen.getByLabelText('Learning language'),'roman-ur');
  await user.click(screen.getByRole('button',{name:'Jari rakhein'}));
  await waitFor(()=>expect(readGuestAcademy()['academy:patience'].currentStep).toBe(1));
  expect(readGuestAcademy()['academy:patience'].note).toBe('My reflection');view.unmount();renderScreen(<Academy/>);
  await waitFor(()=>expect(screen.getByLabelText('Parhnay ki zaban')).toHaveValue('roman-ur'));
  expect(screen.getByLabelText('Aap ke zaati mutalaay ke notes')).toHaveValue('My reflection');
});
it('authenticated tutor actions send step context and formative questions, then score on the server',async()=>{
  state.signedIn=true;window.location.hash='#learn?lesson=academy:patience';const user=userEvent.setup();renderScreen(<Academy/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Teach this step'})).toBeEnabled());
  await user.click(screen.getByRole('button',{name:'Teach this step'}));await screen.findByText(answer.explanation);
  await user.type(screen.getByLabelText('Your question or reflection'),'How are they connected?');
  await user.click(screen.getByRole('button',{name:'Ask AI'}));await screen.findByText('How are they connected?');
  const calls=request.mock.calls.filter(([p])=>String(p).endsWith('/explain'));expect(calls.at(-1)?.[1].body.action).toBe('question');
  expect(calls.at(-1)?.[1].body).not.toHaveProperty('note');
  await user.click(screen.getByRole('button',{name:'Take Quiz'}));await screen.findByText('What helps?');
  await user.click(screen.getByLabelText('Prayer'));await user.click(screen.getByRole('button',{name:'Check answer'}));await screen.findByText('1 / 1');
  expect(request.mock.calls.find(([p])=>String(p).endsWith('/quiz'))?.[1].body).not.toHaveProperty('score');
});
it('invalid response citations and provider errors are visible instead of fabricated success',async()=>{
  expect(()=>decodeExplanation({...answer,sourceReferences:[{...answer.sourceReferences[0],href:'javascript:alert(1)'}]})).toThrow();
  expect(()=>decodeExplanation({...answer,sourceReferences:[]})).toThrow();
  state.signedIn=true;window.location.hash='#learn?lesson=academy:patience';renderScreen(<Academy/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Teach this step'})).toBeEnabled());
  request.mockImplementation(async(path:string)=>{if(path.endsWith('/explain'))throw Error('The AI tutor is temporarily unavailable.');return{data:row};});
  await act(async()=>screen.getByRole('button',{name:'Teach this step'}).click());await screen.findByRole('alert');
  expect(screen.queryByText(answer.explanation)).not.toBeInTheDocument();
});
it('malformed stored guest state is discarded and valid state stays isolated from legacy keys',()=>{
  localStorage.setItem('deen-academy-guest-v1',JSON.stringify({'academy:patience':{currentStep:500},evil:{}}));expect(readGuestAcademy()).toEqual({});
  localStorage.setItem('deen-lessons','["0"]');saveGuestAcademy(row);expect(readGuestAcademy()['academy:patience'].lessonId).toBe(row.lessonId);expect(localStorage.getItem('deen-lessons')).toBe('["0"]');
});

it('reads approved historical sources supplied by the API without a rebuilt frontend catalog',async()=>{
  window.location.hash='#learn?lesson=academy:abu-bakr';
  const original=request.getMockImplementation();request.mockImplementation(async(path:string,options?:unknown)=>{
    if(path.startsWith('/api/academy/lessons/'))return{data:{steps:[{available:true,sourceReferences:[{id:'seerah:test:1:en',kind:'seerah',title:'Controlled review fixture',reference:'Test section',excerpt:'No historical claim: this is a review workflow fixture.',href:'https://github.com/OpenITI/0225AH'}]},{available:false},{available:false}]}};
    return original?.(path,options);
  });
  renderScreen(<Academy/>);await screen.findByText('No historical claim: this is a review workflow fixture.');
  expect(screen.getByRole('heading',{name:'Controlled review fixture'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Teach this step'})).toBeDisabled();
});

it('admin source proposal stays pending, validates JSON and displays scope metadata',async()=>{
  state.signedIn=true;state.admin=true;const user=userEvent.setup();renderScreen(<Account/>);
  await user.click(screen.getByText('Propose or update a source passage'));
  await user.type(screen.getByLabelText('Source proposal JSON'),'invalid JSON');
  await user.click(screen.getByRole('button',{name:'Save source for review'}));await screen.findByText('Enter a valid source JSON object.');
  expect(request.mock.calls.some(([p])=>p==='/api/admin/sources')).toBe(false);
  await user.clear(screen.getByLabelText('Source proposal JSON'));
  await user.paste(JSON.stringify({sourceId:'seerah:controlled:1:en',academyScopes:[{lessonId:'academy:abu-bakr',stepId:'0'}]}));
  await user.click(screen.getByRole('button',{name:'Save source for review'}));await screen.findByText('Source proposal saved. New or changed content requires review before teaching.');
  const body=request.mock.calls.find(([p,options])=>p==='/api/admin/sources'&&options.method==='POST')?.[1].body;
  expect(body.academyScopes[0].lessonId).toBe('academy:abu-bakr');expect(body).not.toHaveProperty('reviewStatus');
});
it('ordinary account holders do not see source administration',()=>{
  state.signedIn=true;renderScreen(<Account/>);expect(screen.queryByText('Propose or update a source passage')).not.toBeInTheDocument();
});
