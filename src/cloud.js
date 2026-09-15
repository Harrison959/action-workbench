import { createClient } from '@supabase/supabase-js';
import * as db from './db';
let client, activeConfig;
let syncStatus='仅保存在本机';
const listeners=new Set();
const status=s=>{syncStatus=s;listeners.forEach(fn=>fn(s));};
export const watchSync=fn=>{listeners.add(fn);fn(syncStatus);return()=>listeners.delete(fn);};
export function configuration(){try{return JSON.parse(localStorage.getItem('action-cloud')||'null')||{url:import.meta.env.VITE_SUPABASE_URL||'',key:import.meta.env.VITE_SUPABASE_ANON_KEY||''};}catch{return {url:'',key:''};}}
export function configure(url,key){
 const parsed=new URL(url);if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.supabase.co'))throw new Error('请填写 Supabase 项目的 https://xxx.supabase.co 地址');
 if(key.startsWith('sb_secret_'))throw new Error('不能在应用中使用 secret key，请使用 Publishable key');
 if(key.startsWith('eyJ')) {try {if(JSON.parse(atob(key.split('.')[1])).role!=='anon')throw new Error();}catch{throw new Error('请使用 anon 公钥，不能使用 service_role');}}
 else if(!key.startsWith('sb_publishable_'))throw new Error('请使用 Publishable key 或 anon 公钥');
 localStorage.setItem('action-cloud',JSON.stringify({url:parsed.origin,key}));client=null;
}
export function cloud(){const c=configuration();if(!c.url||!c.key)return null;const signature=c.url+c.key;if(!client||signature!==activeConfig){client=createClient(c.url,c.key);activeConfig=signature;}return client;}
export async function session(){return (await cloud()?.auth.getSession())?.data.session || null;}
export async function login(email,password){const c=cloud();if(!c)throw new Error('请先保存云端配置');const {data,error}=await c.auth.signInWithPassword({email,password});if(error)throw error;db.setScope(data.user.id);return data.user;}
export async function logout(){const {error}=await cloud().auth.signOut();if(error)throw error;db.setScope('local');status('仅保存在本机');}
let syncing=false;
export async function sync(){
 if(syncing)return;const c=cloud();if(!c){status('仅保存在本机');return;}if(!navigator.onLine){status('离线 · 本机已保存');return;}
 const run=async()=>{syncing=true;try{
 const current=await session();if(!current||current.user.id!==db.getScope()){status('云端未登录 · 本机已保存');return;}
 const scope=current.user.id;status('正在同步…');
 let page=0,remote=[];while(true){const{data,error}=await c.from('action_records').select('id,kind,payload,version,deleted').order('id').range(page*500,page*500+499);if(error)throw error;remote.push(...data);if(data.length<500)break;page++;}
 await db.mergeRemote(remote,scope);
 const pending=(await db.allRows(scope)).filter(r=>r.dirty&&!r.conflict);
 for(const row of pending){const{data,error}=await c.rpc('save_action_record',{p_id:row.id,p_kind:row.kind,p_payload:row.data,p_deleted:row.deleted,p_expected:row.version});if(error)throw error;const result=Array.isArray(data)?data[0]:data;if(result.conflict){await db.mergeRemote([result.record],scope);}else await db.acknowledge(row,result.record);}
 const rows=await db.allRows(scope);status(rows.some(r=>r.conflict)?'有记录冲突 · 请到设置处理':rows.some(r=>r.dirty)?'有更改待同步':'已同步 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}));
 }catch(err){status('同步未完成 · '+(err.message||'请检查网络'));}finally{syncing=false;}};
 if(navigator.locks)await navigator.locks.request('action-cloud-sync',{ifAvailable:true},lock=>lock?run():undefined);else await run();
}
export async function analyse(records,question){const c=cloud();if(!c||!await session())throw new Error('连接云端并登录后可使用 AI 分析');const{data,error}=await c.functions.invoke('review',{body:{records,question}});if(error)throw new Error('AI 服务尚未配置或暂时不可用，记录已保留');if(data.error)throw new Error(data.error);return data.text;}
