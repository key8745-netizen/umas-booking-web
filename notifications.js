// notifications.js — 兀瑪斯農莊通知中心
// 所有頁面引入此檔案即可使用通知功能

import { getFirestore, collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, serverTimestamp, writeBatch, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const NOTIF_CSS = `
#notif-fab{position:fixed;z-index:99999;width:48px;height:48px;border-radius:50%;background:#1a1a1a;color:#fff;border:none;cursor:move;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 4px 16px rgba(0,0,0,0.2);user-select:none;touch-action:none;transition:box-shadow 0.15s;}
@media(max-width:768px){#notif-fab{bottom:76px!important;width:44px;height:44px;font-size:18px;}}
#notif-fab:hover{box-shadow:0 6px 20px rgba(0,0,0,0.3);}
#notif-badge{position:absolute;top:-4px;right:-4px;background:#b94040;color:#fff;border-radius:999px;font-size:10px;font-weight:600;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;padding:0 4px;display:none;}
#notif-panel{position:fixed;z-index:99998;background:#fff;border-radius:16px;border:0.5px solid #e8e4de;box-shadow:0 8px 32px rgba(0,0,0,0.14);width:320px;max-height:480px;display:none;flex-direction:column;overflow:hidden;}
#notif-panel.open{display:flex;}
#notif-header{padding:14px 16px;border-bottom:0.5px solid #f0ece6;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
#notif-title{font-family:'Noto Serif TC',serif;font-size:14px;font-weight:400;letter-spacing:0.04em;}
#notif-actions{display:flex;gap:8px;}
.notif-action-btn{font-size:11px;color:#888;background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:5px;}
.notif-action-btn:hover{background:#f7f5f2;color:#1a1a1a;}
#notif-list{overflow-y:auto;flex:1;}
#notif-list::-webkit-scrollbar{width:3px;}
#notif-list::-webkit-scrollbar-thumb{background:#e8e4de;border-radius:2px;}
.notif-item{padding:12px 16px;border-bottom:0.5px solid #f7f5f2;cursor:pointer;display:flex;gap:10px;align-items:flex-start;transition:background 0.1s;}
.notif-item:hover{background:#fafaf8;}
.notif-item.unread{background:#f7f5f2;}
.notif-item.unread:hover{background:#f0ece6;}
.notif-icon{font-size:18px;flex-shrink:0;margin-top:1px;}
.notif-body{flex:1;min-width:0;}
.notif-msg{font-size:12px;color:#1a1a1a;line-height:1.5;margin-bottom:3px;}
.notif-item.unread .notif-msg{font-weight:500;}
.notif-time{font-size:10px;color:#bbb;}
.notif-dot{width:6px;height:6px;border-radius:50%;background:#b94040;flex-shrink:0;margin-top:5px;}
#notif-empty{padding:32px 16px;text-align:center;font-size:12px;color:#bbb;}
@media(max-width:768px){#notif-panel{width:calc(100vw - 32px);max-width:320px;}}
`;

const NOTIF_ICONS = {
  checkin:    '📅',
  checkout:   '👋',
  deposit:    '💰',
  balance:    '💳',
  pending:    '⚠️',
  arrival:    '🚗',
  deposit_msg:'💬',
  general:    '🔔',
};

export function initNotifications(db) {
  // 注入 CSS
  if (!document.getElementById('notif-style')) {
    const style = document.createElement('style');
    style.id = 'notif-style';
    style.textContent = NOTIF_CSS;
    document.head.appendChild(style);
  }

  // 建立浮動鈴鐺
  const fab = document.createElement('button');
  fab.id = 'notif-fab';
  fab.innerHTML = `🔔<span id="notif-badge"></span>`;
  fab.style.bottom = (window.innerWidth <= 768 ? '76px' : '80px');
  fab.style.right = '16px';
  fab.style.right = '20px';
  document.body.appendChild(fab);

  // 建立通知面板
  const panel = document.createElement('div');
  panel.id = 'notif-panel';
  panel.innerHTML = `
    <div id="notif-header">
      <span id="notif-title">通知中心</span>
      <div id="notif-actions">
        <button class="notif-action-btn" onclick="window.__notifMarkAll()">全部已讀</button>
        <button class="notif-action-btn" onclick="window.__notifClearAll()">清除全部</button>
        <button class="notif-action-btn" onclick="window.__notifClose()">✕</button>
      </div>
    </div>
    <div id="notif-list"><div id="notif-empty">目前沒有通知</div></div>
  `;
  document.body.appendChild(panel);

  // 面板位置跟著 fab
  function positionPanel() {
    const fabRect = fab.getBoundingClientRect();
    const pw = 320;
    let left = fabRect.right - pw;
    let top = fabRect.top - 10;
    if (left < 8) left = 8;
    if (top + 480 > window.innerHeight - 8) top = window.innerHeight - 488;
    if (top < 8) top = 8;
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  }

  // 開關面板
  fab.addEventListener('click', e => {
    if (fab._dragged) return;
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) positionPanel();
  });

  window.__notifClose = () => panel.classList.remove('open');

  // 拖移 fab
  let isDragging = false, startX, startY, origX, origY;
  fab.addEventListener('mousedown', e => {
    fab._dragged = false;
    isDragging = true;
    startX = e.clientX; startY = e.clientY;
    origX = fab.getBoundingClientRect().left;
    origY = fab.getBoundingClientRect().top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) fab._dragged = true;
    const newLeft = Math.max(8, Math.min(window.innerWidth - 56, origX + dx));
    const newTop = Math.max(8, Math.min(window.innerHeight - 56, origY + dy));
    fab.style.left = newLeft + 'px'; fab.style.top = newTop + 'px';
    fab.style.right = 'auto'; fab.style.bottom = 'auto';
    if (panel.classList.contains('open')) positionPanel();
  });
  document.addEventListener('mouseup', () => { isDragging = false; });

  // 觸控拖移
  fab.addEventListener('touchstart', e => {
    fab._dragged = false;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    origX = fab.getBoundingClientRect().left;
    origY = fab.getBoundingClientRect().top;
  }, { passive: true });
  fab.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) fab._dragged = true;
    const newLeft = Math.max(8, Math.min(window.innerWidth - 56, origX + dx));
    const newTop = Math.max(8, Math.min(window.innerHeight - 56, origY + dy));
    fab.style.left = newLeft + 'px'; fab.style.top = newTop + 'px';
    fab.style.right = 'auto'; fab.style.bottom = 'auto';
    if (panel.classList.contains('open')) positionPanel();
  }, { passive: true });
  fab.addEventListener('touchend', e => {
    if (!fab._dragged) {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) positionPanel();
    }
  });

  // 記住位置
  const savedPos = JSON.parse(localStorage.getItem('notif_fab_pos') || 'null');
  if (savedPos) {
    fab.style.left = savedPos.x + 'px'; fab.style.top = savedPos.y + 'px';
    fab.style.right = 'auto'; fab.style.bottom = 'auto';
  }
  document.addEventListener('mouseup', () => {
    if (fab.style.left) {
      localStorage.setItem('notif_fab_pos', JSON.stringify({ x: parseInt(fab.style.left), y: parseInt(fab.style.top) }));
    }
  });

  // 監聽 Firebase 通知
  let notifications = [];
  onSnapshot(
    query(collection(db, 'notifications'), orderBy('createdAt', 'desc')),
    snapshot => {
      notifications = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderNotifications(notifications);
    }
  );

  function renderNotifications(notifs) {
    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');
    const unreadCount = notifs.filter(n => !n.read).length;

    if (unreadCount > 0) {
      badge.style.display = 'flex';
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    } else {
      badge.style.display = 'none';
    }

    if (!notifs.length) {
      list.innerHTML = '<div id="notif-empty">目前沒有通知</div>';
      return;
    }

    list.innerHTML = notifs.slice(0, 50).map(n => {
      const icon = NOTIF_ICONS[n.type] || '🔔';
      const time = n.createdAt?.toDate ? fmtTimeAgo(n.createdAt.toDate()) : '';
      return `<div class="notif-item${n.read ? '' : ' unread'}" onclick="window.__notifClick('${n.id}','${n.link||''}')">
        <div class="notif-icon">${icon}</div>
        <div class="notif-body">
          <div class="notif-msg">${n.message}</div>
          <div class="notif-time">${time}</div>
        </div>
        ${!n.read ? '<div class="notif-dot"></div>' : ''}
      </div>`;
    }).join('');
  }

  window.__notifClick = async (id, link) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
    panel.classList.remove('open');
    if (link) window.location.href = link;
  };

  window.__notifMarkAll = async () => {
    const batch = writeBatch(db);
    const snap = await getDocs(collection(db, 'notifications'));
    snap.docs.filter(d => !d.data().read).forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
  };

  window.__notifClearAll = async () => {
    if (!confirm('確定清除所有通知？')) return;
    const batch = writeBatch(db);
    const snap = await getDocs(collection(db, 'notifications'));
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  };

  function fmtTimeAgo(date) {
    const diff = Math.floor((Date.now() - date) / 1000);
    if (diff < 60) return '剛剛';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分鐘前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小時前';
    return Math.floor(diff / 86400) + ' 天前';
  }

  // 回傳 addNotification 函式供各頁面使用
  return async function addNotification({ type = 'general', message, link = '' }) {
    await addDoc(collection(db, 'notifications'), {
      type, message, link, read: false, createdAt: serverTimestamp()
    });
  };
}

