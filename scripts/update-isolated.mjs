/** Update only an owned test profile and verify the exact supplied package bytes. */
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {realpath,mkdtemp,mkdir,writeFile,copyFile} from 'node:fs/promises'
import {join,relative,isAbsolute,basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import {verifyInstalledArchive} from './verify-installed.mjs'
const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv
const argument=name=>{const i=args.indexOf(name);assert.ok(i>=0&&args[i+1],'Required '+name);return args[i+1]}
const native=await realpath(argument('--native-run')),archive=await realpath(argument('--archive')),owned=relative(join(root,'.test-artifacts','native'),native)
assert.ok(!owned.startsWith('..')&&!isAbsolute(owned),'Native profile must belong to this repository')
const packageIndex=args.indexOf('--package'),packageName=packageIndex<0?'dsh-qq-intent-dsh':argument('--package')
assert.ok(['dsh-qq-intent-dsh','dsh-qq-turn-control'].includes(packageName),'Unsupported isolated package')
const runs=join(root,'.test-artifacts','update');await mkdir(runs,{recursive:true});const area=await mkdtemp(join(runs,'run-')),home=join(native,'home'),profile='intent-native',profileRoot=join(home,'profiles',profile)
const uniqueArchive=join(area,basename(archive));await copyFile(archive,uniqueArchive)
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/KEY|SECRET|TOKEN|PASSWORD|DEEPSEEK_BASE_URL/i.test(key)))
await mkdir(join(area,'temp'),{recursive:true});Object.assign(env,{DSH_HOME:home,TEMP:join(area,'temp'),TMP:join(area,'temp'),DSH_PRIMARY_RUNTIME:''})
const timeout=AbortSignal.timeout(300000),child=spawn(process.execPath,[join(profileRoot,'node_modules','@deepseek-ai','dsh','lib','bin.js'),'plugin','--profile',profile,'add',uniqueArchive],{cwd:area,env,windowsHide:true,signal:timeout,stdio:['ignore','pipe','pipe']})
let stdoutBytes=0,stderrBytes=0,failure;child.stdout.on('data',value=>{stdoutBytes+=value.length});child.stderr.on('data',value=>{stderrBytes+=value.length});child.once('error',error=>{failure=error})
const [code,signal]=await new Promise(done=>child.once('close',(...values)=>done(values)))
await writeFile(join(area,'process.json'),JSON.stringify({code,signal,timedOut:timeout.aborted,stdoutBytes,stderrBytes,rawProcessOutputPersisted:false})+'\n')
if(failure)throw failure;assert.equal(code,0,'Isolated plugin update failed');assert.equal(signal,null)
const files=await verifyInstalledArchive(archive,join(profileRoot,'node_modules',packageName),join(area,'installed-files.json'))
console.log(JSON.stringify({area,passed:true,files,realQqMessagesSent:0}))
