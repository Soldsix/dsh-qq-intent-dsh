/** Respect the host proxy for fixture downloads while keeping owned loopback endpoints direct. */
/** @param env - owned child environment after secret filtering. @param proxyFlagSupported - capability of the selected Node executable. */
export function configureTestNetwork(env,proxyFlagSupported){
 if(!proxyFlagSupported||![env.HTTP_PROXY,env.HTTPS_PROXY,env.http_proxy,env.https_proxy].some(Boolean))return
 const existing=env.NODE_OPTIONS??''
 if(!/(^|\s)--use-env-proxy(?:\s|$)/u.test(existing))env.NODE_OPTIONS=(existing+' --use-env-proxy').trim()
 const bypass=env.NO_PROXY??env.no_proxy??''
 for(const key of Object.keys(env))if(key.toUpperCase()==='NO_PROXY')delete env[key]
 env.NO_PROXY=[...new Set([...bypass.split(',').map(value=>value.trim()).filter(Boolean),'127.0.0.1','localhost','::1'])].join(',')
}
