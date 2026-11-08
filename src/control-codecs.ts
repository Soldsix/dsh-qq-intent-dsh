/** Strict JSON codecs shared by the owner Host and Web client. */
import * as z from 'zod/mini'
import type {Settings} from './fields.ts'
import type {SaveRequest,Snapshot} from './control-types.ts'
const config=z.strictObject({enabled:z.boolean(),provider:z.string(),model:z.string(),reasoningEffort:z.string(),maxTokens:z.int(),maxConcurrent:z.int(),maxPending:z.int(),maxSessions:z.int(),maxTurnsPerSession:z.int(),maxInputChars:z.int(),maxSessionInputChars:z.int()} satisfies {[Key in keyof Settings]:z.ZodMiniType<Settings[Key]>})
const revision=z.string().check(z.regex(/^[a-f0-9]{64}$/))
/** Declared editable settings with an expected revision. */
export const saveSchema:z.ZodMiniType<SaveRequest>=z.strictObject({revision,patch:z.pipe(z.partial(config),z.transform(value=>Object.fromEntries(Object.entries(value).filter(([,item])=>item!==undefined)) as Partial<Settings>))})
/** Sanitized runtime and settings snapshot. */
export const snapshotSchema:z.ZodMiniType<Snapshot>=z.strictObject({config,revision,active:z.boolean(),queued:z.int(),running:z.int(),entryDisabled:z.boolean(),refreshMs:z.int().check(z.minimum(250),z.maximum(60000))})
