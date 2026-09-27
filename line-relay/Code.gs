/**
 * Fit Routine by Beer — LINE relay (Google Apps Script)
 * ส่งแจ้งเตือนเป็นแชต 1:1 ผ่าน LINE Official Account + ให้แต่ละคนเชื่อม LINE ด้วย LINE Login
 *
 * ตั้งค่าใน Project Settings (รูปเฟือง) > Script properties
 *   LINE_TOKEN            = Channel access token (long-lived) ของ Messaging API channel (LINE OA)
 *   APP_SECRET            = รหัสลับที่ตั้งเอง ใส่ค่าเดียวกันในแอป หน้า ตั้งค่า > LINE
 *   LOGIN_CHANNEL_ID      = Channel ID ของ LINE Login channel
 *   LOGIN_CHANNEL_SECRET  = Channel secret ของ LINE Login channel
 *
 * แก้โค้ดแล้วต้อง Deploy > Manage deployments > แก้ (ดินสอ) > Version: New version > Deploy
 * เพื่อให้ URL เดิมใช้โค้ดใหม่
 */
const P = PropertiesService.getScriptProperties();

function links_() { try { return JSON.parse(P.getProperty('LINKS') || '{}'); } catch (e) { return {}; } }
function saveLinks_(l) { P.setProperty('LINKS', JSON.stringify(l)); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function callback_() { return P.getProperty('CALLBACK_URL') || ScriptApp.getService().getUrl(); }
function okSecret_(s) { return s && s === P.getProperty('APP_SECRET'); }

function doGet(e) {
  const p = (e && e.parameter) || {};

  // (1) LINE Login ส่งผู้ใช้กลับมาพร้อม code
  if (p.code && p.state) return loginCallback_(p);
  if (p.error && p.state) return page_('ยกเลิกการเชื่อม LINE', 'ไม่ได้เชื่อม LINE (' + p.error + ')', stateReturn_(p.state));

  // (2) แอปถามสถานะ
  if (p.action === 'info') {
    if (!okSecret_(p.secret)) return json_({ ok: false, error: 'รหัสลับ (APP_SECRET) ไม่ตรงกับใน Apps Script' });
    const L = links_(), out = {};
    Object.keys(L).forEach(function (k) { out[k] = { name: L[k].name, at: L[k].at, friend: L[k].friend }; });
    return json_({ ok: true, hasToken: !!P.getProperty('LINE_TOKEN'), loginChannelId: P.getProperty('LOGIN_CHANNEL_ID') || '', callback: callback_(), links: out });
  }
  return ContentService.createTextOutput('Fit Routine LINE relay ทำงานอยู่ · เชื่อมแล้ว ' + Object.keys(links_()).length + ' คน');
}

function doPost(e) {
  let b = {};
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'bad json' }); }

  // Webhook จาก LINE (เพิ่มเพื่อน ฯลฯ)
  if (Array.isArray(b.events)) {
    b.events.forEach(function (ev) {
      if (ev.type === 'follow' && ev.replyToken) reply_(ev.replyToken, 'ยินดีต้อนรับสู่ Fit Routine 🏊‍♀️\nกลับไปที่แอป → ตั้งค่า → บัญชี → กด "เชื่อม LINE" เพื่อรับแจ้งเตือน');
      if (ev.type === 'follow' || ev.type === 'unfollow') setFriend_(ev.source && ev.source.userId, ev.type === 'follow');
    });
    return json_({ ok: true });
  }

  if (!okSecret_(b.secret)) return json_({ ok: false, error: 'รหัสลับไม่ถูกต้อง' });

  if (b.action === 'unlink') { const L = links_(); delete L[b.k]; saveLinks_(L); return json_({ ok: true }); }

  // ส่งข้อความ: { messages: [{ to: 'owner' | memberId, text }] }
  const L = links_(), sent = [], skipped = [];
  (b.messages || []).slice(0, 10).forEach(function (m) {
    const t = L[m.to];
    if (!t || !t.uid) { skipped.push(m.to); return; }
    const code = push_(t.uid, String(m.text || '').slice(0, 4900));
    (code === 200 ? sent : skipped).push(m.to);
  });
  return json_({ ok: sent.length > 0 || !(b.messages || []).length, sent: sent, skipped: skipped, error: sent.length ? '' : 'ผู้รับยังไม่ได้เชื่อม LINE หรือยังไม่ได้เพิ่มเพื่อน OA' });
}

