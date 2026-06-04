// ============================================================
// NindraSync — app.js  (Frontend JavaScript)
// All localStorage replaced with real API calls to server.js
// ============================================================

const API = 'http://localhost:3000/api';

// ─── Token helpers ─────────────────────────────────────────
function getToken()        { return localStorage.getItem('ns_token'); }
function setToken(t)       { localStorage.setItem('ns_token', t); }
function clearToken()      { localStorage.removeItem('ns_token'); }
function getLocalUser()    { try{ return JSON.parse(localStorage.getItem('ns_user')); }catch{ return null; } }
function setLocalUser(u)   { localStorage.setItem('ns_user', JSON.stringify(u)); }
function clearLocalUser()  { localStorage.removeItem('ns_user'); }

// ─── API fetch wrapper ─────────────────────────────────────
async function apiFetch(path, method='GET', body=null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ============================================================
//  STARS GENERATOR (auth screen)
// ============================================================
(function(){
  const container = document.getElementById('starsContainer');
  if (!container) return;
  for (let i = 0; i < 80; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = Math.random()*3+1;
    star.style.cssText = `width:${size}px;height:${size}px;left:${Math.random()*100}%;top:${Math.random()*100}%;--dur:${Math.random()*3+2}s;animation-delay:${Math.random()*4}s;`;
    container.appendChild(star);
  }
})();

// ============================================================
//  AUTH
// ============================================================
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (i===0&&tab==='login')||(i===1&&tab==='signup'));
  });
  document.getElementById('loginForm').classList.toggle('active', tab==='login');
  document.getElementById('signupForm').classList.toggle('active', tab==='signup');
  hideAuthMessages();
}

function hideAuthMessages() {
  ['loginError','signupError','signupSuccess'].forEach(id => {
    document.getElementById(id).classList.remove('show');
  });
}

function togglePass(inputId, icon) {
  const inp = document.getElementById(inputId);
  if (inp.type==='password') { inp.type='text'; icon.className='input-toggle fa-regular fa-eye-slash'; }
  else { inp.type='password'; icon.className='input-toggle fa-regular fa-eye'; }
}

async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass  = document.getElementById('loginPass').value;
  const errEl  = document.getElementById('loginError');
  const errMsg = document.getElementById('loginErrMsg');

  if (!email || !pass) { errMsg.textContent='Please enter your email and password.'; errEl.classList.add('show'); return; }

  try {
    const data = await apiFetch('/auth/login', 'POST', { email, password: pass });
    setToken(data.token);
    setLocalUser(data.user);
    showApp();
  } catch (err) {
    errMsg.textContent = err.message;
    errEl.classList.add('show');
  }
}

async function handleSignup() {
  const firstName = document.getElementById('signupFirst').value.trim();
  const email     = document.getElementById('signupEmail').value.trim().toLowerCase();
  const pass      = document.getElementById('signupPass').value;
  const pass2     = document.getElementById('signupPass2').value;
  const errEl     = document.getElementById('signupError');
  const errMsg    = document.getElementById('signupErrMsg');
  const succEl    = document.getElementById('signupSuccess');

  hideAuthMessages();
  if (!firstName || !email || !pass) { errMsg.textContent='Please fill all fields.'; errEl.classList.add('show'); return; }
  if (pass.length < 6) { errMsg.textContent='Password must be at least 6 characters.'; errEl.classList.add('show'); return; }
  if (pass !== pass2)  { errMsg.textContent='Passwords do not match.'; errEl.classList.add('show'); return; }

  try {
    await apiFetch('/auth/signup', 'POST', { firstName, email, password: pass });
    succEl.classList.add('show');
    setTimeout(() => switchAuthTab('login'), 1500);
  } catch (err) {
    errMsg.textContent = err.message;
    errEl.classList.add('show');
  }
}

async function forgotPass() {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) { showToast('Enter your email first.', 'error'); return; }
  try {
    const data = await apiFetch('/auth/forgot-password', 'POST', { email });
    showToast(data.message, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
//  SHOW APP
// ============================================================
function showApp() {
  const user = getLocalUser();
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appScreen').classList.add('visible');

  if (user) {
    const name = `${user.firstName||''} ${user.lastName||''}`.trim();
    const initials = ((user.firstName||'')[0]||'') + ((user.lastName||'')[0]||'');
    document.getElementById('sidebarAvatar').textContent = initials.toUpperCase() || 'U';
    document.getElementById('sidebarName').textContent   = name || user.email;
    document.getElementById('settingsName').value  = name;
    document.getElementById('settingsEmail').value = user.email;
  }

  setupGreeting();
  setupNavigation();
  setupBarChart();
  renderHabits();
  renderSleepLogs();
  loadMoodState();
  calcDuration();
}

function handleLogout() {
  clearToken();
  clearLocalUser();
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appScreen').classList.remove('visible');
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPass').value  = '';
  hideAuthMessages();
}

// ============================================================
//  NAVIGATION
// ============================================================
function setupNavigation() {
  const today = new Date().toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
  const el = document.getElementById('todayDate');
  if (el) el.textContent = today;

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.page);
    });
  });
}

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  const pageEl  = document.getElementById('page-' + page);
  if (navItem) navItem.classList.add('active');
  if (pageEl)  pageEl.classList.add('active');
}

