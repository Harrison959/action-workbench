import { openDB } from 'idb';
import { KINDS, validateBackup } from './domain';
const db = openDB('action-workbench', 1, { upgrade(db) { db.createObjectStore('records',{keyPath:'key'}); db.createObjectStore('meta'); db.createObjectStore('files'); } });
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('action-records') : null;
const listeners = new Set();
let scope = localStorage.getItem('action-scope') || 'local';
const emit = () => { listeners.forEach(fn=>fn()); };
if(channel) channel.onmessage=emit;
const announce=()=>{emit();channel?.postMessage('changed');};
export const subscribe = fn => {listeners.add(fn);return ()=>listeners.delete(fn);};
export const getScope = () => scope;
export function setScope(s) {scope=s;localStorage.setItem('action-scope',s);announce();}
export async function allRows(s=scope) {return (await (await db).getAll('records')).filter(r=>r.scope===s);}
export async function records(s=scope) {return (await allRows(s)).filter(r=>!r.deleted).map(r=>({ ...r.data,id:r.id,kind:r.kind }));}
export async function put(kind,data,id=crypto.randomUUID(),s=scope) {
  if(!KINDS.includes(kind)) throw new Error('不支持的记录类型');
  const conn=await db, tx=conn.transaction('records','readwrite'), store=tx.objectStore('records'), key=s+':'+id;
  const old=await store.get(key); const clean={...data}; delete clean.id;delete clean.kind;
  const row={...old,key,scope:s,id,kind,data:clean,version:old?.version||0,dirty:true,deleted:false,change:crypto.randomUUID(),updatedAt:new Date().toISOString()};
  await store.put(row);await tx.done;announce();return id;
}
export async function remove(id,s=scope) {const conn=await db,tx=conn.transaction('records','readwrite'),store=tx.objectStore('records'),old=await store.get(s+':'+id);if(old)await store.put({...old,deleted:true,dirty:true,change:crypto.randomUUID()});await tx.done;announce();}
export async function restore(id,s=scope) {const conn=await db,tx=conn.transaction('records','readwrite'),store=tx.objectStore('records'),old=await store.get(s+':'+id);if(old)await store.put({...old,deleted:false,dirty:true,change:crypto.randomUUID()});await tx.done;announce();}
export async function mergeRemote(remote,s) {
 const conn=await db,tx=conn.transaction('records','readwrite'),store=tx.objectStore('records');
 for(const r of remote){const key=s+':'+r.id, old=await store.get(key); if(old?.dirty) {if(old.version!==r.version) await store.put({...old,conflict:r});} else if(!old||r.version>old.version) await store.put({key,scope:s,id:r.id,kind:r.kind,data:r.payload,deleted:r.deleted,version:r.version,dirty:false});}
 await tx.done;announce();
}
export async function acknowledge(sent,remote) {
 const conn=await db,tx=conn.transaction('records','readwrite'),store=tx.objectStore('records'),current=await store.get(sent.key);
 if(current) await store.put({...current,version:remote.version,dirty:current.change!==sent.change,conflict:null});await tx.done;announce();
}
export async function resolveConflict(id,keepLocal) {
 const conn=await db,tx=conn.transaction('records','readwrite'),store=tx.objectStore('records'),r=await store.get(scope+':'+id),remote=r?.conflict;
 if(remote)await store.put(keepLocal?{...r,version:remote.version,conflict:null,dirty:true,change:crypto.randomUUID()}:{...r,data:remote.payload,deleted:remote.deleted,version:remote.version,conflict:null,dirty:false});await tx.done;announce();
}
export async function exportData() {return {format:'action-backup',version:1,exportedAt:new Date().toISOString(),timezone:'Asia/Shanghai',rows:await allRows()};}
export async function importData(payload) {
 const rows=validateBackup(payload), conn=await db,tx=conn.transaction('records','readwrite'),store=tx.objectStore('records');let count=0;
 // Merge-only import: existing records always win. Restoring cannot silently overwrite newer data.
 for(const r of rows){const key=scope+':'+r.id;if(!await store.get(key)){await store.put({key,scope,id:r.id,kind:r.kind,data:r.data,deleted:!!r.deleted,version:0,dirty:true,change:crypto.randomUUID()});count++;}}
 await tx.done;announce();return count;
}
export async function importLocal() {return importData({format:'action-backup',version:1,rows:await allRows('local')});}
export async function saveFile(file) {if(file.size>15*1024*1024)throw new Error('单个附件请控制在15MB以内');const id=crypto.randomUUID();await(await db).put('files',{blob:file,name:file.name,type:file.type,scope},scope+':'+id);return id;}
export async function getFile(id) {return(await db).get('files',scope+':'+id);}
