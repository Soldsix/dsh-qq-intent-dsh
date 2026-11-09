/** Isolated synthetic native Session and rotation probe. */
import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
export const inject=['qqIntentDsh','qqTurnIntent','qqIntentControl','typertGateway','remoteAccess']
export function apply(ctx,config){const task=run(ctx,config);ctx.effect(()=>async()=>{await task})}
async function run(ctx,config){
 const checks=[],sessions=new Map(),logged=[]
 const off=ctx.on('session/event',(session,event)=>{
  if(event.type!=='user/message'||event.data.source.kind!=='qq-intent')return
  const id=event.data.source.contextId,seen=sessions.get(id)??[];seen.push(session.id);sessions.set(id,seen)
  logged.push(JSON.stringify(event.data))
 })
 const request=(contextId,text)=>({contextId,history:[],candidate:{speaker:'member-1',text,truncated:false,media:[],mentions:[],hasReply:false}})
 try{
  const signal=new AbortController().signal
  assert.equal(await ctx.qqTurnIntent.classify(request('synthetic-a','A1'),signal),'reply')
  assert.equal(await ctx.qqTurnIntent.classify(request('synthetic-a','A2'),signal),'reply')
  const quoted=request('synthetic-a','A3');quoted.history=[{speaker:'member-1',text:'A public question',truncated:false,media:[],mentions:[],hasReply:false,directedToBot:true},{speaker:'bot',text:'A public answer',truncated:false,media:[],mentions:[],hasReply:false,respondingTo:'member-1'}];quoted.candidate.replyTo={speaker:'bot',text:'A public answer',truncated:false,media:[]}
  assert.equal(await ctx.qqTurnIntent.classify(quoted,signal),'reply')
  assert.equal(await ctx.qqTurnIntent.classify(request('synthetic-b','B1'),signal),'reply')
  const a=sessions.get('synthetic-a'),b=sessions.get('synthetic-b')
  assert.equal(a.length,3);assert.equal(b.length,1);assert.equal(a[0],a[1]);assert.notEqual(a[1],a[2]);assert.notEqual(a[2],b[0])
  checks.push('logged-native-sessions-reuse-rotate-and-isolate-conversations')
  assert.ok(logged.some(value=>value.includes('replyTo')&&value.includes('respondingTo')&&value.includes('A public answer')))
  checks.push('quote-target-and-recipient-metadata-are-logged-in-native-user-events')
  assert.deepEqual(ctx.qqIntentDsh.status(),{queued:0,active:0,stopping:false})
  checks.push('bounded-engine-drained-after-completed-decisions')
  const peer={id:'intent-owner-fixture',ctx,principal:{kind:'owner'},signal:new AbortController().signal,interactions:'none',async dispose(){}}
  const invoke=(method,args={},caller=peer)=>ctx.typertGateway.invoke({namespace:'qqIntentControl',method,args,peer:caller,signal:peer.signal})
  const state=await invoke('describe');assert.equal(state.active,true)
  await assert.rejects(invoke('save',{request:{revision:state.revision,patch:{maxConcurrent:0}}}),error=>error.details?.reason==='invalid')
  ctx.effect(()=>ctx.remoteAccess.registerPolicy('intent-test-guest',{bindings:()=>[{resource:{kind:'global'},role:{name:'qa-intent',resource:'global',actions:['qqIntentControl/describe','qqIntentControl/save']}}]}))
  const guest={...peer,id:'intent-guest-fixture',principal:{kind:'intent-test-guest'}}
  await assert.rejects(invoke('describe',{},guest),error=>error.code==='qq-intent/control'&&error.details.reason==='forbidden')
  checks.push('owner-settings-reject-invalid-and-guest-requests')
  await writeFile(config.resultPath,JSON.stringify({passed:true,checks,modelRequests:4,realQqMessagesSent:0},null,2)+'\n')
 }catch(error){await writeFile(config.resultPath,JSON.stringify({passed:false,checks,error:{message:error.message,stack:error.stack}},null,2)+'\n')}
 finally{off()}
}
