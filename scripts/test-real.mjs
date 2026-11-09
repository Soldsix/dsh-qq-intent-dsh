/** Drive synthetic intent scenarios through a managed credential store and isolated native profile. */
import assert from 'node:assert/strict'
import {requireProbeSuccess} from './probe-outcome.mjs'
import {configureTestNetwork} from './network-env.mjs'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {createHash} from 'node:crypto'
import {mkdtemp,mkdir,readFile,writeFile,realpath} from 'node:fs/promises'
import {join,relative,isAbsolute} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {setTimeout as delay} from 'node:timers/promises'
const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv
const argument=name=>{const index=args.indexOf(name);assert.ok(index>=0&&args[index+1],'Required '+name);return args[index+1]}
const credential=await realpath(argument('--credential-store')),native=await realpath(argument('--native-run')),nativeRoot=join(root,'.test-artifacts','native'),owned=relative(nativeRoot,native)
assert.ok(!owned.startsWith('..')&&!isAbsolute(owned),'Native profile must belong to this repository')
const before=createHash('sha256').update(await readFile(credential)).digest(),runs=join(root,'.test-artifacts','real-api');await mkdir(runs,{recursive:true});const area=await mkdtemp(join(runs,'run-'))
const probeIndex=args.indexOf('--long'),probe=probeIndex<0?'./real-probe.mjs':'./long-probe.mjs'
const home=join(native,'home'),profile='intent-native',profileRoot=join(home,'profiles',profile),fixture=pathToFileURL(fileURLToPath(new URL(probe,import.meta.url))).href
const overlay=[{id:'credentials',config:{path:credential,watch:false}},{id:'intent-probe',disabled:true},{id:'qq-intent-dsh',config:{enabled:true,provider:'deepseek-official',model:'deepseek-flash',reasoningEffort:'off',maxTurnsPerSession:20}},{insert:[{id:'intent-real-probe',name:fixture,config:{resultPath:join(area,'result.json')}}]}]
const patch=join(area,'overlay.yml');await writeFile(patch,JSON.stringify(overlay,null,2)+'\n')
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/KEY|SECRET|TOKEN|PASSWORD|DEEPSEEK_BASE_URL|^NPM_CONFIG_CACHE$/i.test(key)))
env.NPM_CONFIG_CACHE=join(root,'.npm-cache')
configureTestNetwork(env,process.allowedNodeEnvironmentFlags.has('--use-env-proxy'))
await mkdir(join(area,'temp'),{recursive:true});Object.assign(env,{DSH_HOME:home,TEMP:join(area,'temp'),TMP:join(area,'temp'),DSH_PRIMARY_RUNTIME:'',DSH_SYSTEM_PROMPT:'Synthetic local classification test; no private persona or skills.'})
const child=spawn(process.execPath,[join(profileRoot,'node_modules','@deepseek-ai','dsh','lib','bin.js'),'--profile',profile,'--patch',patch],{cwd:area,env,windowsHide:true,stdio:['pipe','pipe','pipe']})
let stdoutBytes=0,stderrBytes=0,exitCode,result;child.stdout.on('data',value=>{stdoutBytes+=value.length});child.stderr.on('data',value=>{stderrBytes+=value.length})
const exit=once(child,'close').then(([code,signal])=>{exitCode=code;return{code,signal}})
try{
 const deadline=Date.now()+240000
 while(Date.now()<deadline){try{result=JSON.parse(await readFile(join(area,'result.json'),'utf8'));break}catch(error){if(error.code!=='ENOENT')throw error}assert.equal(exitCode,undefined,'Isolated DSH exited before real probe');await delay(50)}
 assert.ok(result,'Real probe timed out');child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'shutdown',params:{}})+'\n')
 const stopped=await Promise.race([exit,delay(15000,undefined,{ref:false}).then(()=>{throw Error('Real probe shutdown timed out')})]);assert.equal(stopped.code,0)
 requireProbeSuccess(result,'model')
 console.log(JSON.stringify({area,executionPassed:result.executionPassed,qualityPassed:result.qualityPassed??false,completed:result.results.length,passed:result.results.filter(item=>item.passed).length,realQqMessagesSent:0}))
}finally{
 if(exitCode===undefined){child.stdin.end();const fallback=setTimeout(()=>child.kill(),5000);await exit;clearTimeout(fallback)}
 const after=createHash('sha256').update(await readFile(credential)).digest();const unchanged=before.equals(after)
 await writeFile(join(area,'process.json'),JSON.stringify({exitCode,stdoutBytes,stderrBytes,rawProcessOutputPersisted:false,credentialStoreUnchanged:unchanged,realQqMessagesSent:0},null,2)+'\n')
 assert.equal(unchanged,true,'Managed credential store changed')
}
