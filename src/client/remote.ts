/** Strict Client descriptors match the owner Host operations. */
import type {RemoteResult,TypertRemoteContribution} from '@deepseek-ai/dsh-typert-protocol/types'
import type {Snapshot,SaveRequest} from '../control-types.ts'
import {saveSchema,snapshotSchema} from '../control-codecs.ts'
declare module '@deepseek-ai/dsh-typert-protocol/types'{interface TypertRemoteNamespaceMap{
 /** Owner-only classifier settings. */
 qqIntentControl:{describe():Promise<RemoteResult<Snapshot>>;save(request:SaveRequest):Promise<RemoteResult<Snapshot>>}
}}
/** Native remote contribution for the classifier page. */
export const remote:TypertRemoteContribution={package:'dsh-qq-intent-dsh',descriptors:['describe','save'].map(method=>({id:`qqIntentControl/${method}`,service:'qqIntentControl',namespace:'qqIntentControl',method,invocation:{kind:'direct'},parameters:method==='describe'?[]:[{name:'request',wire:'request',source:'json',codec:{mode:'strict',typeSymbol:'dsh-qq-intent-dsh#saveRequest',create:()=>saveSchema}}],result:{mode:'strict',typeSymbol:'dsh-qq-intent-dsh#snapshot',create:()=>snapshotSchema}}))}
