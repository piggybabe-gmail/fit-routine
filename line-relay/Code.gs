/**
 * Fit Routine by Beer — LINE relay (Google Apps Script)
 *
 * ทำหน้าที่ 2 อย่าง
 *  1) รับ Webhook จาก LINE เพื่อจำ "กลุ่ม" ที่บอทถูกเชิญเข้าไป
 *  2) รับข้อความจากแอป Fit Routine แล้วส่งเข้ากลุ่ม LINE
 *
 * ตั้งค่าใน Project Settings > Script properties (ไม่ต้องแก้โค้ด)
 *   LINE_TOKEN  = Channel access token (long-lived) จาก LINE Developers
 *   APP_SECRET  = รหัสลับที่ตั้งเอง (ใส่ค่าเดียวกันในแอป หน้า ตั้งค่า > LINE)
 */
const PROPS = PropertiesService.getScriptProperties();

function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out('bad json'); }

  // (1) Webhook จาก LINE
  if (Array.isArray(body.events)) {
    body.events.forEach(function (ev) {
      const src = ev.source || {};
      if (src.type !== 'group') return;
      const text = (ev.message && ev.message.text) || '';
      const hasGroup = !!PROPS.getProperty('GROUP_ID');
      if (ev.type === 'join' || (!hasGroup && ev.type === 'message') || /ผูกกลุ่ม|bind fit/i.test(text)) {
        PROPS.setProperty('GROUP_ID', src.groupId);
        if (ev.replyToken) reply(ev.replyToken, 'เชื่อมกลุ่มนี้กับ Fit Routine แล้ว ✅\nการอัปเดตอาหาร การเทรน และผลวัดจะแจ้งที่นี่');
      }
    });
    return out('ok');
  }

  // (2) ข้อความจากแอป
  if (!body.secret || body.secret !== PROPS.getProperty('APP_SECRET')) return out('forbidden');
  const to = PROPS.getProperty('GROUP_ID');
  if (!to) return out('no group yet: invite the bot to the LINE group first');
  push(to, String(body.text || '').slice(0, 4900));
  return out('sent');
}

function doGet() { return out('Fit Routine LINE relay is running · group ' + (PROPS.getProperty('GROUP_ID') ? 'connected' : 'not connected')); }

function push(to, text) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + PROPS.getProperty('LINE_TOKEN') },
    payload: JSON.stringify({ to: to, messages: [{ type: 'text', text: text }] })
  });
}
function reply(token, text) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + PROPS.getProperty('LINE_TOKEN') },
    payload: JSON.stringify({ replyToken: token, messages: [{ type: 'text', text: text }] })
  });
}
function out(s) { return ContentService.createTextOutput(s); }

// กด Run ฟังก์ชันนี้ครั้งแรกเพื่ออนุญาตสิทธิ์ แล้วดูผลใน Execution log
function testPush() { const to = PROPS.getProperty('GROUP_ID'); if (!to) throw new Error('ยังไม่ได้ผูกกลุ่ม'); push(to, 'ทดสอบจาก Apps Script ✅'); }
