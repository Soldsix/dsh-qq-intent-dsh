/** Native opt-in DSH intent provider for independent QQ routing. */
import type {Context} from '@deepseek-ai/cordis'
import {mkdir} from 'node:fs/promises'
import {isAbsolute,join} from 'node:path'
import type {} from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from 'dsh-qq-turn-control'
import {Config,validate,type Config as Settings} from './config.ts'
import {IntentEngine} from './engine.ts'
import {NativeRunner} from './runner.ts'
export {Config,validate}
/** Native bundle name. */
export const name='qq-intent-dsh'
/** The provider depends on the DSH-owned agent and persistent Session services. */
export const inject=['profileContext','agents','sessions','sessionPersistence','tools','systemPrompt']
/** Metadata-only status; no source text or model output. */
export interface IntentStatus{status():ReturnType<IntentEngine['status']>;ownsProvider():boolean;beginMaintenance():boolean;endMaintenance():void}
declare module '@deepseek-ai/cordis'{interface Context{readonly qqIntentDsh:IntentStatus}}
/** @param ctx - profile services. @param config - parsed settings. @returns completion of installation. */
export async function apply(ctx:Context,config:Settings):Promise<void>{
 validate(config);if(!config.enabled)return
 if(ctx.get('qqTurnIntent'))throw new Error('Another intent classifier is already installed')
 if(!isAbsolute(ctx.profileContext.dir))throw new Error('Classifier profile directory must be absolute')
 const cwd=join(ctx.profileContext.dir,'data','qq-intent-dsh');await mkdir(cwd,{recursive:true,mode:0o700})
 const engine=new IntentEngine(config,new NativeRunner(ctx,config,cwd))
 ctx.effect(()=>()=>engine.close())
 ctx.effect(()=>ctx.provide('qqTurnIntent',engine))
 ctx.effect(()=>ctx.provide('qqIntentDsh',{status:()=>engine.status(),ownsProvider:()=>ctx.get('qqTurnIntent')===engine,beginMaintenance:()=>engine.beginMaintenance(),endMaintenance:()=>engine.endMaintenance()}))
}