function loginCallback_(p) {
  const st = parseState_(p.state);
  if (!st || !st.k) return page_('เชื่อม LINE ไม่สำเร็จ', 'ลิงก์ไม่ถูกต้อง ลองกดเชื่อม LINE ในแอปอีกครั้ง', '');
  // แลก code เป็น token (ใช้ Channel secret ฝั่งเซิร์ฟเวอร์เท่านั้น)
  const tok = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'authorization_code', code: p.code, redirect_uri: callback_(), client_id: P.getProperty('LOGIN_CHANNEL_ID'), client_secret: P.getProperty('LOGIN_CHANNEL_SECRET') }
  });
  if (tok.getResponseCode() !== 200) return page_('เชื่อม LINE ไม่สำเร็จ', 'แลกรหัสไม่ผ่าน: ' + tok.getContentText().slice(0, 200), stateReturn_(p.state));
  const t = JSON.parse(tok.getContentText());
  // ยืนยัน ID token กับ LINE
  const ver = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', { method: 'post', muteHttpExceptions: true, payload: { id_token: t.id_token, client_id: P.getProperty('LOGIN_CHANNEL_ID') } });
  if (ver.getResponseCode() !== 200) return page_('เชื่อม LINE ไม่สำเร็จ', 'ยืนยันตัวตนไม่ผ่าน', stateReturn_(p.state));
  const v = JSON.parse(ver.getContentText());
  let friend = null;
  try { const f = UrlFetchApp.fetch('https://api.line.me/friendship/v1/status', { headers: { Authorization: 'Bearer ' + t.access_token }, muteHttpExceptions: true }); if (f.getResponseCode() === 200) friend = JSON.parse(f.getContentText()).friendFlag; } catch (err) { }
  const L = links_();
  Object.keys(L).forEach(function (k) { if (L[k].uid === v.sub && k !== st.k) delete L[k]; }); // LINE เดียวผูกได้คนเดียว
  L[st.k] = { uid: v.sub, name: v.name || '', appName: st.n || '', at: new Date().toISOString(), friend: friend };
  saveLinks_(L);
  if (friend) push_(v.sub, 'เชื่อม LINE กับ Fit Routine แล้ว ✅\nคุณจะได้รับแจ้งเตือนตามที่ตั้งค่าไว้ในแอป');
  return page_('เชื่อม LINE สำเร็จ ✅', (v.name || '') + ' เชื่อมกับ ' + (st.n || 'Fit Routine') + ' แล้ว' + (friend === false ? '\nอย่าลืมเพิ่มเพื่อน Fit Routine ใน LINE เพื่อรับข้อความ' : ''), stateReturn_(p.state));
}

function parseState_(s) {
  try { const b = s.replace(/-/g, '+').replace(/_/g, '/'); const pad = b + '==='.slice((b.length + 3) % 4); return JSON.parse(Utilities.newBlob(Utilities.base64Decode(pad)).getDataAsString()); } catch (e) { return null; }
}
function stateReturn_(s) {
  const st = parseState_(s) || {}; const r = String(st.r || '');
  if (!/^https:\/\//.test(r)) return '';
  const parts = r.split('#'); return parts[0] + '?line=linked' + (parts[1] ? '#' + parts[1] : '');
}
function page_(title, msg, back) {
  const h = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;background:#09111E;color:#EEF2F7;display:flex;align-items:center;justify-content:center;min-height:90vh;margin:0">'
    + '<div style="max-width:420px;padding:24px;border:1px solid #C9A55C66;border-radius:16px;background:#101B2C">'
    + '<h2 style="margin:0 0 8px;color:#F6F1E6">' + title + '</h2><p style="white-space:pre-line;color:#97A5B9">' + msg + '</p>'
    + (back ? '<a href="' + back + '" target="_top" style="display:inline-block;margin-top:8px;padding:10px 16px;border-radius:10px;background:#C9A55C;color:#191206;text-decoration:none;font-weight:600">กลับไปที่ Fit Routine</a>' : '')
    + '</div></body>';
  return HtmlService.createHtmlOutput(h).setTitle('Fit Routine · LINE').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function push_(to, text) {
  const r = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + P.getProperty('LINE_TOKEN') },
    payload: JSON.stringify({ to: to, messages: [{ type: 'text', text: text }] })
  });
  return r.getResponseCode();
}
function reply_(token, text) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + P.getProperty('LINE_TOKEN') },
    payload: JSON.stringify({ replyToken: token, messages: [{ type: 'text', text: text }] })
  });
}
function setFriend_(uid, on) { if (!uid) return; const L = links_(); let ch = false; Object.keys(L).forEach(function (k) { if (L[k].uid === uid) { L[k].friend = on; ch = true; } }); if (ch) saveLinks_(L); }

// กด Run ฟังก์ชันนี้ครั้งแรกเพื่ออนุญาตสิทธิ์ แล้วดูผลใน Execution log
function checkSetup() {
  ['LINE_TOKEN', 'APP_SECRET', 'LOGIN_CHANNEL_ID', 'LOGIN_CHANNEL_SECRET'].forEach(function (k) { Logger.log(k + ': ' + (P.getProperty(k) ? 'ตั้งค่าแล้ว' : 'ยังไม่ได้ตั้ง')); });
  Logger.log('Callback URL (ใส่ใน LINE Login): ' + callback_());
  Logger.log('เชื่อมแล้ว: ' + JSON.stringify(Object.keys(links_())));
}
