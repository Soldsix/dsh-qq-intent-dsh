import {test} from 'node:test'
import assert from 'node:assert/strict'
import {Config} from '../dist/config.js'
import {NativeRunner} from '../dist/runner.js'

const request=(contextId,text)=>({contextId,history:[],candidate:{speaker:'member-1',text,truncated:false,media:[],mentions:[],hasReply:false}})
function fixture({toolCall=false,external=false}={}){
 const listeners=new Map(),created=[],disposed=[],setup=[],inputs=[]
 const emit=(name,...args)=>{for(const callback of listeners.get(name)??[])callback(...args)}
 const ctx={
  on(name,callback){const group=listeners.get(name)??new Set();group.add(callback);listeners.set(name,group);return()=>group.delete(callback)},
  tools:{definitions:()=>[{name:'synthetic-tool'}]},sessions:{async flush(){return true}},
  agents:{async create(options){
   const scoped={systemPrompt:{section(value){setup.push({section:value})},suppressRuntimeContext(){setup.push({suppressed:true})}},tools:{restrict(value){setup.push({restrict:value})},guard(value){setup.push({guard:value})}}}
   await options.setup(scoped)
   const session={id:options.sessionId},inbox={nextTurn:[],nextStep:[]};let pending=Promise.resolve()
   const agent={session,inbox,status:'idle',cancel(){},whenIdle(){return pending},followup(input){
    inputs.push(input);agent.status='busy';pending=Promise.resolve().then(()=>{
     if(external)emit('agent/inbox/inserted',{agent:{id:session.id},message:{id:'other-message'}})
     emit('session/event',session,{type:'user/message',data:input})
     if(toolCall)emit('session/event',session,{type:'assistant/message',data:{interrupted:false,message:{content:[{type:'tool-call'}]}}})
     emit('session/event',session,{type:'assistant/message',data:{interrupted:false,message:{content:[{type:'text',text:'{"decision":"reply"}'}]}}})
     emit('session/event',session,{type:'turn/end',data:{reason:{kind:'completed'}}});agent.status='idle'
    })
   }}
   created.push(options.sessionId);return{agent,async dispose(){disposed.push(options.sessionId)}}
  }},
 }
 return{ctx,created,disposed,setup,inputs}
}
test('native runner reuses, rotates and isolates scoped Sessions while denying tools',async()=>{
 const f=fixture(),runner=new NativeRunner(f.ctx,Config({maxTurnsPerSession:2}),'.'),signal=new AbortController().signal
 assert.equal(await runner.run(request('a','first'),signal),'reply');assert.equal(await runner.run(request('a','second'),signal),'reply');assert.equal(f.created.length,1)
 assert.equal(await runner.run(request('a','third'),signal),'reply');assert.equal(f.created.length,2);assert.equal(f.disposed.length,1)
 assert.equal(await runner.run(request('b','other'),signal),'reply');assert.equal(f.created.length,3)
 assert.ok(f.setup.some(value=>value.section?.complete===true));assert.ok(f.setup.some(value=>value.suppressed));assert.deepEqual(f.setup.find(value=>value.restrict).restrict.deny,['synthetic-tool'])
 assert.equal(f.setup.find(value=>value.guard).guard(),'INTENT_TOOL_NOT_ALLOWED');await runner.close();assert.equal(f.disposed.length,3)
})
test('an attempted tool call invalidates the decision even if final text is valid',async()=>{
 const f=fixture({toolCall:true}),runner=new NativeRunner(f.ctx,Config({}),'.')
 assert.equal(await runner.run(request('a','text'),new AbortController().signal),'default');await runner.close()
})
test('unexpected additional input invalidates the interval and retires its Session',async()=>{
 const f=fixture({external:true}),runner=new NativeRunner(f.ctx,Config({}),'.')
 await assert.rejects(runner.run(request('a','text'),new AbortController().signal),/interval incomplete/)
 assert.equal(f.disposed.length,1);await runner.close()
})
test('input budget rotates a Session before its configured turn count',async()=>{
 const f=fixture(),runner=new NativeRunner(f.ctx,Config({maxInputChars:256,maxSessionInputChars:256,maxTurnsPerSession:10}),'.'),signal=new AbortController().signal
 assert.equal(await runner.run(request('a','x'.repeat(100)),signal),'reply');assert.equal(await runner.run(request('a','x'.repeat(100)),signal),'reply')
 assert.equal(f.created.length,2);assert.equal(f.disposed.length,1);await runner.close()
})

test('recipient and quote metadata remain in the logged classifier payload and public instruction',async()=>{
 const f=fixture(),runner=new NativeRunner(f.ctx,Config({}),'.'),input=request('context','I disagree')
 input.history=[{speaker:'member-1',text:'A question',truncated:false,media:[],mentions:[],hasReply:false,directedToBot:true},{speaker:'bot',text:'A public answer',truncated:false,media:[],mentions:[],hasReply:false,respondingTo:'member-1'}]
 input.candidate.replyTo={speaker:'bot',text:'A public answer',truncated:false,media:[]}
 await runner.run(input,new AbortController().signal)
 assert.equal(f.inputs.length,1);const logged=JSON.stringify(f.inputs[0]);assert.ok(logged.includes('respondingTo'));assert.ok(logged.includes('replyTo'));assert.ok(logged.includes('A public answer'));const instruction=f.setup.find(item=>item.section)?.section.text;assert.match(instruction,/replyTo target/);assert.match(instruction,/respondingTo alias/);assert.match(instruction,/intervening unrelated chatter/)
 await runner.close()
})
