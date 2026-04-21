const express = require('express');
const db = require('./db');
const config = require('./config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { importExcel } = require('./excel-parser');

const router = express.Router();
const upload = multer({ dest: 'data/uploads/' });

// Dashboard
router.get('/', (req, res) => {
  const drivers = db.getAllDrivers();
  const mappings = db.getAllMappings();
  const periods = db.getPeriods();
  const lineConfigured = !!(config.line.channelSecret && config.line.channelAccessToken);

  res.send(`
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NPC Driver Portal - Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f23; color: #e0e0e0; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1DB446; margin-bottom: 20px; }
    .card { background: #1a1a2e; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #333; }
    .card h2 { color: #1DB446; margin-bottom: 15px; font-size: 18px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .stat { background: #16213e; border-radius: 8px; padding: 15px; text-align: center; }
    .stat .number { font-size: 32px; font-weight: bold; color: #1DB446; }
    .stat .label { color: #888; font-size: 14px; margin-top: 5px; }
    input, select, button { padding: 10px 15px; border-radius: 8px; border: 1px solid #444; background: #16213e; color: #e0e0e0; font-size: 14px; }
    button { background: #1DB446; color: white; border: none; cursor: pointer; font-weight: bold; }
    button:hover { background: #17a03d; }
    button.danger { background: #dc3545; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; color: #888; }
    .form-group input { width: 100%; max-width: 400px; }
    .status-ok { color: #1DB446; }
    .status-warn { color: #FFD93D; }
    .status-err { color: #dc3545; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #333; }
    th { color: #888; font-weight: normal; }
    a { color: #4ECDC4; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .btn-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
  </style>
</head>
<body>
<div class="container">
  <h1>🚛 NPC Driver Portal — Admin Panel</h1>

  <div class="card">
    <h2>📊 สถานะระบบ</h2>
    <div class="grid">
      <div class="stat"><div class="number">${drivers.length}</div><div class="label">พนักงานทั้งหมด</div></div>
      <div class="stat"><div class="number">${mappings.length}</div><div class="label">จับคู่แล้ว</div></div>
      <div class="stat"><div class="number">${drivers.length - mappings.length}</div><div class="label">ยังไม่จับคู่</div></div>
      <div class="stat"><div class="number">${periods.length}</div><div class="label">Periods</div></div>
    </div>
  </div>

  <div class="card">
    <h2>🔑 ตั้งค่า LINE</h2>
    <p class="${lineConfigured ? 'status-ok' : 'status-err'}">${lineConfigured ? '✅ LINE configured' : '❌ LINE not configured — set .env or edit below'}</p>
    <form method="POST" action="/admin/config">
      <div class="form-group">
        <label>Channel Secret</label>
        <input type="password" name="channelSecret" placeholder="Enter channel secret">
      </div>
      <div class="form-group">
        <label>Channel Access Token</label>
        <input type="password" name="channelAccessToken" placeholder="Enter access token">
      </div>
      <div class="form-group">
        <label>Admin LINE User ID</label>
        <input type="text" name="adminUserId" placeholder="U1234567890abcdef...">
      </div>
      <button type="submit">💾 บันทึก LINE Config</button>
    </form>
  </div>

  <div class="card">
    <h2>📁 Import Excel</h2>
    <form method="POST" action="/admin/import" enctype="multipart/form-data">
      <div class="form-group">
        <label>อัพโหลดไฟล์ Excel (.xlsx)</label>
        <input type="file" name="excelFile" accept=".xlsx,.xls">
      </div>
      <button type="submit">📥 Import</button>
    </form>
  </div>

  <div class="card">
    <h2>🔗 รายชื่อที่จับคู่แล้ว</h2>
    <table>
      <tr><th>LINE User ID</th><th>NPC ID</th><th>ชื่อ</th><th>จับคู่เมื่อ</th><th></th></tr>
      ${mappings.map(m => `
        <tr>
          <td><a href="/admin/messages/${m.line_user_id}">${m.line_user_id.substring(0, 15)}...</a></td>
          <td>${m.npc_id}</td>
          <td>${m.driver_name || m.name}</td>
          <td>${m.matched_at}</td>
          <td>
            <form method="POST" action="/admin/unlink" style="display:inline">
              <input type="hidden" name="lineUserId" value="${m.line_user_id}">
              <button type="submit" class="danger" style="padding:5px 10px;font-size:12px">❌</button>
            </form>
          </td>
        </tr>
      `).join('')}
      ${mappings.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#888">ยังไม่มีการจับคู่</td></tr>' : ''}
    </table>
  </div>

  <div class="card">
    <h2>🎨 Rich Menu</h2>
    <form method="POST" action="/admin/richmenu">
      <button type="submit">🎨 สร้าง Rich Menu</button>
    </form>
  </div>

  <div class="card">
    <h2>📨 ข้อความพนักงาน</h2>
    <a href="/admin/messages">ดูข้อความทั้งหมด →</a>
  </div>
</div>
</body>
</html>
  `);
});

// Save LINE config
router.post('/config', express.urlencoded({ extended: true }), (req, res) => {
  const { channelSecret, channelAccessToken, adminUserId } = req.body;
  if (channelSecret) db.setConfig('LINE_CHANNEL_SECRET', channelSecret);
  if (channelAccessToken) db.setConfig('LINE_CHANNEL_ACCESS_TOKEN', channelAccessToken);
  if (adminUserId) db.setConfig('ADMIN_LINE_USER_ID', adminUserId);
  res.redirect('/admin?saved=1');
});

// Import Excel
router.post('/import', upload.single('excelFile'), (req, res) => {
  try {
    const filePath = req.file ? req.file.path : config.excelPath;
    const result = importExcel(filePath);
    res.redirect('/admin?imported=1');
  } catch (err) {
    res.status(500).send(`Import failed: ${err.message}`);
  }
});

// Unlink
router.post('/unlink', express.urlencoded({ extended: true }), (req, res) => {
  db.deleteMapping(req.body.lineUserId);
  res.redirect('/admin');
});

// Create rich menu
router.post('/richmenu', async (req, res) => {
  try {
    const { createRichMenu } = require('./setup-richmenu');
    const id = await createRichMenu();
    res.redirect(`/admin?richmenu=${id}`);
  } catch (err) {
    res.status(500).send(`Rich menu creation failed: ${err.message}`);
  }
});

// Messages list
router.get('/messages', (req, res) => {
  const chats = db.getAllChats();
  res.send(`
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Messages — NPC Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f23; color: #e0e0e0; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #1DB446; margin-bottom: 20px; }
    .chat-item { display: flex; align-items: center; padding: 15px; background: #1a1a2e; border-radius: 12px; margin-bottom: 10px; text-decoration: none; color: #e0e0e0; border: 1px solid #333; }
    .chat-item:hover { border-color: #1DB446; }
    .chat-info { flex: 1; }
    .chat-name { font-weight: bold; }
    .chat-preview { color: #888; font-size: 13px; margin-top: 3px; }
    .chat-time { color: #666; font-size: 12px; }
    a { color: inherit; text-decoration: none; }
    .back { color: #4ECDC4; margin-bottom: 15px; display: inline-block; }
  </style>
</head>
<body>
<div class="container">
  <a href="/admin" class="back">← กลับ</a>
  <h1>📨 ข้อความพนักงาน</h1>
  ${chats.map(c => `
    <a href="/admin/messages/${c.line_user_id}" class="chat-item">
      <div class="chat-info">
        <div class="chat-name">${c.driver_name || c.name} (${c.npc_id})</div>
        <div class="chat-preview">${c.last_message || 'ไม่มีข้อความ'}</div>
      </div>
      <div class="chat-time">${c.last_time || ''}</div>
    </a>
  `).join('')}
  ${chats.length === 0 ? '<p style="text-align:center;color:#888">ยังไม่มีข้อความ</p>' : ''}
</div>
</body>
</html>
  `);
});

// Chat view
router.get('/messages/:lineUserId', (req, res) => {
  const messages = db.getMessages(req.params.lineUserId, 100).reverse();
  const mapping = db.getMappingByLineId(req.params.lineUserId);
  const driver = mapping ? db.getDriver(mapping.npc_id) : null;
  const driverName = driver ? `${driver.name} (${driver.npc_id})` : req.params.lineUserId;

  res.send(`
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${driverName} — Chat</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f23; color: #e0e0e0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #1DB446; margin-bottom: 20px; font-size: 18px; }
    .chat-area { min-height: 400px; }
    .msg { padding: 10px 15px; border-radius: 12px; margin-bottom: 8px; max-width: 80%; }
    .msg.inbound { background: #16213e; margin-right: auto; border-bottom-left-radius: 4px; }
    .msg.outbound { background: #1DB446; color: white; margin-left: auto; border-bottom-right-radius: 4px; }
    .msg-time { font-size: 11px; color: #888; margin-top: 3px; }
    .msg.outbound .msg-time { color: rgba(255,255,255,0.7); }
    .send-form { display: flex; gap: 10px; margin-top: 20px; }
    .send-form input { flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #16213e; color: #e0e0e0; }
    .send-form button { padding: 12px 20px; border-radius: 8px; background: #1DB446; color: white; border: none; font-weight: bold; cursor: pointer; }
    a { color: #4ECDC4; text-decoration: none; }
  </style>
</head>
<body>
<div class="container">
  <a href="/admin/messages" style="margin-bottom:15px;display:inline-block">← กลับ</a>
  <h1>💬 ${driverName}</h1>
  <div class="chat-area">
    ${messages.map(m => `
      <div class="msg ${m.direction}">
        <div>${m.message}</div>
        <div class="msg-time">${m.created_at}</div>
      </div>
    `).join('')}
    ${messages.length === 0 ? '<p style="text-align:center;color:#888;padding:40px">ยังไม่มีข้อความ</p>' : ''}
  </div>
  <form method="POST" action="/admin/messages/${req.params.lineUserId}/send" class="send-form">
    <input type="text" name="message" placeholder="พิมพ์ข้อความ..." required>
    <button type="submit">ส่ง</button>
  </form>
</div>
</body>
</html>
  `);
});

// Send message back
router.post('/messages/:lineUserId/send', express.urlencoded({ extended: true }), async (req, res) => {
  const { message } = req.body;
  const { lineUserId } = req.params;

  try {
    const { getClient } = require('./bot/handler');
    const client = getClient();
    await client.pushMessage({
      to: lineUserId,
      messages: [{ type: 'text', text: message }],
    });

    const mapping = db.getMappingByLineId(lineUserId);
    db.logMessage(lineUserId, mapping?.npc_id || null, message, 'outbound');
  } catch (err) {
    console.error('Send message failed:', err.message);
  }

  res.redirect(`/admin/messages/${lineUserId}`);
});

// API status
router.get('/api/status', (req, res) => {
  res.json({
    drivers: db.getAllDrivers().length,
    mappings: db.getAllMappings().length,
    periods: db.getPeriods(),
    lineConfigured: !!(config.line.channelSecret && config.line.channelAccessToken),
  });
});

module.exports = router;
