/** Profile-owned settings for model routing and bounded classification. */
import z from '@deepseek-ai/schemastery'
import type {Settings} from './fields.ts'
/** Complete schema-parsed configuration. */
export interface Config extends Settings{}
/** The classifier is opt-in and uses the Host route when no explicit pair is set. */
export const Config:z<Config>=z.object({
 enabled:z.boolean().default(false),provider:z.string().default(''),model:z.string().default(''),reasoningEffort:z.string().default(''),
 maxTokens:z.number().min(32).max(8192).step(1).default(128),maxConcurrent:z.number().min(1).max(32).step(1).default(2),
 maxPending:z.number().min(1).max(1024).step(1).default(32),maxSessions:z.number().min(1).max(256).step(1).default(16),
 maxTurnsPerSession:z.number().min(1).max(1000).step(1).default(50),maxInputChars:z.number().min(256).max(1048576).step(1).default(32768),maxSessionInputChars:z.number().min(256).max(8388608).step(1).default(65536),
})
/** @param config - parsed settings. @throws Error for incompatible route and capacity settings. */
export function validate(config:Config):void{
 if(Boolean(config.provider)!==Boolean(config.model))throw new Error('Provider and model must be configured together')
 for(const value of [config.provider,config.model,config.reasoningEffort])if(value!==value.trim()||/[\r\n\0]/.test(value))throw new Error('Invalid model route')
 if(config.maxPending<config.maxConcurrent||config.maxSessions<config.maxConcurrent||config.maxSessionInputChars<config.maxInputChars)throw new Error('Classifier capacities are inconsistent')
}
