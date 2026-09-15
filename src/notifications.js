import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
export const native=Capacitor.isNativePlatform();
export async function enableReminders(time='22:00'){
 if(!native)throw new Error('定时锁屏提醒请在安卓应用中开启。网页关闭后不能可靠地定时通知。');
 const permissions=await LocalNotifications.requestPermissions();if(permissions.display!=='granted')throw new Error('通知权限未开启，请在手机设置中允许 action 发送通知');
 await LocalNotifications.createChannel({id:'action-reminders',name:'行动提醒',description:'晚间复盘与固定日程',importance:4,visibility:0});
 const[hour,minute]=time.split(':').map(Number);
 await LocalNotifications.cancel({notifications:[{id:1}]});
 await LocalNotifications.schedule({notifications:[{id:1,title:'action · 给今天一个收尾',body:'回顾今天，安排明天最重要的事。',channelId:'action-reminders',schedule:{on:{hour,minute},repeats:true,allowWhileIdle:true},extra:{route:'summary'}}]});
 localStorage.setItem('action-reminder',time);
 const exact=await LocalNotifications.checkExactNotificationSetting();
 return exact.exact_alarm==='granted'?'晚间提醒已开启':'晚间提醒已开启；系统可能延迟，可在设置中允许精确提醒';
}
export async function disableReminders(){if(native)await LocalNotifications.cancel({notifications:[{id:1}]});localStorage.removeItem('action-reminder');}
export async function exactSettings(){if(native)await LocalNotifications.changeExactNotificationSetting();}
export async function notificationTest(){if(!native)throw new Error('请在安卓应用中测试通知');if((await LocalNotifications.checkPermissions()).display!=='granted')throw new Error('请先开启晚间提醒');await LocalNotifications.schedule({notifications:[{id:2,title:'action · 通知测试',body:'点这里打开每日小结。',channelId:'action-reminders',schedule:{at:new Date(Date.now()+10000),allowWhileIdle:true},extra:{route:'summary'}}]});}
export async function initNotifications(){if(!native)return;await LocalNotifications.addListener('localNotificationActionPerformed',event=>{location.hash=event.notification.extra?.route||'today';});await App.addListener('backButton',({canGoBack})=>{if(document.querySelector('dialog[open]')){document.querySelector('dialog[open]').dispatchEvent(new Event('cancel',{cancelable:true}));}else if(location.hash!=='#today'){location.hash='today';}else if(canGoBack)history.back();else App.minimizeApp();});}
export async function scheduleEvents(events){if(!native||!localStorage.getItem('action-reminder'))return;const{notifications}=await LocalNotifications.getPending();const existing=notifications.filter(n=>n.id>=1000);if(existing.length)await LocalNotifications.cancel({notifications:existing});const future=events.filter(e=>!e.cancelled&&Date.parse(e.start+'+08:00')>Date.now()).slice(0,60);if(future.length)await LocalNotifications.schedule({notifications:future.map((e,i)=>({id:1000+i,title:'action · 约定的时间到了',body:'打开工作台，查看接下来的安排。',channelId:'action-reminders',schedule:{at:new Date(e.start+'+08:00'),allowWhileIdle:true},extra:{route:'schedule'}}))});}
