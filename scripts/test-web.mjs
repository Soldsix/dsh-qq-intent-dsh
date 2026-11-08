/** Inspect the generic plugin-manager entry in an existing isolated headless Web profile. */
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {mkdtemp,mkdir,writeFile,copyFile,realpath,readFile} from 'node:fs/promises'
import {join,relative,isAbsolute,basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import {verifyInstalledArchive} from './verify-installed.mjs'
const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv
const argument=name=>{const i=args.indexOf(name);assert.ok(i>=0&&args[i+1],'Required '+name);return args[i+1]}
const home=await realpath(argument('--web-home')),archive=await realpath(argument('--archive')),browserCache=await realpath(argument('--browser-cache')),permitted=await realpath(argument('--test-workspace'))
process.env.PLAYWRIGHT_BROWSERS_PATH=browserCache;const {chromium}=await import('playwright')
const owned=relative(permitted,home)
assert.ok(permitted.split(/[\\/]/).includes('.test-artifacts')&&!owned.startsWith('..')&&!isAbsolute(owned),'Web profile must belong to an isolated test workspace')
const runs=join(root,'.test-artifacts','web');await mkdir(runs,{recursive:true});const area=await mkdtemp(join(runs,'run-')),profile='turn-control-web',profileRoot=join(home,'profiles',profile),copy=join(area,basename(archive))
await copyFile(archive,copy)
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/KEY|SECRET|TOKEN|PASSWORD|DEEPSEEK_BASE_URL/i.test(key)))
await mkdir(join(area,'temp'),{recursive:true});Object.assign(env,{DSH_HOME:home,TEMP:join(area,'temp'),TMP:join(area,'temp'),DSH_PRIMARY_RUNTIME:'',DSH_SYSTEM_PROMPT:'Synthetic isolated Web profile.',PLAYWRIGHT_BROWSERS_PATH:browserCache,DEEPSEEK_API_KEY:'synthetic-local-ui-only',DEEPSEEK_BASE_URL:'http://127.0.0.1:9/anthropic'})
async function setup(argv){
 const timeout=AbortSignal.timeout(300000),child=spawn(process.execPath,argv,{cwd:area,env,windowsHide:true,signal:timeout,stdio:['ignore','pipe','pipe']});let stdoutBytes=0,stderrBytes=0,failure
 child.stdout.on('data',value=>{stdoutBytes+=value.length});child.stderr.on('data',value=>{stderrBytes+=value.length});child.once('error',error=>{failure=error})
 const [code,signal]=await new Promise(done=>child.once('close',(...values)=>done(values)));await writeFile(join(area,'setup.json'),JSON.stringify({code,signal,stdoutBytes,stderrBytes,timedOut:timeout.aborted,rawProcessOutputPersisted:false})+'\n')
 if(failure)throw failure;assert.equal(code,0,'Isolated Web installation failed');assert.equal(signal,null)
}
const bin=join(profileRoot,'node_modules','@deepseek-ai','dsh','lib','bin.js')
await setup([bin,'plugin','--profile',profile,'add',copy]);const files=await verifyInstalledArchive(archive,join(profileRoot,'node_modules','dsh-qq-intent-dsh'),join(area,'installed-files.json'))
const child=spawn(process.execPath,[bin,'--profile',profile,'--host','127.0.0.1','--port','0','--no-open'],{cwd:area,env,windowsHide:true,stdio:['pipe','pipe','pipe']})
let stdout='',stderr='',exitCode,context,page;const errors=[],exit=once(child,'close').then(([code,signal])=>{exitCode=code;return{code,signal}})
const ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Web profile did not report ready')),60000),inspect=()=>{const match=(stdout+'\n'+stderr).match(/http:\/\/127\.0\.0\.1:\d+[^\s\u001b]*/);if(match){clearTimeout(timer);resolve(match[0])}};child.stdout.on('data',data=>{stdout+=data;inspect()});child.stderr.on('data',data=>{stderr+=data;inspect()});void exit.then(()=>{clearTimeout(timer);reject(Error('Web profile exited before ready'))})})
try{
 const login=await ready,origin=new URL(login).origin
 context=await chromium.launchPersistentContext(join(area,'browser-profile'),{headless:true,viewport:{width:1280,height:1000},locale:'zh-CN',colorScheme:'light',env})
 await context.route('**/*',route=>{const url=new URL(route.request().url());return url.origin===origin||['data:','blob:'].includes(url.protocol)?route.continue():route.abort()})
 page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message))
 await page.goto(login,{waitUntil:'domcontentloaded'});const proceed=page.getByRole('button',{name:/^继续$|^Continue$/});if(await proceed.isVisible())await proceed.click()
 const dismiss=page.getByRole('dialog').getByRole('button',{name:/^关闭$|^Close$/});if(await dismiss.isVisible())await dismiss.click()
 await page.getByRole('button',{name:/^插件$|^Plugins$/}).first().click()
 await page.getByText('dsh-qq-intent-dsh',{exact:true}).first().click();const form=page.locator('.qqintent-page'),checks=[]
 await form.getByText(/^分类器(?:已|未)启用|^Classifier (?:active|inactive)/).waitFor()
 if(await form.getByText(/^分类器已启用|^Classifier active/).isVisible()){await form.getByRole('switch',{name:/启用分类器|Enable classifier/}).click();await form.getByRole('button',{name:/^保存$|^Save$/}).click();await form.getByText(/^分类器未启用|^Classifier inactive/).waitFor()}
 checks.push('settings-visible-while-disabled')
 const provider=form.getByLabel(/模型渠道（可留空）|Provider \(optional\)/),model=form.getByLabel(/模型名称（可留空）|Model \(optional\)/)
 await provider.fill('synthetic');await form.getByRole('button',{name:/^保存$|^Save$/}).click();await page.getByText(/^请检查设置值$|^Check the settings values$/).waitFor();assert.equal(await provider.inputValue(),'synthetic');await form.getByRole('button',{name:/^放弃修改$|^Discard$/}).click();checks.push('invalid-route-keeps-draft')
 await form.getByRole('switch',{name:/启用分类器|Enable classifier/}).click();await form.getByRole('button',{name:/^保存$|^Save$/}).click();await form.getByText(/^分类器已启用|^Classifier active/).waitFor();checks.push('enable-with-host-route')
 const tokens=form.getByLabel(/^最大输出 token$|^Maximum output tokens$/),nextTokens=(await tokens.inputValue())==='96'?'112':'96';await tokens.fill(nextTokens);await form.getByRole('button',{name:/^保存$|^Save$/}).click();await page.getByText(/^分类器设置已保存$|^Classifier settings saved$/).waitFor();assert.equal(await tokens.inputValue(),nextTokens);assert.equal(await model.inputValue(),'');checks.push('valid-capacity-save')
 await page.screenshot({path:join(area,'light.png'),fullPage:true});await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:join(area,'dark.png'),fullPage:true})
 await page.getByRole('button',{name:/^收起侧边栏$|^Collapse sidebar$/}).click();await page.setViewportSize({width:520,height:1000});await form.evaluate(element=>element.scrollIntoView({block:'start'}));assert.ok(await form.evaluate(element=>element.scrollWidth<=element.clientWidth+2));await page.screenshot({path:join(area,'narrow.png'),fullPage:true});checks.push('light-dark-narrow-layout')
 await form.getByRole('switch',{name:/启用分类器|Enable classifier/}).click();await form.getByRole('button',{name:/^保存$|^Save$/}).click();await form.getByText(/^分类器未启用|^Classifier inactive/).waitFor();checks.push('disable-after-use')
 assert.deepEqual(errors,[]);const result={passed:true,checks,installedFiles:files,clientErrors:errors,realQqMessagesSent:0};await writeFile(join(area,'summary.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({area,...result}))
}catch(error){if(page)await page.screenshot({path:join(area,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(join(area,'result.json'),JSON.stringify({passed:false,error:{message:error.message},clientErrors:errors})+'\n');throw error}
finally{await context?.close();if(exitCode===undefined){child.kill('SIGINT');const fallback=setTimeout(()=>child.kill(),5000);await exit;clearTimeout(fallback)}await writeFile(join(area,'process.json'),JSON.stringify({exitCode,stdoutBytes:Buffer.byteLength(stdout),stderrBytes:Buffer.byteLength(stderr),rawProcessOutputPersisted:false})+'\n')}
