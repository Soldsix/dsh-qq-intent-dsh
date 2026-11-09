/** Fail evaluation commands when a retained probe reports execution or expectation failure. */
import assert from 'node:assert/strict'
/** Require explicit success flags without printing conversation or provider output. */
export function requireProbeSuccess(result, mode){
 if(mode==='full')assert.equal(result.passed,true,'Composed probe expectations failed; inspect the retained local report')
 else{assert.equal(result.executionPassed,true,'Model probe execution failed; inspect the retained local report');assert.equal(result.qualityPassed,true,'Model probe expectations failed; inspect the retained local report')}
}
