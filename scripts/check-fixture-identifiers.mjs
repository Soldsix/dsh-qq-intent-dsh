/** Check local JavaScript fixture bindings without treating loose test doubles as public TypeScript APIs. */
import assert from 'node:assert/strict'
import {readdir} from 'node:fs/promises'
import {join,relative,isAbsolute,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import ts from 'typescript'
const root=fileURLToPath(new URL('../',import.meta.url))
async function collect(directory){const files=[];for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())files.push(...await collect(path));else if(entry.name.endsWith('.mjs'))files.push(path)}return files}
const files=[...await collect(join(root,'scripts')),...await collect(join(root,'test'))],owned=new Set(files.map(file=>resolve(file)))
const program=ts.createProgram(files,{allowJs:true,checkJs:true,noEmit:true,strict:false,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:['node'],lib:['lib.es2022.d.ts','lib.dom.d.ts'],allowImportingTsExtensions:true})
const diagnostics=[...program.getSyntacticDiagnostics(),...program.getSemanticDiagnostics()].filter(value=>value.file&&owned.has(resolve(value.file.fileName))&&(value.category===ts.DiagnosticCategory.Error&&(value.code===2304||value.code===2552||value.code===18004||value.code<2000)))
for(const value of diagnostics){const path=relative(root,value.file.fileName);assert.ok(!isAbsolute(path)&&!path.startsWith('..'));const line=value.file.getLineAndCharacterOfPosition(value.start??0).line+1;console.error(path+':'+line+': '+ts.flattenDiagnosticMessageText(value.messageText,' '))}
assert.equal(diagnostics.length,0,'Fixture syntax or identifier check failed')
console.log(JSON.stringify({passed:true,fixtureFiles:files.length,check:'syntax-and-local-bindings',publicStrictTypecheck:false}))
