import {test} from 'node:test'
import assert from 'node:assert/strict'
import {setTimeout as delay} from 'node:timers/promises'
import {Config,validate} from '../dist/config.js'
import {IntentEngine} from '../dist/engine.js'
import {parseDecision} from '../dist/runner.js'
import {apply} from '../dist/index.js'

const request=(contextId,text='x')=>({contextId,history:[],candidate:{speaker:'member-1',text,truncated:false,media:[],mentions:[],hasReply:false}})
async function until(predicate){for(let i=0;i<500;i++){if(predicate())return;await delay(2)}throw Error('Fixture did not reach expected state')}
test('same context is serialized while another context advances independently',async t=>{
 let release;const gate=new Promise(resolve=>{release=resolve}),calls=[]
 const backend={async run(req){calls.push(req.candidate.text);if(req.candidate.text==='a1')await gate;return'reply'},async close(){}}
 const engine=new IntentEngine(Config({maxConcurrent:2}),backend);t.after(async()=>{release();await engine.close()})
 const a1=engine.classify(request('a','a1'),new AbortController().signal);await until(()=>calls.length===1)
 const a2=engine.classify(request('a','a2'),new AbortController().signal),b=engine.classify(request('b','b'),new AbortController().signal)
 assert.equal(await b,'reply');assert.deepEqual(calls,['a1','b']);release();assert.equal(await a1,'reply');assert.equal(await a2,'reply');assert.deepEqual(calls,['a1','b','a2']);assert.deepEqual(engine.status(),{queued:0,active:0,stopping:false})
})
test('queued cancellation, bounded input and capacity never invoke the backend',async t=>{
 let release;const gate=new Promise(resolve=>{release=resolve}),calls=[]
 const backend={async run(req){calls.push(req.candidate.text);await gate;return'ignore'},async close(){}}
 const engine=new IntentEngine(Config({maxConcurrent:1,maxPending:2,maxInputChars:256}),backend);t.after(async()=>{release();await engine.close()})
 const first=engine.classify(request('a','first'),new AbortController().signal);await until(()=>calls.length===1)
 const cancel=new AbortController(),queued=engine.classify(request('a','queued'),cancel.signal)
 assert.equal(await engine.classify(request('b','capacity'),new AbortController().signal),'default')
 cancel.abort();await assert.rejects(queued,error=>error.name==='AbortError')
 assert.equal(await engine.classify(request('b','x'.repeat(500)),new AbortController().signal),'default')
 release();assert.equal(await first,'ignore');assert.deepEqual(calls,['first'])
})
test('shutdown aborts active work, rejects queued work and joins backend cleanup',async()=>{
 let closed=false,entered=false
 const backend={async run(_request,signal){entered=true;await new Promise((resolve,reject)=>{if(signal.aborted)reject(signal.reason);else signal.addEventListener('abort',()=>reject(signal.reason),{once:true})});return'reply'},async close(){closed=true}}
 const engine=new IntentEngine(Config({maxConcurrent:1}),backend)
 const active=engine.classify(request('a'),new AbortController().signal);await until(()=>entered)
 const queued=engine.classify(request('b'),new AbortController().signal),activeRejected=assert.rejects(active,error=>error.name==='AbortError'),queuedRejected=assert.rejects(queued,error=>error.name==='AbortError')
 await engine.close();await Promise.all([activeRejected,queuedRejected]);assert.equal(closed,true);assert.deepEqual(engine.status(),{queued:0,active:0,stopping:true});await engine.close()
})
test('cancelling one active context does not cancel another context or its next turn',async t=>{
 let started=false
 const backend={async run(req,signal){if(req.candidate.text==='cancel-me'){started=true;await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))}return'reply'},async close(){}}
 const engine=new IntentEngine(Config({maxConcurrent:2}),backend);t.after(()=>engine.close())
 const controller=new AbortController(),first=engine.classify(request('a','cancel-me'),controller.signal),rejected=assert.rejects(first,error=>error.name==='AbortError')
 await until(()=>started);assert.equal(await engine.classify(request('b','other'),new AbortController().signal),'reply')
 controller.abort();await rejected;assert.equal(await engine.classify(request('a','next'),new AbortController().signal),'reply')
})
test('maintenance starts only while idle and prevents new model calls until released',async t=>{
 let release,calls=0;const gate=new Promise(resolve=>{release=resolve})
 const engine=new IntentEngine(Config({}),{async run(){calls++;await gate;return'reply'},async close(){}});t.after(async()=>{release();await engine.close()})
 const active=engine.classify(request('a'),new AbortController().signal);await until(()=>calls===1);assert.equal(engine.beginMaintenance(),false)
 release();assert.equal(await active,'reply');assert.equal(engine.beginMaintenance(),true);assert.equal(engine.beginMaintenance(),false)
 assert.equal(await engine.classify(request('b'),new AbortController().signal),'default');assert.equal(calls,1)
 engine.endMaintenance();assert.equal(await engine.classify(request('b'),new AbortController().signal),'reply');assert.equal(calls,2)
})
test('only a strict one-field JSON decision can control routing',()=>{
 for(const [value,expected] of [['{"decision":"reply"}','reply'],['{"decision":"ignore"}','ignore'],['{"decision":"default"}','default'],['{"decision":"reply","extra":true}','default'],['```json\n{"decision":"reply"}\n```','default'],['{"decision":"REPLY"}','default'],['not-json','default'],['x'.repeat(3000),'default']])assert.equal(parseDecision(value),expected)
})
test('configuration rejects incomplete model routes and unsafe capacity relationships; disabled mode has no effects',async()=>{
 assert.throws(()=>validate(Config({provider:'p'})),/configured together/)
 assert.throws(()=>validate(Config({maxConcurrent:3,maxSessions:2})),/capacities/)
 let effects=0;await apply({effect(){effects++}},Config({enabled:false}));assert.equal(effects,0)
 await assert.rejects(apply({get(){return{}},effect(){effects++}},Config({enabled:true})),/Another intent classifier/);assert.equal(effects,0)
})
