import React,{useState,useEffect,useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import * as db from './db';
import {sync,watchSync,session,cloud} from './cloud';
import {initNotifications,scheduleEvents,native} from './notifications';
import {STREAMS,today} from './domain';
import {Context,Icon,Link,Button,FormDialog,textField} from './ui';
import {Today,Tasks,Focus,Goals,Inbox,Schedule,Summary,Plan,More,Cover} from './pages/CorePages';
import {Income,Sales,Sleep,Courses,English,Fitness,Guitar,Emotion} from './pages/Workstreams';
import {Settings} from './pages/Settings';
import './styles.css';
const mainNav=[['today','今日','LayoutDashboard'],['tasks','任务','ListTodo'],['focus','专注','Scan'],['goals','目标','Target']];
const pageMap={today:Today,tasks:Tasks,focus:Focus,goals:Goals,more:More,inbox:Inbox,schedule:Schedule,summary:Summary,plan:Plan,cover:Cover,income:Income,sales:Sales,sleep:Sleep,courses:Courses,english:English,fitness:Fitness,guitar:Guitar,emotion:Emotion,settings:Settings};
function App(){
 const [route,setRoute]=useState(()=>location.hash.slice(1)|| ((localStorage.getItem('xiaosong-entered')||localStorage.getItem('action-entered'))?'today':'cover')),[rows,setRows]=useState([]),[loaded,setLoaded]=useState(false),[dialog,setDialog]=useState(null),[toast,setToast]=useState(null),[syncText,setSyncText]=useState('仅保存在本机'),[theme,setTheme]=useState(localStorage.getItem('action-theme')||'light'),[owner,setOwner]=useState(db.getScope());
 const refresh=useCallback(async()=>{try{setRows(await db.records());setOwner(db.getScope());setLoaded(true);}catch{setToast({text:'无法读取本机数据库，请检查浏览器存储权限'});}},[]);
 useEffect(()=>{refresh();const off=db.subscribe(refresh);const hash=()=>{setRoute(location.hash.slice(1)||'today');window.scrollTo(0,0);setDialog(null);};window.addEventListener('hashchange',hash);return()=>{off();window.removeEventListener('hashchange',hash);};},[]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),5500);return()=>clearTimeout(timer);},[toast]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('action-theme',theme);},[theme]);
 useEffect(()=>{const off=watchSync(setSyncText);initNotifications().catch(()=>{});sync();const int=setInterval(sync,30000);const onVisible=()=>{if(!document.hidden){refresh();sync();}};window.addEventListener('online',sync);document.addEventListener('visibilitychange',onVisible);return()=>{off();clearInterval(int);window.removeEventListener('online',sync);document.removeEventListener('visibilitychange',onVisible);};},[]);
 const eventSignature=JSON.stringify(rows.filter(r=>r.kind==='event'));
 useEffect(()=>{scheduleEvents(JSON.parse(eventSignature)).catch(e=>notify('日程已保存，提醒未更新：'+e.message));},[eventSignature]);
 const notify=(text,undo)=>setToast({text,undo});
 const save=async(kind,data,id)=>{const result=await db.put(kind,data,id);sync();return result;};
 const remove=async id=>{await db.remove(id);notify('已移入回收站',async()=>{await db.restore(id);sync();});sync();};
 const edit=spec=>setDialog({...spec,key:owner+':'+spec.key});
 const capture=()=>edit({key:'capture',title:'先记下来',initial:{text:''},fields:[{...textField('text','想到什么？',{required:true}),type:'textarea'}],save:async v=>{await save('inbox',{...v,date:today(),status:'open'});notify('已放入收件箱');}});
 const list=kind=>rows.filter(r=>r.kind===kind);
 const ctx={rows,list,save,remove,edit,notify,refresh,theme,setTheme,syncText,owner,capture};
 const Page=pageMap[route]||Today;
 const full=route==='cover'||route==='focus';
 return <Context.Provider value={ctx}><div className={full?'app full':'app'}>{!full&&<><aside className="sidebar"><Link to="today" className="brand"><img src="./logo.jpg" alt="松鹤 Logo"/><span>小松工作台<em>PERSONAL WORKBENCH</em></span></Link><button className="capture-button" onClick={capture}><Icon name="Plus"/>快速记录 <kbd>＋</kbd></button><nav className="side-nav" aria-label="主导航">{mainNav.map(([id,label,icon])=><Link key={id} to={id} className={route===id?'active':''}><Icon name={icon}/>{label}{id==='today'&&<small>01</small>}</Link>)}<Link to="inbox" className={route==='inbox'?'active':''}><Icon name="Inbox"/>收件箱<small>{list('inbox').filter(r=>r.status==='open').length||''}</small></Link><Link to="schedule" className={route==='schedule'?'active':''}><Icon name="CalendarDays"/>日程</Link><p className="nav-label">我的主线 / LIFELINES</p>{STREAMS.map(s=><Link key={s.id} to={s.id} className={route===s.id?'active':''}><Icon name={s.icon}/>{s.name}</Link>)}</nav><div className="sidebar-bottom"><Link to="summary"><Icon name="NotebookPen"/>每日小结</Link><Link to="settings"><Icon name="Settings2"/>设置与同步</Link><p><i className="status-dot"/>{syncText}</p></div></aside><div className="topbar"><span className="topbar-path">小松工作台 <i>/</i> {STREAMS.find(s=>s.id===route)?.name||mainNav.find(s=>s[0]===route)?.[1]||'我的空间'}</span><Link className="mobile-brand" to="today"><img src="./logo.jpg" alt="松鹤"/>小松</Link><div className="topbar-actions"><span className="desktop-only">{today().replaceAll('-',' / ')}</span><button className="icon-button" onClick={capture} aria-label="快速记录"><Icon name="Plus"/></button><Link to="settings" className="avatar" aria-label="设置">Y</Link></div></div></>}<main id="main" className="main">{loaded?<Page/>:<div className="loading">正在打开你的工作台…</div>}</main>{!full&&<nav className="bottom-nav" aria-label="手机导航">{[...mainNav,['more','更多','Grid2X2']].map(([id,label,icon])=><Link to={id} key={id} className={(route===id||id==='more'&&!mainNav.some(n=>n[0]===route))?'active':''}><Icon name={icon}/><span>{label}</span></Link>)}</nav>}{dialog&&<FormDialog key={dialog.key} spec={dialog} onClose={()=>setDialog(null)}/>} {toast&&<div className="toast" role="status"><Icon name="Check"/>{toast.text}{toast.undo&&<button onClick={async()=>{await toast.undo();setToast(null);}}>撤销</button>}</div>}</div></Context.Provider>;
}
class ErrorBoundary extends React.Component{state={error:false};static getDerivedStateFromError(){return{error:true};}render(){return this.state.error?<div className="fatal"><h1>页面暂时无法打开</h1><p>记录仍保留在本机。刷新后再试一次。</p><button onClick={()=>location.reload()}>重新打开</button></div>:this.props.children;}}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);

