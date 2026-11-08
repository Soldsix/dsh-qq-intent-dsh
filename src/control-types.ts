/** Owner-only classifier settings and metadata. */
import type {Settings} from './fields.ts'
import type {} from '@deepseek-ai/dsh-typert-protocol/types'
/** Saved configuration and observed runtime status. */
export interface Snapshot{readonly config:Settings;readonly revision:string;readonly active:boolean;readonly queued:number;readonly running:number;readonly entryDisabled:boolean;readonly refreshMs:number}
/** Revision-checked changes to documented fields. */
export interface SaveRequest{readonly revision:string;readonly patch:Partial<Settings>}
/** Sanitized owner-facing failure. */
export type Failure='forbidden'|'cancelled'|'invalid'|'conflict'|'unavailable'|'busy'|'apply-failed'
declare module '@deepseek-ai/dsh-typert-protocol/types'{interface RemoteErrorDetailsMap{
 /** Classifier settings error without source or model text. */
 'qq-intent/control':{readonly reason:Failure}
}}
