// notifications.js — 兀瑪斯農莊通知中心

import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, serverTimestamp, writeBatch, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const NOTIF_CSS = `
@keyframes bellWiggle{0%{transform:rotate(0)}15%{transform:rotate(18deg)}30%{transform:rotate(-15deg)}45%{transform:rotate(12deg)}60%{transform:rotate(-8deg)}75%{transform:rotate(4deg)}100%{transform:rotate(0)}}
@keyframes bellPop{0%{transform:scale(1)}40%{transform:scale(1.25)}70%{transform:scale(0.92)}100%{transform:scale(1)}}
@keyframes bellBounce{0%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}70%{transform:translateY(2px)}}
@keyframes eyeBlink{0%,90%,100%{transform:scaleY(1)}95%{transform:scaleY(0.1)}}
@keyframes badgePop{0%{transform:scale(0)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
@keyframes panelSlide{0%{opacity:0;transform:translateY(10px) scale(0.96)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes notifSlideIn{0%{opacity:0;transform:translateX(8px)}100%{opacity:1;transform:translateX(0)}}
@keyframes eyesLook{0%,100%{transform:translateX(0)}50%{transform:translateX(2px)}}
@keyframes fabWobble{0%,100%{transform:scale(1) rotate(0)}25%{transform:scale(1.08) rotate(-3deg)}75%{transform:scale(1.08) rotate(3deg)}}

#notif-fab{
  position:fixed;z-index:99999;width:52px;height:52px;border-radius:50%;
  background:linear-gradient(135deg,#2a2a2a 0%,#1a1a1a 100%);
  border:none;cursor:pointer;user-select:none;touch-action:none;
  box-shadow:0 4px 20px rgba(0,0,0,0.25),0 2px 6px rgba(0,0,0,0.15);
  transition:box-shadow 0.2s;
  display:flex;align-items:center;justify-content:center;
  overflow:visible;
}
#notif-fab:hover{box-shadow:0 6px 24px rgba(0,0,0,0.32);}
#notif-fab.has-notif{animation:fabWobble 2.4s ease-in-out infinite;}
#notif-fab.wiggle{animation:bellWiggle 0.6s ease forwards!important;}
#notif-fab.pop{animation:bellPop 0.35s ease forwards!important;}
#notif-fab.bounce{animation:bellBounce 0.4s ease forwards!important;}

#fab-face{
  width:34px;height:34px;position:relative;
  display:flex;align-items:center;justify-content:center;
  flex-direction:column;gap:1px;
}
#fab-bell{font-size:22px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));transition:transform 0.2s;}
#fab-eyes{
  position:absolute;bottom:2px;left:50%;transform:translateX(-50%);
  display:flex;gap:4px;align-items:center;
}
.fab-eye{
  width:5px;height:5px;border-radius:50%;background:#fff;
  animation:eyeBlink 3.5s ease-in-out infinite;
  transition:transform 0.15s;
}
.fab-eye.left{animation-delay:0s;}
.fab-eye.right{animation-delay:0.08s;}
#fab-mouth{
  position:absolute;bottom:-1px;left:50%;transform:translateX(-50%);
  width:8px;height:4px;border-bottom:2px solid rgba(255,255,255,0.7);
  border-radius:0 0 6px 6px;transition:all 0.2s;
}
#fab-mouth.excited{border-bottom:none;border-top:2px solid rgba(255,255,255,0.7);border-radius:6px 6px 0 0;bottom:1px;}
#fab-mouth.nervous{
  width:6px;border-bottom:2px solid rgba(255,255,255,0.5);
  border-radius:0;transform:translateX(-50%) rotate(-5deg);
}

#notif-badge{
  position:absolute;top:-3px;right:-3px;
  background:linear-gradient(135deg,#e05050,#b94040);
  color:#fff;border-radius:999px;font-size:9px;font-weight:700;
  min-width:17px;height:17px;
  display:none;align-items:center;justify-content:center;padding:0 3px;
  box-shadow:0 2px 6px rgba(185,64,64,0.5);
  border:1.5px solid #1a1a1a;
  animation:badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;
}

#notif-panel{
  position:fixed;z-index:99998;background:#fff;
  border-radius:18px;border:0.5px solid #e8e4de;
  box-shadow:0 12px 40px rgba(0,0,0,0.16),0 4px 12px rgba(0,0,0,0.08);
  width:320px;max-height:500px;display:none;flex-direction:column;overflow:hidden;
}
#notif-panel.open{display:flex;animation:panelSlide 0.25s cubic-bezier(0.34,1.2,0.64,1);}

#notif-header{
  padding:14px 16px 12px;
  border-bottom:0.5px solid #f0ece6;
  display:flex;align-items:center;justify-content:space-between;
  flex-shrink:0;background:#fafaf8;
}
#notif-header-left{display:flex;align-items:center;gap:8px;}
#notif-mascot{font-size:18px;animation:bellWiggle 2s ease-in-out infinite;}
#notif-title{font-family:'Noto Serif TC',serif;font-size:13px;font-weight:400;letter-spacing:0.04em;}
#notif-subtitle{font-size:10px;color:#bbb;margin-top:1px;}
#notif-actions{display:flex;gap:4px;}
.notif-action-btn{font-size:10px;color:#aaa;background:none;border:0.5px solid #e8e4de;cursor:pointer;padding:3px 7px;border-radius:6px;transition:all 0.1s;}
.notif-action-btn:hover{background:#f0ece6;color:#1a1a1a;border-color:#ccc;}

#notif-list{overflow-y:auto;flex:1;}
#notif-list::-webkit-scrollbar{width:3px;}
#notif-list::-webkit-scrollbar-thumb{background:#e8e4de;border-radius:2px;}

.notif-item{
  padding:11px 14px;border-bottom:0.5px solid #f7f5f2;
  cursor:pointer;display:flex;gap:10px;align-items:flex-start;
  transition:background 0.1s;
  animation:notifSlideIn 0.2s ease both;
}
.notif-item:hover{background:#fafaf8;}
.notif-item.unread{background:#f7f5f2;}
.notif-item.unread:hover{background:#f0ece6;}
.notif-icon{font-size:18px;flex-shrink:0;margin-top:1px;}
.notif-body{flex:1;min-width:0;}
.notif-msg{font-size:11.5px;color:#1a1a1a;line-height:1.55;margin-bottom:3px;}
.notif-item.unread .notif-msg{font-weight:500;}
.notif-time{font-size:10px;color:#ccc;}
.notif-dot{width:6px;height:6px;border-radius:50%;background:#e05050;flex-shrink:0;margin-top:5px;flex-shrink:0;}

#notif-empty{
  padding:36px 16px;text-align:center;
  font-size:22px;color:#ddd;
  display:flex;flex-direction:column;align-items:center;gap:8px;
}
#notif-empty-text{font-size:12px;color:#ccc;}

@media(max-width:768px){
  #notif-fab{width:46px;height:46px;bottom:76px!important;}
  #fab-bell{font-size:20px;}
  #notif-panel{width:calc(100vw - 28px);max-width:340px;}
}
`;