// ============================================================
//  GREETING
// ============================================================
function setupGreeting() {
  const h = new Date().getHours();
  let greet = '🌅 Suprabhat';
  if (h >= 12 && h < 17) greet = '☀️ Namaste';
  else if (h >= 17 && h < 21) greet = '🌇 Shubh Sandhya';
  else if (h >= 21 || h < 4)  greet = '🌙 Shubh Ratri';
  const el = document.getElementById('greetingTitle');
  if (el) el.textContent = greet;
}

// ============================================================
//  BAR CHART
// ============================================================
function setupBarChart() {
  const data = [
    {d:'Mon',h:6.5,rem:1.2},{d:'Tue',h:7.8,rem:1.8},{d:'Wed',h:5.9,rem:1.0},
    {d:'Thu',h:8.1,rem:2.0},{d:'Fri',h:7.2,rem:1.5},{d:'Sat',h:6.8,rem:1.3},{d:'Sun',h:7.4,rem:1.7}
  ];
  renderBarChart('barChart', data);
  renderBarChart('trendsBarChart', data);

  document.querySelectorAll('#chartTabs .pill-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#chartTabs .pill-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
}

function renderBarChart(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const maxH = Math.max(...data.map(d => d.h));
  container.innerHTML = '';
  data.forEach(item => {
    const col = document.createElement('div');
    col.className = 'bar-col';
    const hPct  = (item.h / maxH * 100).toFixed(0);
    const rPct  = (item.rem / maxH * 100).toFixed(0);
    col.innerHTML = `
      <div class="bar-val">${item.h}h</div>
      <div class="bar-wrap">
        <div class="bar" style="height:${hPct}%;background:linear-gradient(180deg,#F97316,#C2410C);" title="${item.h}h sleep">
          <div style="position:absolute;bottom:0;width:100%;height:${rPct}%;background:rgba(124,58,237,0.6);border-radius:6px 6px 0 0;"></div>
        </div>
      </div>
      <div class="bar-label">${item.d}</div>`;
    container.appendChild(col);
  });
}

// ============================================================
//  HABITS  (API-backed)
// ============================================================
async function renderHabits() {
  try {
    const habits = await apiFetch('/habits');
    const list   = document.getElementById('habitList');
    const count  = document.getElementById('habitCount');
    if (!list) return;
    list.innerHTML = '';
    const done = habits.filter(h => h.done).length;
    if (count) count.textContent = `${done} of ${habits.length} complete`;

    habits.forEach(h => {
      const item = document.createElement('div');
      item.className = 'habit-item';
      item.innerHTML = `
        <div class="habit-check ${h.done ? 'h-done' : 'h-skip'}" onclick="toggleHabit(${h.id})">
          ${h.done ? '<i class="fa-solid fa-check" style="font-size:9px;"></i>' : ''}
        </div>
        <span style="font-size:16px;">${h.icon}</span>
        <div class="habit-name">${h.name}</div>
        <div class="habit-streak"><i class="fa-solid fa-fire" style="font-size:9px;"></i>${h.streak}</div>`;
      list.appendChild(item);
    });
  } catch (err) {
    console.error('Habits error:', err.message);
  }
}

async function toggleHabit(id) {
  try {
    await apiFetch(`/habits/${id}/toggle`, 'PATCH');
    renderHabits();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
//  MOOD  (API-backed)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
});

async function logMood() {
  const selected = document.querySelector('.mood-btn.selected');
  if (!selected) { showToast('Pehle mood chuniye!', 'error'); return; }
  const mood = selected.dataset.mood;

  try {
    await apiFetch('/mood', 'POST', { mood });
    const moods = await apiFetch('/mood');
    const streak = moods.length;
    const noteEl = document.getElementById('moodNote');
    if (noteEl) noteEl.textContent = `💡 Aapne ${streak} baar mood log kiya hai. Badiya!`;
    const btn = document.querySelector('.mood-log');
    btn.textContent = '✓ Mood Log Hua!';
    btn.style.background = '#059669';
    setTimeout(() => { btn.textContent = 'Log Mood'; btn.style.background = ''; }, 2000);
    showToast('Mood logged! 🪔', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadMoodState() {
  try {
    const moods = await apiFetch('/mood');
    if (moods.length > 0) {
      const noteEl = document.getElementById('moodNote');
      if (noteEl) noteEl.textContent = `💡 Aapne ${moods.length} baar mood log kiya hai.`;
    }
  } catch {}
}

// ============================================================
//  SLEEP LOG  (API-backed)
// ============================================================
function calcDuration() {
  const bed  = (document.getElementById('logBedtime')||{}).value;
  const wake = (document.getElementById('logWake')||{}).value;
  if (!bed || !wake) return;
  let [bh,bm] = bed.split(':').map(Number);
  let [wh,wm] = wake.split(':').map(Number);
  let mins = (wh*60+wm) - (bh*60+bm);
  if (mins < 0) mins += 1440;
  const h = Math.floor(mins/60), m = mins%60;
  const dur = document.getElementById('logDuration');
  if (dur) dur.value = `${h}h ${m}m`;
}

document.addEventListener('DOMContentLoaded', () => {
  const bed  = document.getElementById('logBedtime');
  const wake = document.getElementById('logWake');
  if (bed)  bed.addEventListener('change', calcDuration);
  if (wake) wake.addEventListener('change', calcDuration);

  // Set today's date as default
  const logDate = document.getElementById('logDate');
  if (logDate) logDate.value = new Date().toISOString().split('T')[0];

  calcDuration();

  // Auto-login if token exists
  const user = getLocalUser();
  const token = getToken();
  if (user && token) showApp();
});

async function saveSleepLog() {
  const date    = document.getElementById('logDate').value;
  const bedtime = document.getElementById('logBedtime').value;
  const wake    = document.getElementById('logWake').value;
  const quality = document.getElementById('logQuality').value;
  const notes   = document.getElementById('logNotes').value.trim();
  const duration= document.getElementById('logDuration').value;

  if (!date || !bedtime || !wake) { showToast('Sabhi required fields bhariye.', 'error'); return; }

  try {
    const log = await apiFetch('/sleep', 'POST', { date, bedtime, wake, duration, quality: parseInt(quality), notes });
    await renderSleepLogs();
    document.getElementById('logNotes').value = '';
    showToast('Sleep entry save ho gayi! 🌙', 'success');
    updateDashboardSleep(log);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function renderSleepLogs() {
  try {
    const logs      = await apiFetch('/sleep');
    const container = document.getElementById('logEntries');
    if (!container) return;

    if (logs.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);font-size:13.5px;">Koi sleep entry nahi hai. Pehli entry add karein!</div>';
      return;
    }

    container.innerHTML = '';
    logs.forEach(log => {
      const d      = new Date(log.date + 'T12:00:00');
      const dayNum = d.getDate();
      const mon    = d.toLocaleString('default', { month:'short' });
      const stars  = '⭐'.repeat(parseInt(log.quality));
      const item   = document.createElement('div');
      item.className = 'log-entry';
      item.innerHTML = `
        <div class="log-date-badge">
          <div class="log-date-day">${dayNum}</div>
          <div class="log-date-mon">${mon}</div>
        </div>
        <div class="log-details">
          <div class="log-duration">${log.duration} <span style="font-size:12px;color:var(--text2);">· ${log.bedtime} → ${log.wake}</span></div>
          <div class="log-meta">${stars}</div>
          ${log.notes ? `<div class="log-notes">"${log.notes}"</div>` : ''}
        </div>
        <div class="log-del" onclick="deleteSleepLog(${log.id})" title="Delete"><i class="fa-solid fa-trash"></i></div>`;
      container.appendChild(item);
    });

    if (logs[0]) updateDashboardSleep(logs[0]);
  } catch (err) {
    console.error('Sleep logs error:', err.message);
  }
}

async function deleteSleepLog(id) {
  try {
    await apiFetch(`/sleep/${id}`, 'DELETE');
    renderSleepLogs();
    showToast('Entry delete ho gayi.', '');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function updateDashboardSleep(log) {
  if (!log) return;
  const val = document.getElementById('dashSleepVal');
  const sub = document.getElementById('dashSleepSub');
  if (val) val.textContent = log.duration;
  if (sub) sub.textContent = `Bedtime ${log.bedtime} · Wake time ${log.wake}`;
}

// ============================================================
//  SETTINGS  (API-backed)
// ============================================================
async function saveSettings() {
  const newName = document.getElementById('settingsName').value.trim();
  if (!newName) { showToast('Naam khali nahi ho sakta.', 'error'); return; }
  const parts = newName.split(' ');

  try {
    await apiFetch('/user/profile', 'PUT', { firstName: parts[0]||'', lastName: parts.slice(1).join(' ')||'' });
    const user = { ...getLocalUser(), firstName: parts[0]||'', lastName: parts.slice(1).join(' ')||'' };
    setLocalUser(user);
    const initials = ((parts[0]||'')[0]||'') + ((parts[1]||'')[0]||'');
    document.getElementById('sidebarAvatar').textContent = initials.toUpperCase();
    document.getElementById('sidebarName').textContent   = newName;
    showToast('Settings save ho gayi! 🙏', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function clearAllData() {
  if (!confirm('Kya aap sure hain? Aapke sabhi sleep logs delete ho jayenge.')) return;
  try {
    await apiFetch('/data/clear', 'DELETE');
    renderSleepLogs();
    renderHabits();
    showToast('Sabhi data clear ho gaya.', '');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteAccount() {
  if (!confirm('Kya aap sure hain? Yeh action undo nahi ho sakta.')) return;
  try {
    await apiFetch('/user', 'DELETE');
    handleLogout();
    showToast('Account delete ho gaya.', '');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
//  TOAST
// ============================================================
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + (type||'');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
