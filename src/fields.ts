/** Browser-safe profile settings; credentials are never edited here. */
export interface Settings{enabled:boolean;provider:string;model:string;reasoningEffort:string;maxTokens:number;maxConcurrent:number;maxPending:number;maxSessions:number;maxTurnsPerSession:number;maxInputChars:number;maxSessionInputChars:number}
/** Editable fields and native representations. */
export const FIELDS={enabled:'boolean',provider:'string',model:'string',reasoningEffort:'string',maxTokens:'number',maxConcurrent:'number',maxPending:'number',maxSessions:'number',maxTurnsPerSession:'number',maxInputChars:'number',maxSessionInputChars:'number'} as const satisfies Record<keyof Settings,string>