// 自動產生每日提醒（在主控板/控房載入時呼叫）
export async function generateDailyReminders(db, bookings) {
  const today = new Date().toISOString().slice(0, 10);
  const todayKey = `reminders_${today}`;
  if (localStorage.getItem(todayKey)) return; // 今天已產生過
  localStorage.setItem(todayKey, '1');

  function addDays(ds, n) { const d = new Date(ds + 'T00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

  const reminders = [];

  bookings.forEach(b => {
    if (!b.name) return;
    const rooms = Array.isArray(b.roomtype) ? b.roomtype.join('、') : (b.roomtype || '—');

    // 今日入住
    if (b.checkin === today && ['confirmed', 'week-check'].includes(b.status)) {
      reminders.push({ type: 'checkin', message: `📅 今日入住：${b.name}（${rooms}）`, link: 'checkin.html' });
    }
    // 今日退房
    const co = b.checkout || (b.checkin && b.nights ? addDays(b.checkin, parseInt(b.nights) || 1) : null);
    if (co === today && b.status === 'checkin') {
      reminders.push({ type: 'checkout', message: `👋 今日退房：${b.name}（${rooms}）`, link: 'checkin.html' });
    }
    // 3天內入住但訂金未收
    const daysToCheckin = b.checkin ? Math.floor((new Date(b.checkin + 'T00:00') - new Date()) / 86400000) : 999;
    if (daysToCheckin >= 0 && daysToCheckin <= 3 && !parseFloat(b.deposit) && ['confirmed', 'week-check'].includes(b.status)) {
      reminders.push({ type: 'deposit', message: `💰 ${b.name} 距入住 ${daysToCheckin} 天，訂金尚未收到`, link: 'index.html' });
    }
    // 已退房但尾款未收
    if (co && co < today && parseFloat(b.due) > 0 && b.status === 'closed') {
      reminders.push({ type: 'balance', message: `💳 ${b.name} 已退房，尾款 NT$${parseFloat(b.due).toLocaleString()} 未收`, link: 'orders.html' });
    }
    // 新接案超過 3 天未處理
    if (b.status === 'new-case' && b.createdAt) {
      const created = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      const daysSince = Math.floor((Date.now() - created) / 86400000);
      if (daysSince >= 3) {
        reminders.push({ type: 'pending', message: `⚠️ ${b.name} 的訂單已建立 ${daysSince} 天，仍在「新接案」`, link: 'index.html' });
      }
    }
  });

  // 批次寫入
  const { writeBatch, doc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  if (reminders.length) {
    const batch = writeBatch(db);
    reminders.forEach(r => {
      const ref = doc(collection(db, 'notifications'));
      batch.set(ref, { ...r, read: false, createdAt: serverTimestamp() });
    });
    await batch.commit();
  }
}
