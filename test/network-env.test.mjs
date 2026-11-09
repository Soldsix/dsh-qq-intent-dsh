import test from 'node:test'
import assert from 'node:assert/strict'
import {configureTestNetwork} from '../scripts/network-env.mjs'
test('fixture proxy setup preserves options and bypasses owned loopback without changing its source',()=>{
 const source={HTTPS_PROXY:'http://proxy.invalid:1234',NODE_OPTIONS:'--enable-source-maps',no_proxy:'example.invalid'},env={...source}
 configureTestNetwork(env,true);assert.equal(env.NODE_OPTIONS,'--enable-source-maps --use-env-proxy');assert.equal(env.NO_PROXY,'example.invalid,127.0.0.1,localhost,::1');assert.equal(env.no_proxy,undefined);assert.equal(source.no_proxy,'example.invalid')
 configureTestNetwork(env,true);assert.equal(env.NODE_OPTIONS,'--enable-source-maps --use-env-proxy')
})
test('unsupported Node versions and direct-network fixtures retain their original options',()=>{
 for(const [env,supported]of [[{HTTPS_PROXY:'http://proxy.invalid:1234'},false],[{NODE_OPTIONS:'--enable-source-maps'},true]]){const before={...env};configureTestNetwork(env,supported);assert.deepEqual(env,before)}
})
