/** Check portable metadata and the exact npm publication allowlist. */
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {readFile,readdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url)),manifest=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'))
assert.equal(manifest.name,'dsh-qq-intent-dsh');assert.equal(manifest.type,'module');assert.equal(manifest.license,'MIT');assert.ok(!manifest.bin)
assert.equal(manifest.dsh?.bundle?.patch,'./cordis.patch.yml');assert.equal(manifest.dsh?.client?.platform,'web');assert.equal(manifest.engines?.dsh,'0.2.2-rc.1');assert.equal(manifest.peerDependencies?.['dsh-qq-turn-control'],'0.1.0-development')
for(const section of ['dependencies','peerDependencies','devDependencies'])for(const [key,value]of Object.entries(manifest[section]??{}))assert.ok(!/^(?:file:|link:|workspace:|[a-z]:[\\/]|[\\/])/i.test(value),'Nonportable dependency '+key)
const en=await readFile(resolve(root,'README.md'),'utf8'),zh=await readFile(resolve(root,'README.zh.md'),'utf8')
for(const text of [en,zh]){assert.match(text,/^kind: "package-bundle"$/m);assert.match(text,/^description: ".+"$/m)}
assert.equal(en.split('\n').length,zh.split('\n').length)
const patch=await readFile(resolve(root,'cordis.patch.yml'),'utf8');assert.match(patch,/name: dsh-qq-intent-dsh/);assert.match(patch,/enabled: false/)
async function checkText(path){const value=await readFile(resolve(root,path),'utf8');assert.ok(!/[c-f]:[\\/](?:users|个人|项目工作区)[\\/]/i.test(value),'Private location in '+path);assert.ok(!/\bsk-[a-z0-9]{20,}\b/i.test(value),'Credential-like literal in '+path);assert.ok(!/\bas unknown\b/.test(value),'Unknown cast in '+path);assert.ok(value.endsWith('\n')&&!value.endsWith('\n\n'),'Invalid newline in '+path)}
for(const file of await readdir(resolve(root,'src')))if(file.endsWith('.ts')){const text=await readFile(resolve(root,'src',file),'utf8');assert.ok(text.startsWith('/**'),'Missing module documentation');await checkText('src/'+file)}
assert.ok(process.env.npm_execpath,'Run through npm run check');const child=spawn(process.execPath,[process.env.npm_execpath,'pack','--dry-run','--ignore-scripts','--json'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']})
let stdout='',stderr='',failure;child.stdout.on('data',data=>{stdout+=data});child.stderr.on('data',data=>{stderr+=data});child.once('error',error=>{failure=error})
const [code,signal]=await new Promise(done=>child.once('close',(...values)=>done(values)));if(failure)throw failure;assert.equal(code,0,stderr);assert.equal(signal,null)
const packed=JSON.parse(stdout);assert.equal(packed.length,1);const paths=packed[0].files.map(file=>file.path),exact=['LICENSE','README.md','README.zh.md','package.json','cordis.patch.yml']
for(const path of paths){assert.ok(exact.includes(path)||/^dist\/(?:client\/)?[a-z][a-z-]*\.(?:js|d\.ts)$/.test(path),'Unexpected packed file '+path);await checkText(path)}
for(const path of [...exact,'dist/index.js','dist/index.d.ts','dist/runner.js','dist/engine.js','dist/control.js','dist/control.d.ts','dist/client.js','dist/client/index.d.ts'])assert.ok(paths.includes(path),'Missing packed file '+path)
console.log(JSON.stringify({package:manifest.name,passed:true,packedFiles:paths.length}))
