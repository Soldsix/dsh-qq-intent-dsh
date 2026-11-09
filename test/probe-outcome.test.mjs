/** Evaluation command failures must remain visible to callers. */
import assert from 'node:assert/strict'
import test from 'node:test'
import {spawnSync} from 'node:child_process'
const helper=new URL('../scripts/probe-outcome.mjs',import.meta.url).href
function command(result,mode){return spawnSync(process.execPath,['--input-type=module','-e',`import {requireProbeSuccess} from ${JSON.stringify(helper)};requireProbeSuccess(${JSON.stringify(result)},${JSON.stringify(mode)})`],{encoding:'utf8',windowsHide:true})}
test('evaluation processes fail when execution or semantic expectations fail',()=>{
 for(const [mode,result] of [['full',{passed:false}],['full',{}],['model',{executionPassed:false,qualityPassed:true}],['model',{executionPassed:true,qualityPassed:false}],['model',{executionPassed:true}]]){
  const child=command(result,mode);assert.notEqual(child.status,0);assert.match(child.stderr,/probe (?:execution|expectations) failed/)
 }
})
test('evaluation processes accept only the explicit successful probe summaries',()=>{
 for(const [mode,result] of [['full',{passed:true}],['model',{executionPassed:true,qualityPassed:true}]]){const child=command(result,mode);assert.equal(child.status,0,child.stderr)}
})
