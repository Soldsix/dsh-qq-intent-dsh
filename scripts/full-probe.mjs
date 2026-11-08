/** Real DSH model with synthetic participants and locally captured outbound messages. */
import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {identifier} from 'dsh-im-kit'
export const inject=['im','qqChat','qqTurnPolicy','qqTurnIntent','intentFullTest']
export function apply(ctx,config){const task=run(ctx,config);ctx.effect(()=>async()=>{await task})}
async function run(ctx,config){
 const checks=[],counts={intent:0,chat:0}
 const off=ctx.on('session/event',(_session,event)=>{if(event.type==='user/message'){if(event.data.source.kind==='qq-intent')counts.intent++;if(event.data.source.kind==='qq-chat')counts.chat++}})
 const source=(id,sender,directed,text,parts=[])=>{const now=Date.now();return{scope:{account:ctx.intentFullTest.account,kind:'group',peerId:identifier('im.peer','synthetic-group')},messageId:identifier('im.message',id),senderId:identifier('im.user',sender),sentAt:now,receivedAt:now,directedToBot:directed,parts:[{type:'text',text},...parts]}}
 const send=async message=>{const report=await ctx.im.publish(message,AbortSignal.timeout(90000));assert.equal(report.failed,0);assert.equal(report.accepted,1)}
 try{
  await send(source('a','alice',true,'你觉得缓存是好主意吗？简短说一句。'));assert.equal(ctx.intentFullTest.outputs.length,1);checks.push('explicit-question-reaches-chat-model')
  await send(source('b','bob',false,'我觉得不对，缓存还可能导致旧数据。'));assert.equal(ctx.intentFullTest.outputs.length,2);checks.push('second-member-unquoted-disagreement-reaches-chat')
  await send(source('c','carol',false,'小王，今晚吃什么？',[{type:'mention',userId:identifier('im.user','dave')}]))
  assert.equal(ctx.intentFullTest.outputs.length,2);assert.equal(counts.chat,2);assert.equal(counts.intent,2);checks.push('human-to-human-message-does-not-trigger-chat')
  await writeFile(config.resultPath,JSON.stringify({passed:true,checks,counts,capturedOutbound:ctx.intentFullTest.outputs.length,realQqMessagesSent:0},null,2)+'\n')
 }catch(error){await writeFile(config.resultPath,JSON.stringify({passed:false,checks,counts,errorName:error.name,capturedOutbound:ctx.intentFullTest.outputs.length,realQqMessagesSent:0},null,2)+'\n')}
 finally{off()}
}