const NOTIF_ICONS = {
  checkin:    '📅', checkout:'👋', deposit:'💰',
  balance:    '💳', pending:'⚠️', arrival:'🚗',
  deposit_msg:'💬', general:'🔔',
};

// 依通知類型決定小傢伙的表情
const FACE_MOOD = {
  checkin:    'excited',  // 今日入住 → 開心
  checkout:   'happy',
  deposit:    'nervous',  // 錢的事 → 緊張
  balance:    'nervous',
  pending:    'nervous',
  arrival:    'excited',
  deposit_msg:'excited',
  general:    'normal',
};

export function initNotifications(db) {
  if (!document.getElementById('notif-style')) {
    const style = document.createElement('style');
    style.id = 'notif-style';
    style.textContent = NOTIF_CSS;
    document.head.appendChild(style);
  }

  // 建立浮動鈴鐺
  const fab = document.createElement('button');
  fab.id = 'notif-fab';
  fab.innerHTML = `
    <div id="fab-face">
      <div id="fab-bell">🔔</div>
      <div id="fab-eyes">
        <div class="fab-eye left"></div>
        <div class="fab-eye right"></div>
      </div>
      <div id="fab-mouth"></div>
    </div>
    <span id="notif-badge"></span>`;
  fab.style.bottom = (window.innerWidth <= 768 ? '76px' : '80px');
  fab.style.right = '16px';
  document.body.appendChild(fab);

  // 建立通知面板
  const panel = document.createElement('div');
  panel.id = 'notif-panel';
  panel.innerHTML = `
    <div id="notif-header">
      <div id="notif-header-left">
        <span id="notif-mascot">🔔</span>
        <div>
          <div id="notif-title">通知中心</div>
          <div id="notif-subtitle">載入中...</div>
        </div>
      </div>
      <div id="notif-actions">
        <button class="notif-action-btn" onclick="window.__notifMarkAll()">全讀</button>
        <button class="notif-action-btn" onclick="window.__notifClearAll()">清除</button>
        <button class="notif-action-btn" onclick="window.__notifClose()">✕</button>
      </div>
    </div>
    <div id="notif-list"><div id="notif-empty">😴<div id="notif-empty-text">目前沒有通知，好清靜～</div></div></div>
  `;
  document.body.appendChild(panel);

  // 臉部動畫輔助
  function setMood(mood){
    const mouth = document.getElementById('fab-mouth');
    const eyes = document.querySelectorAll('.fab-eye');
    if(!mouth) return;
    mouth.className = '';
    if(mood === 'excited'){
      mouth.classList.add('excited');
      eyes.forEach(e=>{e.style.transform='scale(1.2)';});
    } else if(mood === 'nervous'){
      mouth.classList.add('nervous');
      eyes.forEach(e=>{e.style.width='4px';e.style.height='6px';e.style.borderRadius='2px';});
    } else {
      eyes.forEach(e=>{e.style.width='';e.style.height='';e.style.borderRadius='';e.style.transform='';});
    }
  }

  function animateFab(type){
    fab.classList.remove('wiggle','pop','bounce');
    void fab.offsetWidth; // reflow
    fab.classList.add(type);
    setTimeout(()=>fab.classList.remove(type), 700);
  }

  // 面板位置
  function positionPanel(){
    const fabRect = fab.getBoundingClientRect();
    const pw = Math.min(320, window.innerWidth - 28);
    let left = fabRect.right - pw;
    let top = fabRect.top - 10;
    if(left < 8) left = 8;
    if(top + 500 > window.innerHeight - 8) top = window.innerHeight - 508;
    if(top < 8) top = 8;
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.width = pw + 'px';
  }

  // 點擊開關
  fab.addEventListener('click', e => {
    if(fab._dragged) return;
    const opening = !panel.classList.contains('open');
    panel.classList.toggle('open');
    if(opening){
      positionPanel();
      animateFab('pop');
      setMood('normal');
    }
  });

  window.__notifClose = () => {
    panel.classList.remove('open');
    animateFab('bounce');
  };

  // 拖曳
  let isDragging=false, startX, startY, origX, origY;

  fab.addEventListener('mousedown', e=>{
    fab._dragged = false;
    isDragging = true;
    startX=e.clientX; startY=e.clientY;
    origX=fab.getBoundingClientRect().left;
    origY=fab.getBoundingClientRect().top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e=>{
    if(!isDragging) return;
    const dx=e.clientX-startX, dy=e.clientY-startY;
    if(Math.abs(dx)>4||Math.abs(dy)>4) fab._dragged=true;
    const nx=Math.max(8, Math.min(window.innerWidth-58, origX+dx));
    const ny=Math.max(8, Math.min(window.innerHeight-58, origY+dy));
    fab.style.left=nx+'px'; fab.style.top=ny+'px';
    fab.style.right='auto'; fab.style.bottom='auto';
    if(panel.classList.contains('open')) positionPanel();
  });
  document.addEventListener('mouseup', ()=>{
    if(isDragging && fab._dragged) saveFabPos();
    isDragging=false;
  });

  fab.addEventListener('touchstart', e=>{
    fab._dragged=false;
    startX=e.touches[0].clientX; startY=e.touches[0].clientY;
    origX=fab.getBoundingClientRect().left;
    origY=fab.getBoundingClientRect().top;
  },{passive:true});
  fab.addEventListener('touchmove', e=>{
    const dx=e.touches[0].clientX-startX, dy=e.touches[0].clientY-startY;
    if(Math.abs(dx)>6||Math.abs(dy)>6) fab._dragged=true;
    const nx=Math.max(8,Math.min(window.innerWidth-58,origX+dx));
    const ny=Math.max(8,Math.min(window.innerHeight-58,origY+dy));
    fab.style.left=nx+'px'; fab.style.top=ny+'px';
    fab.style.right='auto'; fab.style.bottom='auto';
    if(panel.classList.contains('open')) positionPanel();
  },{passive:true});
  fab.addEventListener('touchend', e=>{
    if(fab._dragged){ saveFabPos(); return; }
    const opening=!panel.classList.contains('open');
    panel.classList.toggle('open');
    if(opening){ positionPanel(); animateFab('pop'); setMood('normal'); }
  });

  function saveFabPos(){
    if(fab.style.left) localStorage.setItem('notif_pos',JSON.stringify({x:parseInt(fab.style.left),y:parseInt(fab.style.top)}));
  }

  // 還原位置
  const saved=JSON.parse(localStorage.getItem('notif_pos')||'null');
  if(saved){ fab.style.left=saved.x+'px'; fab.style.top=saved.y+'px'; fab.style.right='auto'; fab.style.bottom='auto'; }

  // 監聽通知
  let prevCount = 0;
  let notifications = [];

  onSnapshot(
    query(collection(db,'notifications'), orderBy('createdAt','desc')),
    snapshot => {
      notifications = snapshot.docs.map(d=>({id:d.id,...d.data()}));
      const unread = notifications.filter(n=>!n.read).length;

      // 新通知進來 → 小傢伙反應
      if(unread > prevCount && prevCount >= 0){
        animateFab('wiggle');
        const newest = notifications[0];
        const mood = newest ? (FACE_MOOD[newest.type]||'normal') : 'normal';
        setMood(mood);
        fab.classList.add('has-notif');
        setTimeout(()=>setMood('normal'), 3000);
      } else if(unread === 0){
        fab.classList.remove('has-notif');
        setMood('normal');
      }
      prevCount = unread;

      renderNotifications(notifications);
    }
  );

  function renderNotifications(notifs){
    const badge = document.getElementById('notif-badge');
    const sub = document.getElementById('notif-subtitle');
    const mascot = document.getElementById('notif-mascot');
    const unread = notifs.filter(n=>!n.read).length;

    if(unread > 0){
      badge.style.display='flex';
      badge.textContent = unread > 99 ? '99+' : unread;
      if(sub) sub.textContent = `${unread} 則未讀`;
      if(mascot) mascot.textContent = unread > 3 ? '😰' : '😮';
    } else {
      badge.style.display='none';
      if(sub) sub.textContent = notifs.length ? '都讀完囉 👌' : '好清靜～';
      if(mascot) mascot.textContent = '😊';
    }

    const list = document.getElementById('notif-list');
    if(!notifs.length){
      list.innerHTML='<div id="notif-empty">😴<div id="notif-empty-text">目前沒有通知，好清靜～</div></div>';
      return;
    }

    list.innerHTML = notifs.slice(0,50).map((n,i)=>{
      const icon = NOTIF_ICONS[n.type]||'🔔';
      const time = n.createdAt?.toDate ? fmtAgo(n.createdAt.toDate()) : '';
      return `<div class="notif-item${n.read?'':' unread'}" style="animation-delay:${i*0.03}s" onclick="window.__notifClick('${n.id}','${n.link||''}')">
        <div class="notif-icon">${icon}</div>
        <div class="notif-body">
          <div class="notif-msg">${n.message}</div>
          <div class="notif-time">${time}</div>
        </div>
        ${!n.read?'<div class="notif-dot"></div>':''}
      </div>`;
    }).join('');
  }

  window.__notifClick = async(id, link)=>{
    await updateDoc(doc(db,'notifications',id),{read:true});
    panel.classList.remove('open');
    animateFab('bounce');
    if(link) window.location.href=link;
  };
  window.__notifMarkAll = async()=>{
    const batch=writeBatch(db);
    const snap=await getDocs(collection(db,'notifications'));
    snap.docs.filter(d=>!d.data().read).forEach(d=>batch.update(d.ref,{read:true}));
    await batch.commit();
    animateFab('pop');
    setMood('excited');
    setTimeout(()=>setMood('normal'),2000);
  };
  window.__notifClearAll = async()=>{
    if(!confirm('確定清除所有通知？')) return;
    const batch=writeBatch(db);
    const snap=await getDocs(collection(db,'notifications'));
    snap.docs.forEach(d=>batch.delete(d.ref));
    await batch.commit();
  };

  function fmtAgo(date){
    const s=Math.floor((Date.now()-date)/1000);
    if(s<60) return '剛剛';
    if(s<3600) return Math.floor(s/60)+' 分鐘前';
    if(s<86400) return Math.floor(s/3600)+' 小時前';
    return Math.floor(s/86400)+' 天前';
  }

  return async function addNotification({type='general', message, link=''}){
    await addDoc(collection(db,'notifications'),{
      type, message, link, read:false, createdAt:serverTimestamp()
    });
  };
}

export async function generateDailyReminders(db, bookings){
  const today=new Date().toISOString().slice(0,10);
  const key=`reminders_${today}`;
  if(localStorage.getItem(key)) return;
  localStorage.setItem(key,'1');

  function addDays(ds,n){const d=new Date(ds+'T00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}

  const reminders=[];
  bookings.forEach(b=>{
    if(!b.name) return;
    const rooms=Array.isArray(b.roomtype)?b.roomtype.join('、'):(b.roomtype||'—');
    if(b.checkin===today&&['confirmed','week-check'].includes(b.status))
      reminders.push({type:'checkin',message:`📅 今日入住：${b.name}（${rooms}）`,link:'checkin.html'});
    const co=b.checkout||(b.checkin&&b.nights?addDays(b.checkin,parseInt(b.nights)||1):null);
    if(co===today&&b.status==='checkin')
      reminders.push({type:'checkout',message:`👋 今日退房：${b.name}（${rooms}）`,link:'checkin.html'});
    const daysTo=b.checkin?Math.floor((new Date(b.checkin+'T00:00')-new Date())/86400000):999;
    if(daysTo>=0&&daysTo<=3&&!parseFloat(b.deposit)&&['confirmed','week-check'].includes(b.status))
      reminders.push({type:'deposit',message:`💰 ${b.name} 距入住 ${daysTo} 天，訂金尚未收到`,link:'index.html'});
    if(co&&co<today&&parseFloat(b.due)>0&&b.status==='closed')
      reminders.push({type:'balance',message:`💳 ${b.name} 已退房，尾款 NT$${parseFloat(b.due).toLocaleString()} 未收`,link:'orders.html'});
    if(b.status==='new-case'&&b.createdAt){
      const created=b.createdAt.toDate?b.createdAt.toDate():new Date(b.createdAt);
      const days=Math.floor((Date.now()-created)/86400000);
      if(days>=3) reminders.push({type:'pending',message:`⚠️ ${b.name} 的訂單已建立 ${days} 天，仍在「新接案」`,link:'index.html'});
    }
  });

  if(reminders.length){
    const {writeBatch,doc,collection,serverTimestamp}=await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const batch=writeBatch(db);
    reminders.forEach(r=>{
      const ref=doc(collection(db,'notifications'));
      batch.set(ref,{...r,read:false,createdAt:serverTimestamp()});
    });
    await batch.commit();
  }
}
