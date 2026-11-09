/** Exercise an exact already-installed archive through a synthetic local DSH endpoint. */
import assert from 'node:assert/strict'
import {configureTestNetwork} from './network-env.mjs'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {createServer} from 'node:http'
import {mkdtemp,mkdir,readFile,writeFile,realpath} from 'node:fs/promises'
import {join,relative,isAbsolute} from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as delay} from 'node:timers/promises'
import {verifyInstalledArchive} from './verify-installed.mjs'
const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv
const argument=name=>{const index=args.indexOf(name);assert.ok(index>=0&&args[index+1],'Required '+name);return args[index+1]}
const native=await realpath(argument('--native-run')),archive=await realpath(argument('--archive')),owned=relative(join(root,'.test-artifacts','native'),native)
assert.ok(!owned.startsWith('..')&&!isAbsolute(owned),'Native profile must belong to this repository')
const runs=join(root,'.test-artifacts','native-installed');await mkdir(runs,{recursive:true});const area=await mkdtemp(join(runs,'run-'))
const home=join(native,'home'),profile='intent-native',profileRoot=join(home,'profiles',profile)
const files=await verifyInstalledArchive(archive,join(profileRoot,'node_modules','dsh-qq-intent-dsh'),join(area,'installed-files.json'))
const requests=[],server=createServer(async(req,res)=>{
 if(req.url?.endsWith('/models')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({object:'list',data:[{id:'deepseek-flash',object:'model',owned_by:'fixture',input_modalities:['text'],output_modalities:['text'],api_capabilities:{anthropic_messages:{}}}]}));return}
 if(!req.url?.endsWith('/messages')){res.statusCode=404;res.end();return}
 let raw='';for await(const chunk of req)raw+=chunk
 const data=JSON.parse(raw);requests.push(data);res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'})
 const send=(type,payload)=>res.write('event: '+type+'\ndata: '+JSON.stringify({type,...payload})+'\n\n')
 send('message_start',{message:{id:'intent-fixture-'+requests.length,type:'message',role:'assistant',model:data.model,content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:10,output_tokens:0}}})
 send('content_block_start',{index:0,content_block:{type:'text',text:''}});send('content_block_delta',{index:0,delta:{type:'text_delta',text:'{"decision":"reply"}'}});send('content_block_stop',{index:0});send('message_delta',{delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:10}});send('message_stop',{});res.end()
})
server.listen(0,'127.0.0.1');await once(server,'listening');server.unref()
const patch=join(area,'overlay.yml');await writeFile(patch,JSON.stringify([{id:'intent-probe',config:{resultPath:join(area,'result.json')}}],null,2)+'\n')
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/KEY|SECRET|TOKEN|PASSWORD|DEEPSEEK_BASE_URL|^NPM_CONFIG_CACHE$/i.test(key)))
env.NPM_CONFIG_CACHE=join(root,'.npm-cache')
configureTestNetwork(env,process.allowedNodeEnvironmentFlags.has('--use-env-proxy'))
await mkdir(join(area,'temp'),{recursive:true});Object.assign(env,{DSH_HOME:home,TEMP:join(area,'temp'),TMP:join(area,'temp'),DSH_PRIMARY_RUNTIME:'',DSH_SYSTEM_PROMPT:'Synthetic global prompt that the classifier must replace.',DEEPSEEK_API_KEY:'synthetic-loopback-only',DEEPSEEK_BASE_URL:'http://127.0.0.1:'+server.address().port+'/anthropic'})
const child=spawn(process.execPath,[join(profileRoot,'node_modules','@deepseek-ai','dsh','lib','bin.js'),'--profile',profile,'--patch',patch],{cwd:area,env,windowsHide:true,stdio:['pipe','pipe','pipe']})
let stdoutBytes=0,stderrBytes=0,exitCode,result;child.stdout.on('data',value=>{stdoutBytes+=value.length});child.stderr.on('data',value=>{stderrBytes+=value.length})
const exit=once(child,'close').then(([code,signal])=>{exitCode=code;return{code,signal}})
try{
 const deadline=Date.now()+120000
 while(Date.now()<deadline){try{result=JSON.parse(await readFile(join(area,'result.json'),'utf8'));break}catch(error){if(error.code!=='ENOENT')throw error}assert.equal(exitCode,undefined,'Native DSH exited before probe');await delay(50)}
 assert.ok(result,'Native probe timed out');assert.equal(result.passed,true,JSON.stringify(result.error));assert.equal(requests.length,4)
 assert.ok(requests.every(item=>JSON.stringify(item.system).includes('group-chat bot should respond')&&!JSON.stringify(item.system).includes('Synthetic global prompt')))
 assert.ok(requests.every(item=>!item.tools||item.tools.length===0),'Classifier exposed tools')
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'shutdown',params:{}})+'\n')
 assert.deepEqual(await Promise.race([exit,delay(15000,undefined,{ref:false}).then(()=>{throw Error('Native shutdown timed out')})]),{code:0,signal:null})
 await writeFile(join(area,'summary.json'),JSON.stringify({passed:true,checks:result.checks,installedFiles:files,modelRequests:requests.length,realQqMessagesSent:0,semanticQualityVerified:false},null,2)+'\n')
 console.log(JSON.stringify({area,passed:true,checks:result.checks,installedFiles:files,realQqMessagesSent:0}))
}finally{
 if(exitCode===undefined){child.stdin.end();const fallback=setTimeout(()=>child.kill(),5000);await exit;clearTimeout(fallback)}
 server.closeAllConnections();await new Promise(done=>server.close(done));await writeFile(join(area,'process.json'),JSON.stringify({exitCode,stdoutBytes,stderrBytes,rawProcessOutputPersisted:false})+'\n')
}
