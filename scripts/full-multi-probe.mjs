/** Three concurrent synthetic groups, each with fifteen distinct participants. */
import {writeFile} from 'node:fs/promises'
import {identifier} from 'dsh-im-kit'
export const inject=['im','qqChat','qqTurnPolicy','qqTurnIntent','intentFullTest']
export function apply(ctx,config){const task=run(ctx,config);ctx.effect(()=>async()=>{await task})}
async function run(ctx,config){
 const groups=[
  {id:'synthetic-a',code:'BLUE27',topic:'缓存加速可靠吗',challenge:'我觉得不对，缓存可能读取旧数据。',topic2:'雨天带伞有没有必要',follow:'但要是一直在室内呢？',topic3:'运动前要不要热身',follow3:'我不赞同，短时间运动也需要热身吧？'},
  {id:'synthetic-b',code:'GREEN48',topic:'电饭锅做饭是否方便',challenge:'我觉得不对，清洗锅具也挺费事。',topic2:'煮汤时要不要加盐',follow:'但如果是给小孩吃呢？',topic3:'蔬菜要不要焯水',follow3:'我不赞同，有的蔬菜焯水会损失口感吧？'},
  {id:'synthetic-c',code:'RED63',topic:'坐地铁出行是否可靠',challenge:'我觉得不对，地铁有时也会延误。',topic2:'骑车时要不要戴头盔',follow:'但如果只骑很短一段呢？',topic3:'出行要不要提前买票',follow3:'我不赞同，节假日还是提前买更稳吧？'},
 ]
 const results=[],counts={intent:0,chat:0};const off=ctx.on('session/event',(_session,event)=>{if(event.type==='user/message'){if(event.data.source.kind==='qq-intent')counts.intent++;if(event.data.source.kind==='qq-chat')counts.chat++}})
 const own=(group)=>ctx.intentFullTest.outputs.filter(item=>item.scope.peerId===group.id)
 const outText=item=>item.parts.filter(part=>part.type==='text').map(part=>part.text).join('')
 const scenario=group=>[
  {direct:true,text:`请记住验收口令 ${group.code}，只需简短确认。`,reply:true},
  {direct:false,text:'刚才的口令是什么？',reply:true,verifyCode:true},
  {direct:false,text:'小王，今晚一起吃饭吗？',mention:'member-14',reply:false},
  {direct:false,text:'我去喝点水。',reply:false},
  {direct:true,text:`你觉得${group.topic}？请简短回答。`,reply:true},
  {direct:false,text:group.challenge,reply:true},
  {direct:false,text:'小李，你明天几点出门？',mention:'member-13',reply:false},
  {direct:false,text:'今天天气真不错。',reply:false},
  {direct:true,text:`简单说说${group.topic2}。`,reply:true},
  {direct:false,text:group.follow,reply:true},
  {direct:false,text:'小陈，周末一起运动吗？',mention:'member-12',reply:false},
  {direct:false,text:'我先去开会了。',reply:false},
  {direct:true,text:`请简短回答：${group.topic3}？`,reply:true},
  {direct:false,text:group.follow3,reply:true},
  {direct:false,text:'小林，记得带上钥匙。',mention:'member-11',reply:false},
 ]
 async function groupRun(group){
  const items=scenario(group)
  for(let index=0;index<items.length;index++){
   const item=items[index],now=Date.now(),parts=[{type:'text',text:item.text}]
   if(item.mention)parts.push({type:'mention',userId:identifier('im.user',item.mention)})
   const message={scope:{account:ctx.intentFullTest.account,kind:'group',peerId:identifier('im.peer',group.id)},messageId:identifier('im.message',group.id+'-'+index),senderId:identifier('im.user','member-'+index),sentAt:now,receivedAt:now,directedToBot:item.direct,parts}
   const before=own(group).length,started=Date.now()
   try{
    const report=await ctx.im.publish(message,AbortSignal.timeout(90000)),after=own(group),delta=after.length-before
    const response=item.verifyCode&&delta===1?outText(after.at(-1)):''
    const codeMatches=!item.verifyCode||(response.includes(group.code)&&groups.filter(other=>other!==group).every(other=>!response.includes(other.code)))
    results.push({group:group.id,participant:index+1,expectedReply:item.reply,observedReplies:delta,codeMatches,passed:report.failed===0&&report.accepted===1&&delta===(item.reply?1:0)&&codeMatches,elapsedMs:Date.now()-started})
   }catch(error){results.push({group:group.id,participant:index+1,expectedReply:item.reply,observedReplies:own(group).length-before,codeMatches:false,passed:false,errorName:error.name,elapsedMs:Date.now()-started})}
  }
 }
 try{
  await Promise.all(groups.map(groupRun));results.sort((a,b)=>a.group.localeCompare(b.group)||a.participant-b.participant)
  await writeFile(config.resultPath,JSON.stringify({passed:results.every(item=>item.passed),checks:['three-concurrent-groups-fifteen-participants-each'],results,counts,capturedOutbound:ctx.intentFullTest.outputs.length,realQqMessagesSent:0},null,2)+'\n')
 }catch(error){await writeFile(config.resultPath,JSON.stringify({passed:false,checks:[],errorName:error.name,results,counts,realQqMessagesSent:0},null,2)+'\n')}
 finally{off()}
}
