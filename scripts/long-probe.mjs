/** Three scripted fifteen-participant conversations; only classification uses the real model. */
import {writeFile} from 'node:fs/promises'
export const inject=['qqIntentDsh','qqTurnIntent']
export function apply(ctx,config){const task=run(ctx,config);ctx.effect(()=>async()=>{await task})}
const turn=(speaker,text,extra={})=>({speaker,text,truncated:false,media:[],mentions:[],hasReply:false,...extra})
const groups=[
 {id:'synthetic-long-tech',topic:'缓存方案',answer:'缓存能减少重复读取，但要考虑失效。',items:[
  ['这个方案会不会有风险？',true],['小王，周末你去爬山吗？',false,'member-15'],['我先去开会。',false],['那它维护起来复杂吗？',true],['小李，你喜欢喝什么？',false,'member-14'],['今天真热。',false],['这个结果不对，可能会读到旧数据。',true],['阿明你把文件发我。',false,'member-13'],['我要吃午饭了。',false],['这个方案大概需要多少成本？',true],['小林，晚上一起运动？',false,'member-12'],['看起来不错。',false,null,true],['我不同意，还需要测试。',true],['今天堵车好久。',false],['老张明天带伞。',false,'member-11']
 ]},
 {id:'synthetic-long-food',topic:'做米饭',answer:'淘洗后按米水比例蒸煮，口感会比较稳定。',items:[
  ['那水放多了会怎么样？',true],['小王你吃饭了吗？',false,'member-15'],['我刚到家。',false],['这个方法需要多久？',true],['小林周末来玩。',false,'member-14'],['今天买了新锅。',false],['我觉得不对，我家锅需要更多水。',true],['阿明，明天几点上班？',false,'member-13'],['楼下好吵。',false],['这个做法适合糙米吗？',true],['小李，作业写完了吗？',false,'member-12'],['原来如此。',false,null,true],['那如果是电饭锅呢？',true],['大家晚上出门吗？',false],['我去洗碗了。',false]
 ]},
 {id:'synthetic-long-travel',topic:'出行路线',answer:'地铁通常更稳定，避开高峰能节省时间。',items:[
  ['这条路线花费多少？',true],['小林你明天有空吗？',false,'member-15'],['天好像要下雨。',false],['如果带行李会不会麻烦？',true],['老王，晚饭吃面吗？',false,'member-14'],['我正在等公交。',false],['我不赞同，地铁也会晚点。',true],['小陈借我一下笔。',false,'member-13'],['今晚早点睡。',false],['这个方案有无障碍电梯吗？',true],['小红，我们一起走。',false,'member-12'],['挺好的。',false,null,true],['那高峰期要多久？',true],['我去买水。',false],['大家晚安。',false]
 ]},
]
async function run(ctx,config){
 const results=[]
 try{
  for(const group of groups){const history=[]
   for(let index=0;index<group.items.length;index++){
    const [text,shouldReply,mention,unknownReply]=group.items[index]
    if(shouldReply){history.push(turn('member-0','大肥鱼，你怎么看'+group.topic+'？'));history.push(turn('bot',group.answer))}
    const candidate=turn('member-'+(index+1),text,{mentions:mention?[mention]:[],hasReply:Boolean(unknownReply)}),started=Date.now()
    const decision=await ctx.qqTurnIntent.classify({contextId:group.id,history:history.slice(-20),candidate},AbortSignal.timeout(45000))
    results.push({group:group.id,participant:index+1,decision,expected:shouldReply?'reply':'no-reply',passed:shouldReply?decision==='reply':decision!=='reply',elapsedMs:Date.now()-started})
    history.push(candidate);if(decision==='reply')history.push(turn('bot','我听到了，我们继续聊这个话题。'))
   }
  }
  await writeFile(config.resultPath,JSON.stringify({executionPassed:true,qualityPassed:results.every(item=>item.passed),results,realQqMessagesSent:0},null,2)+'\n')
 }catch(error){await writeFile(config.resultPath,JSON.stringify({executionPassed:false,errorName:error.name,completed:results.length,results,realQqMessagesSent:0},null,2)+'\n')}
}
