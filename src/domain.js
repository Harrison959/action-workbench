export const STREAMS = [
  { id: 'income', name: '公众号', en: 'PUBLIC ACCOUNTS', hint: '记录收益，找到值得投入的赛道。', icon: 'Newspaper' },
  { id: 'sales', name: '销售', en: 'RELATIONSHIPS', hint: '每一次认真跟进，都有迹可循。', icon: 'Users' },
  { id: 'sleep', name: '睡眠', en: 'REST & RHYTHM', hint: '从醒来的这一刻，重新安排节奏。', icon: 'Moon' },
  { id: 'courses', name: '专业课', en: 'ACADEMIC STUDY', hint: '围绕考试，把复习落到具体一页。', icon: 'GraduationCap' },
  { id: 'english', name: '英语', en: 'A LITTLE EVERY DAY', hint: '一集、一句话、一本书。', icon: 'BookOpen' },
  { id: 'fitness', name: '健身', en: 'BODY IN PROGRESS', hint: '练习与休息，都是长期计划的一部分。', icon: 'Dumbbell' },
  { id: 'guitar', name: '吉他', en: 'PRACTICE & PLAY', hint: '听见一点点更流畅的自己。', icon: 'Music2' },
  { id: 'emotion', name: '情绪', en: 'CHECK IN WITH YOURSELF', hint: '先觉察，再做一个小小的调整。', icon: 'Heart' },
];
export const COURSES = ['组织与胚胎学', '免疫基础与病原生物学', '生物化学', '中药学'];
export const GRADES = { S: '强意向 · 有信任基础', A: '有意向', B: '一般 · 犹豫中', C: '无意向', D: '已经学了', W: '未成年' };
export const KINDS = ['task','goal','inbox','event','account','income','client','salesDaily','deal','sleep','course','study','episode','word','book','reading','workout','body','routine','guitar','emotion','summary','plan','setting','focus'];
export function day(d = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit' }).format(d); }
export function addDays(s, n) { const d = new Date(s + 'T12:00:00+08:00'); d.setUTCDate(d.getUTCDate() + n); return day(d); }
export const today = () => day();
export function cents(input) {
  if (input === '' || input === null || input === undefined) return null;
  const s = String(input).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('金额请填写非负数字，最多两位小数');
  const [a,b=''] = s.split('.'); const n = Number(a)*100 + Number(b.padEnd(2,'0'));
  if (!Number.isSafeInteger(n) || n > 10000000000) throw new Error('金额超出可记录范围');
  return n;
}
export const money = n => '¥' + ((n || 0) / 100).toLocaleString('zh-CN', {minimumFractionDigits:2,maximumFractionDigits:2});
export const sum = (rows, field) => rows.reduce((n,r) => n + (Number(r[field]) || 0), 0);
export function dateRange(month, end = today()) {
  const start = month + '-01', next = new Date(start+'T12:00:00+08:00'); next.setUTCMonth(next.getUTCMonth()+1);
  const last = addDays(day(next), -1), cap = last < end ? last : end;
  const arr=[]; for(let d=start; d<=cap; d=addDays(d,1)) arr.push(d); return arr;
}
export function accountTrack(account, date) {
  return [...(account.tracks || [])].filter(t=>t.date<=date).sort((a,b)=>b.date.localeCompare(a.date))[0]?.name || account.track || '未分类';
}
export function incomeStats(rows, accounts, month, end=today()) {
  const days=dateRange(month,end), actual=rows.filter(r=>r.date.startsWith(month) && r.date<=end);
  const points=days.map(date=> {const entries=actual.filter(r=>r.date===date); return {label:date.slice(8),value:entries.length?sum(entries,'cents')/100:null,date};});
  const tracks={}; actual.forEach(r=>{const a=accounts.find(a=>a.id===r.accountId); const key=r.track || accountTrack(a||{},r.date); (tracks[key] ||= {name:key,total:0,accounts:new Set()}).total += r.cents; tracks[key].accounts.add(r.accountId);});
  return {total:sum(actual,'cents'),points,tracks:Object.values(tracks).map(t=>({...t,count:t.accounts.size,average:t.total/t.accounts.size}))};
}
export function sleepMinutes(r) {
  if (!r.asleep || !r.wake) return null;
  const diff=(Date.parse(r.wake+'+08:00')-Date.parse(r.asleep+'+08:00'))/60000;
  const awake=Number(r.awakeMinutes)||0;
  if (!Number.isFinite(diff)||diff<=0||diff>24*60||awake<0||awake>diff) throw new Error('请检查入睡、醒来日期和夜醒时长（总跨度不超过24小时）');
  if(r.bed && Date.parse(r.bed+'+08:00')>Date.parse(r.asleep+'+08:00')) throw new Error('上床时间应在入睡之前');
  if(r.rise && Date.parse(r.rise+'+08:00')<Date.parse(r.wake+'+08:00')) throw new Error('起床时间应在最终醒来之后');
  return Math.round(diff-awake);
}
export function completedBooks(books, period) {return books.filter(b=>b.completed && b.completed.startsWith(period)).length;}
export function salesStats(clients,deals,period) {
  const closed=deals.filter(d=>d.date.startsWith(period)); const cohort=clients.filter(c=>c.added?.startsWith(period));
  const converted=new Set(deals.filter(d=>cohort.some(c=>c.id===d.clientId)).map(d=>d.clientId));
  return {customers:new Set(closed.map(d=>d.clientId)).size,revenue:sum(closed,'cents'),cohort:cohort.length,conversion:cohort.length?converted.size/cohort.length:null};
}
export function elapsedFocus(f, now=Date.now()) {return Math.max(0,Number(f?.elapsed)||0)+(f?.running&&f.started?Math.max(0,now-f.started):0);}
export function validateBackup(payload) {
  if(payload?.format!=='action-backup' || payload.version!==1 || !Array.isArray(payload.rows) || payload.rows.length>100000) throw new Error('不是兼容的 action 备份');
  for(const r of payload.rows) if(!r.id||typeof r.id!=='string'||!KINDS.includes(r.kind)||!r.data||typeof r.data!=='object'||Array.isArray(r.data)||JSON.stringify(r).length>200000) throw new Error('备份中含有不支持的记录');
  return payload.rows;
}
