import test from 'node:test'
import assert from 'node:assert/strict'
import {Context} from '@deepseek-ai/cordis'
import Control,{Config as ControlConfig} from '../dist/control.js'
import {Config} from '../dist/config.js'
import {saveSchema,snapshotSchema} from '../dist/control-codecs.js'

async function mount(t,{service,editFailure=false}={}){
 const ctx=new Context(),writes=[]
 const entry={options:{id:'qq-intent-dsh',name:'dsh-qq-intent-dsh',config:{}},disabled:false,fiber:{effectiveConfig:Config({}),state:2}}
 const editor={entries:()=>[entry],async edit(target,change){assert.equal(target,entry);const next=change(entry.options.config);if(editFailure)throw Error('synthetic failure');writes.push(next);entry.options.config=next;entry.fiber.effectiveConfig=Config(next)}}
 const fixture=ctx.plugin({name:'intent-control-fixture',apply(ctx){ctx.effect(()=>ctx.provide('configEditor',editor));if(service)ctx.effect(()=>ctx.provide('qqIntentDsh',service))}});await fixture.await()
 const fiber=ctx.plugin(Control,ControlConfig({}));await fiber.await();t.after(async()=>{await fiber.dispose();await fixture.dispose()})
 return{control:ctx.qqIntentControl,entry,writes}
}
test('owner settings validate changes and retain revisions without exposing extra fields',async t=>{
 const {control,writes}=await mount(t),initial=await control.describe()
 assert.equal(snapshotSchema.safeParse(initial).success,true);assert.equal(initial.active,false)
 const saved=await control.save({revision:initial.revision,patch:{provider:'synthetic',model:'fixture',maxConcurrent:3}})
 assert.equal(saved.config.provider,'synthetic');assert.equal(writes.length,1)
 await assert.rejects(control.save({revision:initial.revision,patch:{enabled:true}}),error=>error.details?.reason==='conflict')
 await assert.rejects(control.save({revision:saved.revision,patch:{model:''}}),error=>error.details?.reason==='invalid')
 await assert.rejects(async()=>control.save({revision:saved.revision,patch:{unknown:'synthetic'}}),error=>error.details?.reason==='invalid')
 assert.equal(writes.length,1);assert.equal(saveSchema.safeParse({revision:saved.revision,patch:{secret:'x'}}).success,false)
})
test('busy classifier refuses reconfiguration, and an editor failure releases maintenance',async t=>{
 let busy=true,ended=0
 const service={status:()=>({queued:0,active:busy?1:0,stopping:false}),ownsProvider:()=>true,beginMaintenance:()=>!busy,endMaintenance:()=>{ended++}}
 const {control,writes}=await mount(t,{service,editFailure:true}),initial=await control.describe()
 await assert.rejects(control.save({revision:initial.revision,patch:{maxTokens:256}}),error=>error.details?.reason==='busy');assert.equal(ended,0)
 busy=false;await assert.rejects(control.save({revision:initial.revision,patch:{maxTokens:256}}),error=>error.details?.reason==='apply-failed')
 assert.equal(ended,1);assert.equal(writes.length,0)
})
