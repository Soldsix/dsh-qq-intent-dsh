/** Install the exact archives into a fresh isolated DSH SDK profile. */
import assert from 'node:assert/strict'
import {configureTestNetwork} from './network-env.mjs'
import {pnpmScript} from './pnpm.mjs'
import {requiredProfilePeers} from './profile-peers.mjs'
import {verifyInstalledArchive} from './verify-installed.mjs'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {createServer} from 'node:http'
import {createHash} from 'node:crypto'
import {mkdtemp,mkdir,readFile,writeFile,copyFile,realpath} from 'node:fs/promises'
import {join,basename,delimiter,relative,isAbsolute} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {setTimeout as delay} from 'node:timers/promises'

const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv
const argument=name=>{const index=args.indexOf(name);assert.ok(index>=0&&args[index+1],'Required '+name);return args[index+1]}
const paths=await Promise.all(['--im-kit-archive','--chat-archive','--turn-archive','--intent-archive'].map(name=>realpath(argument(name))))
const runs=join(root,'.test-artifacts','native');await mkdir(runs,{recursive:true});const resume=args.indexOf('--resume-run'),resumed=resume>=0,area=resumed?await realpath(argument('--resume-run')):await mkdtemp(join(runs,'run-'));const owned=relative(runs,area);assert.ok(!owned.startsWith('..')&&!isAbsolute(owned),'Native profile must belong to this repository');const attempt=await mkdtemp(join(area,'attempt-')),home=join(area,'home'),profile='intent-native',profileRoot=join(home,'profiles',profile),archives=[]
const storeIndex=args.indexOf('--pnpm-store');if(storeIndex>=0)assert.ok(args[storeIndex+1],'Required value for --pnpm-store')
const store=storeIndex<0?join(root,'.test-artifacts','pnpm-store'):await realpath(args[storeIndex+1])
for(const path of paths){const target=join(attempt,basename(path));await copyFile(path,target);archives.push({path:target,name:basename(path),sha256:createHash('sha256').update(await readFile(target)).digest('hex')})}
const requests=[]
const server=createServer(async(req,res)=>{
 if(req.url?.endsWith('/models')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({object:'list',data:[{id:'deepseek-flash',object:'model',owned_by:'fixture',input_modalities:['text'],output_modalities:['text'],api_capabilities:{anthropic_messages:{}}}]}));return}
 if(!req.url?.endsWith('/messages')){res.statusCode=404;res.end();return}
 let raw='';for await(const chunk of req)raw+=chunk
 const data=JSON.parse(raw);requests.push(data);res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'})
 const send=(type,payload)=>res.write('event: '+type+'\ndata: '+JSON.stringify({type,...payload})+'\n\n')
 send('message_start',{message:{id:'intent-fixture-'+requests.length,type:'message',role:'assistant',model:data.model,content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:10,output_tokens:0}}})
 send('content_block_start',{index:0,content_block:{type:'text',text:''}});send('content_block_delta',{index:0,delta:{type:'text_delta',text:'{"decision":"reply"}'}});send('content_block_stop',{index:0})
 send('message_delta',{delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:10}});send('message_stop',{});res.end()
})
server.listen(0,'127.0.0.1');await once(server,'listening');server.unref()
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/KEY|SECRET|TOKEN|PASSWORD|^NPM_CONFIG_CACHE$/i.test(key)))
env.NPM_CONFIG_CACHE=join(root,'.npm-cache')
configureTestNetwork(env,process.allowedNodeEnvironmentFlags.has('--use-env-proxy'))
await mkdir(join(area,'temp'),{recursive:true});Object.assign(env,{DSH_HOME:home,TEMP:join(area,'temp'),TMP:join(area,'temp'),DSH_PRIMARY_RUNTIME:'',DSH_SYSTEM_PROMPT:'Synthetic global prompt that the classifier must replace.',DEEPSEEK_API_KEY:'synthetic-loopback-only',DEEPSEEK_BASE_URL:'http://127.0.0.1:'+server.address().port+'/anthropic'})
const dsh=join(root,'node_modules','@deepseek-ai','dsh','lib','bin.js'),commands=[]
async function run(argv,cwd){
 const timeout=AbortSignal.timeout(300000),child=spawn(process.execPath,argv,{cwd,env,windowsHide:true,signal:timeout,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',failure
 child.stdout.on('data',data=>{stdout+=data});child.stderr.on('data',data=>{stderr+=data});child.once('error',error=>{failure=error})
 const [code,signal]=await new Promise(resolve=>child.once('close',(...values)=>resolve(values)))
 const issueCodes=[...new Set((stdout+'\n'+stderr).match(/ERR_PNPM_[A-Z0-9_]+|ETIMEDOUT|ECONNREFUSED|ECONNRESET|EAI_AGAIN/g)??[])]
 commands.push({argv,code,signal,timedOut:timeout.aborted,stdoutBytes:Buffer.byteLength(stdout),stderrBytes:Buffer.byteLength(stderr),issueCodes})
 await writeFile(join(attempt,'setup.json'),JSON.stringify(commands,null,2)+'\n');if(failure)throw failure;assert.equal(code,0,'Setup failed; command '+commands.length);return stdout
}
let child,exit,exitCode
try{
 if(!resumed)await run([dsh,'--profile',profile,'--from-default-profile','sdk','--dump-config'],area)
 const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8')),profileManifest=JSON.parse(await readFile(join(profileRoot,'package.json'),'utf8'))
 profileManifest.pnpm={...profileManifest.pnpm,overrides:{...manifest.overrides,...args.includes('--candidate-inputs')?{'dsh-im-kit':'file:'+archives[0].path,'dsh-qq-chat':'file:'+archives[1].path,'dsh-qq-turn-control':'file:'+archives[2].path}:{}}};await writeFile(join(profileRoot,'package.json'),JSON.stringify(profileManifest,null,2)+'\n')
 await writeFile(join(profileRoot,'.npmrc'),'package-import-method=copy\nstore-dir='+store.replaceAll('\\','/')+'\ncache-dir='+join(root,'.test-artifacts','pnpm-cache').replaceAll('\\','/')+'\n')
 const pnpm=await pnpmScript(root)
 const peers=['@deepseek-ai/cordis@~4.1.0','@deepseek-ai/cordis-plugin-loader@~1.1.0','@deepseek-ai/schemastery@~3.19.0',...['agent','agent-preset-registry','app-boot','brand','llm','session','session-persistence','system-prompt','tools','scope','config-editor','typert-protocol','llm-deepseek-api-key','client-connection'].map(name=>'@deepseek-ai/dsh-'+name+'@0.2.2-rc.1')]
 await run([pnpm,'add',archives[0].path,'@deepseek-ai/dsh@0.2.2-rc.1',...peers,'--ignore-scripts'],profileRoot)
 for(const archive of archives.slice(1))await run([dsh,'plugin','--profile',profile,'add',archive.path],area)
 for(;;){const missing=await requiredProfilePeers(profileRoot);if(!missing.length)break;await run([pnpm,'add',...missing,'--ignore-scripts'],profileRoot)}
 await copyFile(fileURLToPath(new URL('./native-probe.mjs',import.meta.url)),join(profileRoot,'native-probe.mjs'))
 const installedFiles={}
 for(const [index,name] of ['dsh-im-kit','dsh-qq-chat','dsh-qq-turn-control','dsh-qq-intent-dsh'].entries())installedFiles[name]=await verifyInstalledArchive(archives[index].path,join(profileRoot,'node_modules',name),join(attempt,name+'-files.json'))
 const fixture=pathToFileURL(join(profileRoot,'native-probe.mjs')).href
 const overlay=[{id:'qq-intent-dsh',config:{enabled:true,provider:'deepseek-official',model:'deepseek-flash',reasoningEffort:'off',maxTurnsPerSession:2}},{id:'qq-chat-runtime',config:{enabled:false}},{id:'qq-turn-control',config:{enabled:false}},{id:'session-telemetry-otel',disabled:true},{insert:[{id:'intent-probe',name:fixture,config:{resultPath:join(attempt,'result.json')}}]}]
 await writeFile(join(profileRoot,'cordis.patch.yml'),JSON.stringify(overlay,null,2)+'\n')
 child=spawn(process.execPath,[join(profileRoot,'node_modules','@deepseek-ai','dsh','lib','bin.js'),'--profile',profile],{cwd:area,env,windowsHide:true,stdio:['pipe','pipe','pipe']})
 let stdoutBytes=0,stderrBytes=0;child.stdout.on('data',data=>{stdoutBytes+=data.length});child.stderr.on('data',data=>{stderrBytes+=data.length})
 exit=once(child,'close').then(([code,signal])=>{exitCode=code;return{code,signal}})
 let result;const deadline=Date.now()+120000
 while(Date.now()<deadline){try{result=JSON.parse(await readFile(join(attempt,'result.json'),'utf8'));break}catch(error){if(error.code!=='ENOENT')throw error}assert.equal(exitCode,undefined,'Native DSH exited before the probe');await delay(50)}
 assert.ok(result,'Native probe timed out');assert.equal(result.passed,true,JSON.stringify(result.error));assert.equal(requests.length,4)
 assert.ok(requests.every(request=>JSON.stringify(request.system).includes('group-chat bot should respond')),'Classifier section not used')
 assert.ok(requests.every(request=>JSON.stringify(request.system).includes('respondingTo alias')),'Recipient instruction not used')
 assert.ok(requests.some(request=>JSON.stringify(request.messages).includes('replyTo')&&JSON.stringify(request.messages).includes('respondingTo')),'Recipient and quote metadata missing from native adapter request')
 assert.ok(requests.every(request=>!JSON.stringify(request.system).includes('Synthetic global prompt')),'Global section leaked into classifier')
 assert.ok(requests.every(request=>!request.tools||request.tools.length===0),'Classifier exposed tools')
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'shutdown',params:{}})+'\n')
 assert.deepEqual(await Promise.race([exit,delay(15000,undefined,{ref:false}).then(()=>{throw Error('Native shutdown timed out')})]),{code:0,signal:null})
 await writeFile(join(attempt,'summary.json'),JSON.stringify({passed:true,dependencyResolution:args.includes('--candidate-inputs')?'candidate-archive-overrides':'public-manifest',checks:result.checks,installedFiles,archives:archives.map(({name,sha256})=>({name,sha256})),modelRequests:requests.length,realQqMessagesSent:0,semanticQualityVerified:false,stdoutBytes,stderrBytes},null,2)+'\n')
 console.log(JSON.stringify({area,attempt,passed:true,checks:result.checks,installedFiles,modelRequests:requests.length,realQqMessagesSent:0}))
}finally{
 if(child&&exitCode===undefined){child.stdin.end();const fallback=setTimeout(()=>child.kill(),5000);await exit;clearTimeout(fallback)}
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve))
}
