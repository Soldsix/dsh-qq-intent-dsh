/** Synthetic IM transport for isolated full-chain tests only. */
import {ImRuntime,identifier} from 'dsh-im-kit'
export const name='intent-full-test-transport'
export function apply(ctx){
 const im=new ImRuntime(),outputs=[]
 const account={tenantId:identifier('im.tenant','fixture'),networkId:identifier('im.network','fixture'),accountId:identifier('im.account','bot')}
 const dispose=im.register({account,async availability(){return'available'},async send(message){outputs.push(structuredClone(message));return{status:'accepted',messageIds:[identifier('im.message','synthetic-reply-'+outputs.length)]}},async dispose(){}})
 ctx.effect(()=>async()=>{await dispose();await im.close()});ctx.effect(()=>ctx.provide('im',im));ctx.effect(()=>ctx.provide('intentFullTest',{account,outputs}))
}
