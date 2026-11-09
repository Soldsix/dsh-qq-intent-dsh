/** Install explicit archives into a fresh consumer and typecheck public declarations. */
import assert from 'node:assert/strict'
import {configureTestNetwork} from './network-env.mjs'
import {spawn} from 'node:child_process'
import {mkdtemp,mkdir,readFile,writeFile,copyFile,realpath} from 'node:fs/promises'
import {join,relative,isAbsolute,basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import ts from 'typescript'
import {verifyInstalledArchive} from './verify-installed.mjs'
const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv
const argument=name=>{const i=args.indexOf(name);assert.ok(i>=0&&args[i+1],'Required '+name);return args[i+1]}
assert.ok(process.env.npm_execpath,'Run through npm run test:consumer')
const inputs=await Promise.all(['--im-kit-archive','--chat-archive','--turn-archive','--intent-archive'].map(name=>realpath(argument(name))))
const runs=join(root,'.test-artifacts','consumer');await mkdir(runs,{recursive:true});const resume=args.indexOf('--resume-run'),area=resume>=0?await realpath(argument('--resume-run')):await mkdtemp(join(runs,'run-')),owned=relative(runs,area);assert.ok(!owned.startsWith('..')&&!isAbsolute(owned),'Consumer must belong to this repository');const archives=[]
for(const path of inputs){const target=join(area,basename(path));await copyFile(path,target);archives.push(target)}
const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'))
await writeFile(join(area,'package.json'),JSON.stringify({name:'isolated-intent-consumer',private:true,type:'module',overrides:manifest.overrides},null,2)+'\n')
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/KEY|SECRET|TOKEN|PASSWORD|^NPM_CONFIG_CACHE$/i.test(key)))
env.NPM_CONFIG_CACHE=join(root,'.npm-cache')
configureTestNetwork(env,process.allowedNodeEnvironmentFlags.has('--use-env-proxy'))
await mkdir(join(area,'temp'),{recursive:true});Object.assign(env,{TEMP:join(area,'temp'),TMP:join(area,'temp')})
const peers=Object.entries(manifest.peerDependencies).filter(([name])=>name!=='dsh-qq-turn-control').map(([name,version])=>name+'@'+version)
const timeout=AbortSignal.timeout(300000),child=spawn(process.execPath,[process.env.npm_execpath,'install','--ignore-scripts','--no-audit','--no-fund','--package-lock=false','--cache',join(root,'.npm-cache'),...archives,...peers,'@deepseek-ai/dsh@0.2.2-rc.1','@types/node@24.0.0','@types/js-yaml@4.0.9','@types/react@18.3.28','@types/react-dom@18.3.7'],{cwd:area,env,windowsHide:true,signal:timeout,stdio:['ignore','pipe','pipe']})
let stdoutBytes=0,stderrBytes=0,failure;child.stdout.on('data',value=>{stdoutBytes+=value.length});child.stderr.on('data',value=>{stderrBytes+=value.length});child.once('error',error=>{failure=error})
const [code,signal]=await new Promise(done=>child.once('close',(...values)=>done(values)));await writeFile(join(area,'installation.json'),JSON.stringify({code,signal,timedOut:timeout.aborted,stdoutBytes,stderrBytes,rawProcessOutputPersisted:false})+'\n')
if(failure)throw failure;assert.equal(code,0,'Isolated consumer installation failed');assert.equal(signal,null)
const installed=join(area,'node_modules','dsh-qq-intent-dsh'),files=await verifyInstalledArchive(archives[3],installed,join(area,'installed-files.json'))
const source=join(area,'consumer.ts');await writeFile(source,`import z from '@deepseek-ai/schemastery'\nimport { Config, type IntentStatus } from 'dsh-qq-intent-dsh'\nimport type { TurnIntent } from 'dsh-qq-turn-control'\nimport type Control from 'dsh-qq-intent-dsh/control'\nimport type * as NativeClient from 'dsh-qq-intent-dsh/client'\nexport type OwnerControl=Control\nexport type ClientModule=typeof NativeClient\nconst config=z.resolve({ enabled: false },Config,{})[0]\nexport type Status=IntentStatus\nexport type Provider=TurnIntent\nvoid config\n`)
const program=ts.createProgram([source],{strict:true,noEmit:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:['node'],typeRoots:[join(area,'node_modules','@types')],lib:['lib.es2022.d.ts','lib.dom.d.ts'],skipLibCheck:false,allowImportingTsExtensions:true})
const diagnostics=ts.getPreEmitDiagnostics(program);await writeFile(join(area,'type-diagnostics.txt'),ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>area,getCanonicalFileName:file=>file,getNewLine:()=> '\n'}));assert.equal(diagnostics.length,0,'Strict declaration check failed')
const compilerLib=join(root,'node_modules','typescript','lib')
for(const file of program.getSourceFiles()){if(file.isDeclarationFile){const outside=relative(area,file.fileName),compiler=relative(compilerLib,file.fileName);assert.ok((!outside.startsWith('..')&&!isAbsolute(outside))||(!compiler.startsWith('..')&&!isAbsolute(compiler)),'Consumer borrowed an ancestor dependency')}}
const count=program.getSourceFiles().filter(file=>file.isDeclarationFile).length
await writeFile(join(area,'summary.json'),JSON.stringify({passed:true,installedFiles:files,declarationFiles:count,ancestorDependenciesBorrowed:false,realQqMessagesSent:0},null,2)+'\n')
console.log(JSON.stringify({area,passed:true,installedFiles:files,declarationFiles:count,realQqMessagesSent:0}))
