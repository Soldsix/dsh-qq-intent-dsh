/** Run the native chat and classifier together with synthetic IM and a real model. */
import assert from 'node:assert/strict'
import {configureTestNetwork} from './network-env.mjs'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {createHash} from 'node:crypto'
import {mkdtemp,mkdir,readFile,writeFile,realpath} from 'node:fs/promises'
import {join,relative,isAbsolute,basename} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {setTimeout as delay} from 'node:timers/promises'
import {verifyInstalledArchive} from './verify-installed.mjs'
const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv
const argument=name=>{const i=args.indexOf(name);assert.ok(i>=0&&args[i+1],'Required '+name);return args[i+1]}
const credential=await realpath(argument('--credential-store')),native=await realpath(argument('--native-run')),turn=await realpath(argument('--turn-archive')),intent=await realpath(argument('--intent-archive'))
const owned=relative(join(root,'.test-artifacts','native'),native);assert.ok(!owned.startsWith('..')&&!isAbsolute(owned),'Native profile must belong to this repository')
const before=createHash('sha256').update(await readFile(credential)).digest(),runs=join(root,'.test-artifacts','full');await mkdir(runs,{recursive:true});const area=await mkdtemp(join(runs,'run-'))
const home=join(native,'home'),profile='intent-native',profileRoot=join(home,'profiles',profile)
const installed={turn:await verifyInstalledArchive(turn,join(profileRoot,'node_modules','dsh-qq-turn-control'),join(area,'turn-installed.json')),intent:await verifyInstalledArchive(intent,join(profileRoot,'node_modules','dsh-qq-intent-dsh'),join(area,'intent-installed.json'))}
const fixture=name=>pathToFileURL(fileURLToPath(new URL('./'+name,import.meta.url))).href
const probe=args.includes('--multi')?'full-multi-probe.mjs':'full-probe.mjs'
const overlay=[
 {id:'credentials',config:{path:credential,watch:false}},{id:'intent-probe',disabled:true},{id:'session-telemetry-otel',disabled:true},
 {id:'qq-intent-dsh',config:{enabled:true,provider:'deepseek-official',model:'deepseek-flash',reasoningEffort:'off',maxTurnsPerSession:20}},
 {id:'qq-turn-control',config:{enabled:true,intentEnabled:true}},
 {id:'qq-chat-runtime',config:{enabled:true,namespace:'full-'+basename(area).toLowerCase(),databasePath:join(area,'chat.sqlite3'),workspacePath:join(area,'workspace'),presetId:'intent-full-fixture',provider:'deepseek-official',model:'deepseek-flash',reasoningEffort:'off',maxTokens:256,trigger:'directed'}},
 {insert:[{id:'full-preset-registry',name:'@deepseek-ai/dsh-agent-preset-registry',config:{default:'intent-full-fixture'}},{id:'full-preset',name:'@deepseek-ai/dsh-agent-preset',config:{id:'intent-full-fixture',plugins:[]}},{id:'full-transport',name:fixture('full-transport.mjs')},{id:'full-probe',name:fixture(probe),config:{resultPath:join(area,'result.json')}}]},
]
const patch=join(area,'overlay.yml');await writeFile(patch,JSON.stringify(overlay,null,2)+'\n')
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/KEY|SECRET|TOKEN|PASSWORD|DEEPSEEK_BASE_URL|^NPM_CONFIG_CACHE$/i.test(key)))
env.NPM_CONFIG_CACHE=join(root,'.npm-cache')
configureTestNetwork(env,process.allowedNodeEnvironmentFlags.has('--use-env-proxy'))
await mkdir(join(area,'temp'),{recursive:true});Object.assign(env,{DSH_HOME:home,TEMP:join(area,'temp'),TMP:join(area,'temp'),DSH_PRIMARY_RUNTIME:'',DSH_SYSTEM_PROMPT:'Synthetic isolated group conversation. No private persona or skills.'})
const child=spawn(process.execPath,[join(profileRoot,'node_modules','@deepseek-ai','dsh','lib','bin.js'),'--profile',profile,'--patch',patch],{cwd:area,env,windowsHide:true,stdio:['pipe','pipe','pipe']})
let stdoutBytes=0,stderrBytes=0,exitCode,result;child.stdout.on('data',value=>{stdoutBytes+=value.length});child.stderr.on('data',value=>{stderrBytes+=value.length})
const exit=once(child,'close').then(([code,signal])=>{exitCode=code;return{code,signal}})
try{
 const deadline=Date.now()+240000
 while(Date.now()<deadline){try{result=JSON.parse(await readFile(join(area,'result.json'),'utf8'));break}catch(error){if(error.code!=='ENOENT')throw error}assert.equal(exitCode,undefined,'Isolated DSH exited before full probe');await delay(50)}
 assert.ok(result,'Full probe timed out');child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'shutdown',params:{}})+'\n')
 const stopped=await Promise.race([exit,delay(15000,undefined,{ref:false}).then(()=>{throw Error('Full probe shutdown timed out')})]);assert.equal(stopped.code,0)
 await writeFile(join(area,'summary.json'),JSON.stringify({...result,installed},null,2)+'\n')
 console.log(JSON.stringify({area,passed:result.passed,checks:result.checks,counts:result.counts,realQqMessagesSent:0}))
}finally{
 if(exitCode===undefined){child.stdin.end();const fallback=setTimeout(()=>child.kill(),5000);await exit;clearTimeout(fallback)}
 const unchanged=before.equals(createHash('sha256').update(await readFile(credential)).digest())
 await writeFile(join(area,'process.json'),JSON.stringify({exitCode,stdoutBytes,stderrBytes,rawProcessOutputPersisted:false,credentialStoreUnchanged:unchanged,realQqMessagesSent:0},null,2)+'\n');assert.equal(unchanged,true,'Managed credential store changed')
}
