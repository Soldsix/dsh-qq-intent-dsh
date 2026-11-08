/** Fair, bounded admission and awaited shutdown for intent decisions. */
import type {IntentContextId,IntentRequest,TurnIntent} from 'dsh-qq-turn-control'
import type {Config} from './config.ts'

/** Decision-only provider; implementations own cancellation and cleanup. */
export interface IntentBackend{
 /** @param request - bounded conversation snapshot. @param signal - request lifetime. @returns one routing decision. */
 run(request:IntentRequest,signal:AbortSignal):Promise<'reply'|'ignore'|'default'>
 /** @returns completion of owned resources. */
 close():Promise<void>
}
interface Task{readonly request:IntentRequest;readonly signal:AbortSignal;readonly resolve:(value:'reply'|'ignore'|'default')=>void;readonly reject:(error:unknown)=>void;abort:()=>void}

/** A single conversation never has two classifier intervals running at once. */
export class IntentEngine implements TurnIntent{
 private readonly lifetime=new AbortController()
 private readonly queued:Task[]=[]
 private readonly active=new Set<IntentContextId>()
 private readonly running=new Set<Promise<void>>()
 private maintenance=false
 private stopping:Promise<void>|undefined
 /** @param config - resolved concurrency and size limits. @param backend - owned classifier runner. */
 constructor(private readonly config:Config,private readonly backend:IntentBackend){}
 /** @returns metadata only; no conversation or model text. */
 status():{queued:number;active:number;stopping:boolean}{return{queued:this.queued.length,active:this.running.size,stopping:this.lifetime.signal.aborted}}
 /** @param request - untrusted conversation snapshot. @param signal - caller lifetime. @returns decision, or default when capacity or input limits are reached. */
 classify(request:IntentRequest,signal:AbortSignal):Promise<'reply'|'ignore'|'default'>{
  if(signal.aborted)return Promise.reject(signal.reason)
  if(this.lifetime.signal.aborted)return Promise.reject(this.lifetime.signal.reason)
  if(this.maintenance)return Promise.resolve('default')
  if(JSON.stringify(request).length>this.config.maxInputChars||this.queued.length+this.running.size>=this.config.maxPending)return Promise.resolve('default')
  return new Promise((resolve,reject)=>{
   const task:Task={request,signal,resolve,reject,abort:()=>{}}
   task.abort=()=>{const index=this.queued.indexOf(task);if(index>=0){this.queued.splice(index,1);signal.removeEventListener('abort',task.abort);reject(signal.reason)}}
   signal.addEventListener('abort',task.abort,{once:true});this.queued.push(task)
   if(signal.aborted)task.abort();this.pump()
  })
 }
 /** @returns true only when idle; new decisions delegate until maintenance ends. */
 beginMaintenance():boolean{if(this.lifetime.signal.aborted||this.maintenance||this.queued.length||this.running.size)return false;this.maintenance=true;return true}
 /** End an acquired maintenance interval. */
 endMaintenance():void{this.maintenance=false}
 private pump():void{
  if(this.lifetime.signal.aborted)return
  while(this.running.size<this.config.maxConcurrent){
   const index=this.queued.findIndex(task=>!this.active.has(task.request.contextId));if(index<0)return
   const [task]=this.queued.splice(index,1);if(!task)return
   task.signal.removeEventListener('abort',task.abort);this.active.add(task.request.contextId)
   const signal=AbortSignal.any([task.signal,this.lifetime.signal])
   const finish=()=>{this.running.delete(operation);this.active.delete(task.request.contextId);this.pump()}
   const operation=Promise.resolve().then(()=>{signal.throwIfAborted();return this.backend.run(task.request,signal)})
    .then(value=>{finish();task.resolve(value)},error=>{finish();task.reject(error)})
   this.running.add(operation)
  }
 }
 /** @returns shared completion after cancelling queued and active operations and closing the backend. */
 close():Promise<void>{
  if(this.stopping)return this.stopping
  this.lifetime.abort()
  for(const task of this.queued.splice(0)){task.signal.removeEventListener('abort',task.abort);task.reject(this.lifetime.signal.reason)}
  this.stopping=(async()=>{await Promise.allSettled([...this.running]);await this.backend.close()})()
  return this.stopping
 }
}
