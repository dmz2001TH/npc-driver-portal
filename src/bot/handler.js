const line = require('@line/bot-sdk');
const db = require('../db');
const config = require('../config');

function getClient() {
  return new line.messagingApi.MessagingApiClient({
    channelAccessToken: config.line.channelAccessToken,
  });
}

function formatSalaryFlex(salary, allowances, trips) {
  if (!salary || salary.length === 0) {
    return {
      type: 'text',
      text: 'ยังไม่มีข้อมูลเงินเดือนในระบบครับ 📋',
    };
  }

  const s = salary[0]; // Latest period
  const totalRevenue = (s.price_400 * 400) + (s.price_440 * 440) + (s.price_470 * 470) +
    (s.price_500 * 500) + (s.price_530 * 530) + (s.price_550 * 550) +
    (s.price_650 * 650) + (s.price_700 * 700) + (s.price_750 * 750) +
    (s.price_830 * 830) + (s.price_870 * 870) + (s.price_1100 * 1100);

  let allowanceTotal = 0;
  let deductionTotal = 0;
  const allowanceLines = [];
  const deductionLines = [];

  if (allowances && allowances.length > 0) {
    for (const a of allowances) {
      if (a.type === 'allowance' || a.type !== 'deduction') {
        allowanceTotal += a.amount;
        allowanceLines.push(`  +${a.amount.toLocaleString()}฿ (${a.reason || '-'})`);
      } else {
        deductionTotal += a.amount;
        deductionLines.push(`  -${a.amount.toLocaleString()}฿ (${a.reason || '-'})`);
      }
    }
  }

  const netTotal = totalRevenue + allowanceTotal - deductionTotal;

  // Build price tier details
  const tierLines = [];
  const tiers = [
    [400, s.price_400], [440, s.price_440], [470, s.price_470],
    [500, s.price_500], [530, s.price_530], [550, s.price_550],
    [650, s.price_650], [700, s.price_700], [750, s.price_750],
    [830, s.price_830], [870, s.price_870], [1100, s.price_1100],
  ];
  for (const [price, count] of tiers) {
    if (count > 0) {
      tierLines.push(`${price}฿×${count} = ${(price * count).toLocaleString()}฿`);
    }
  }

  const bodyContents = [
    { type: 'text', text: `📋 Period: ${s.period}`, weight: 'bold', size: 'sm', color: '#666666' },
    { type: 'separator', margin: 'md' },
    {
      type: 'box', layout: 'vertical', margin: 'md',
      contents: [
        { type: 'text', text: '🚛 จำนวนเที่ยว', weight: 'bold', size: 'md' },
        { type: 'text', text: `รวม ${s.total_trips} เที่ยว`, size: 'xl', weight: 'bold', color: '#1DB446' },
      ],
    },
    { type: 'separator', margin: 'md' },
    {
      type: 'box', layout: 'vertical', margin: 'md',
      contents: [
        { type: 'text', text: '💰 รายได้ตามราคา', weight: 'bold', size: 'md' },
        ...tierLines.map(line => ({ type: 'text', text: line, size: 'sm', color: '#555555' })),
      ],
    },
    { type: 'text', text: `รายได้รวม: ${totalRevenue.toLocaleString()}฿`, weight: 'bold', size: 'md', margin: 'md', color: '#FF6B35' },
  ];

  if (allowanceLines.length > 0) {
    bodyContents.push({ type: 'separator', margin: 'md' });
    bodyContents.push({ type: 'text', text: '🎁 เงินพิเศษ', weight: 'bold', size: 'md' });
    bodyContents.push(...allowanceLines.map(l => ({ type: 'text', text: l, size: 'sm', color: '#28a745' })));
  }

  if (deductionLines.length > 0) {
    bodyContents.push({ type: 'separator', margin: 'md' });
    bodyContents.push({ type: 'text', text: '📉 หักเงิน', weight: 'bold', size: 'md' });
    bodyContents.push(...deductionLines.map(l => ({ type: 'text', text: l, size: 'sm', color: '#dc3545' })));
  }

  bodyContents.push({ type: 'separator', margin: 'md' });
  bodyContents.push({
    type: 'text', text: `💵 สุทธิ: ${netTotal.toLocaleString()}฿`,
    weight: 'bold', size: 'xl', color: '#1DB446', margin: 'md',
  });

  return {
    type: 'flex',
    altText: `💰 เงินเดือน ${s.period} — สุทธิ ${netTotal.toLocaleString()}฿`,
    contents: {
      type: 'bubble',
      body: { type: 'box', layout: 'vertical', contents: bodyContents, paddingAll: 'lg' },
    },
  };
}

function formatTripsFlex(trips, driverName) {
  if (!trips || trips.length === 0) {
    return { type: 'text', text: 'ยังไม่มีข้อมูลการวิ่งงานครับ 📋' };
  }

  const tripContents = trips.slice(0, 20).map(t => ({
    type: 'box', layout: 'horizontal', margin: 'sm',
    contents: [
      { type: 'text', text: t.date || '-', size: 'xs', color: '#888888', flex: 2 },
      { type: 'text', text: t.customer || '-', size: 'xs', flex: 3 },
      { type: 'text', text: t.container_number || '-', size: 'xs', flex: 3 },
      { type: 'text', text: `${t.price}฿`, size: 'xs', flex: 1, align: 'end', color: '#1DB446' },
    ],
  }));

  return {
    type: 'flex',
    altText: `🚛 การวิ่งงาน ${driverName}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', paddingAll: 'lg',
        contents: [
          { type: 'text', text: `🚛 การวิ่งงาน`, weight: 'bold', size: 'lg' },
          { type: 'text', text: driverName, size: 'sm', color: '#666666' },
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            contents: [
              { type: 'text', text: 'วันที่', size: 'xxs', weight: 'bold', flex: 2 },
              { type: 'text', text: 'ลูกค้า', size: 'xxs', weight: 'bold', flex: 3 },
              { type: 'text', text: 'ตู้', size: 'xxs', weight: 'bold', flex: 3 },
              { type: 'text', text: 'ราคา', size: 'xxs', weight: 'bold', flex: 1, align: 'end' },
            ],
          },
          { type: 'separator', margin: 'sm' },
          ...tripContents,
          ...(trips.length > 20 ? [{ type: 'text', text: `...และอีก ${trips.length - 20} เที่ยว`, size: 'xs', color: '#999999', margin: 'md' }] : []),
        ],
      },
    },
  };
}

function formatHelpMessage() {
  return {
    type: 'flex',
    altText: '📘 วิธีใช้งาน NPC Driver Portal',
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', paddingAll: 'lg',
        contents: [
          { type: 'text', text: '📘 วิธีใช้งาน', weight: 'bold', size: 'xl' },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: '1️⃣ กด "🔗 จับคู่บัญชี" เพื่อเชื่อม LINE กับรหัสพนักงาน', margin: 'md', size: 'sm', wrap: true },
          { type: 'text', text: '2️⃣ กด "💰 เช็คเงินเดือน" เพื่อดูสรุปรายได้', margin: 'md', size: 'sm', wrap: true },
          { type: 'text', text: '3️⃣ กด "🚛 การวิ่งงาน" เพื่อดูรายการเที่ยว', margin: 'md', size: 'sm', wrap: true },
          { type: 'text', text: '4️⃣ กด "📞 ติดต่อแอดมิน" เพื่อส่งข้อความหาแอดมิน', margin: 'md', size: 'sm', wrap: true },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: '⚠️ ถ้าจับคู่บัญชีไม่สำเร็จ ลองส่งเบอร์โทรศัพท์มา ระบบจะจับคู่ให้อัตโนมัติ', margin: 'md', size: 'xs', color: '#FF6B35', wrap: true },
        ],
      },
    },
  };
}

async function handleEvent(event) {
  if (event.type !== 'message' && event.type !== 'postback') return;
  if (event.source.type !== 'user') return; // Only DM

  const lineUserId = event.source.userId;
  const mapping = db.getMappingByLineId(lineUserId);

  // Log inbound message
  if (event.type === 'message') {
    const msgText = event.message.type === 'text' ? event.message.text : `[${event.message.type}]`;
    db.logMessage(lineUserId, mapping?.npc_id || null, msgText, 'inbound');
  }

  // Handle postback (Rich Menu actions)
  if (event.type === 'postback') {
    const action = event.postback.data;
    return handlePostback(event.replyToken, lineUserId, action, mapping);
  }

  // Handle text messages
  if (event.message.type === 'text') {
    const text = event.message.text.trim();
    return handleTextMessage(event.replyToken, lineUserId, text, mapping);
  }
}

async function handlePostback(replyToken, lineUserId, action, mapping) {
  switch (action) {
    case 'action=salary':
      return replySalary(replyToken, mapping);
    case 'action=trips':
      return replyTrips(replyToken, mapping);
    case 'action=link':
      return replyLinkMenu(replyToken, lineUserId, mapping);
    case 'action=admin':
      return replyAdminContact(replyToken, lineUserId, mapping);
    case 'action=help':
      return replyWithFlex(replyToken, formatHelpMessage());
    default:
      return replyText(replyToken, 'ไม่เข้าใจคำสั่งครับ ลองกดเมนูด้านล่าง 📋');
  }
}

async function handleTextMessage(replyToken, lineUserId, text, mapping) {
  // Phone number auto-match
  const phoneMatch = text.match(/(0\d{8,9})/);
  if (phoneMatch && !mapping) {
    const phone = phoneMatch[1];
    const driver = db.getDb().prepare(`SELECT * FROM drivers WHERE phone = ?`).get(phone);
    if (driver) {
      db.createMapping(lineUserId, driver.npc_id, driver.name);
      return replyText(replyToken, `✅ จับคู่สำเร็จ!\nคุณคือ ${driver.name} (${driver.npc_id})\n\nลองกดเมนูเพื่อเช็คข้อมูลได้เลยครับ 👇`);
    }
  }

  // If not mapped, show link menu
  if (!mapping) {
    // Check if it's a number selection for linking
    if (/^\d+$/.test(text)) {
      return handleLinkSelection(replyToken, lineUserId, parseInt(text));
    }
    return replyLinkMenu(replyToken, lineUserId, null);
  }

  // Simple text commands
  if (text === 'เงินเดือน' || text === 'salary') {
    return replySalary(replyToken, mapping);
  }
  if (text === 'งาน' || text === 'trips' || text === 'การวิ่งงาน') {
    return replyTrips(replyToken, mapping);
  }
  if (text === 'จับคู่' || text === 'link') {
    return replyLinkMenu(replyToken, lineUserId, mapping);
  }

  // Forward to admin
  return forwardToAdmin(lineUserId, text, mapping);
}

async function replySalary(replyToken, mapping) {
  if (!mapping) {
    return replyText(replyToken, 'กรุณาจับคู่บัญชีก่อนครับ กด "🔗 จับคู่บัญชี" 👇');
  }

  const salary = db.getSalaryByDriver(mapping.npc_id);
  const allowances = db.getAllowancesByDriver(mapping.npc_id);
  const trips = db.getTripsByDriver(mapping.npc_id);

  const msg = formatSalaryFlex(salary, allowances, trips);
  const client = getClient();
  await client.replyMessage({ replyToken, messages: [msg] });
}

async function replyTrips(replyToken, mapping) {
  if (!mapping) {
    return replyText(replyToken, 'กรุณาจับคู่บัญชีก่อนครับ กด "🔗 จับคู่บัญชี" 👇');
  }

  const driver = db.getDriver(mapping.npc_id);
  const trips = db.getTripsByDriver(mapping.npc_id);
  const msg = formatTripsFlex(trips, driver?.name || mapping.npc_id);
  const client = getClient();
  await client.replyMessage({ replyToken, messages: [msg] });
}

async function replyLinkMenu(replyToken, lineUserId, mapping) {
  if (mapping) {
    const driver = db.getDriver(mapping.npc_id);
    return replyText(replyToken, `คุณจับคู่เป็น ${driver?.name || mapping.npc_id} (${mapping.npc_id}) แล้วครับ ✅`);
  }

  const unmapped = db.getUnmappedDrivers();
  if (unmapped.length === 0) {
    return replyText(replyToken, 'ไม่มีรายชื่อที่ยังไม่จับคู่ครับ ถ้ามีปัญหาติดต่อแอดมิน 👇');
  }

  const listText = unmapped.slice(0, 30).map((d, i) =>
    `${i + 1}. ${d.name} (${d.npc_id})`
  ).join('\n');

  return replyText(replyToken,
    `เลือกชื่อของคุณ 👇\n\n${listText}\n\nพิมพ์หมายเลขที่ตรงกับชื่อของคุณ`
  );
}

async function handleLinkSelection(replyToken, lineUserId, number) {
  const unmapped = db.getUnmappedDrivers();
  const idx = number - 1;
  if (idx < 0 || idx >= unmapped.length) {
    return replyText(replyToken, 'หมายเลขไม่ถูกต้อง ลองใหม่อีกครั้งครับ');
  }

  const driver = unmapped[idx];
  db.createMapping(lineUserId, driver.npc_id, driver.name);
  return replyText(replyToken, `✅ จับคู่สำเร็จ!\nคุณคือ ${driver.name} (${driver.npc_id})\n\nลองกดเมนูเพื่อเช็คข้อมูลได้เลยครับ 👇`);
}

async function replyAdminContact(replyToken, lineUserId, mapping) {
  return replyText(replyToken, '📞 ติดต่อแอดมิน\n\nพิมพ์ข้อความที่ต้องการส่งหาแอดมินได้เลยครับ ระบบจะส่งต่อให้');
}

async function forwardToAdmin(lineUserId, text, mapping) {
  const driver = mapping ? db.getDriver(mapping.npc_id) : null;
  const senderName = driver ? `${driver.name} (${driver.npc_id})` : lineUserId;

  // Forward to admin
  if (config.adminUserId) {
    try {
      const client = getClient();
      await client.pushMessage({
        to: config.adminUserId,
        messages: [{
          type: 'text',
          text: `📨 ข้อความจาก ${senderName}:\n\n${text}`,
        }],
      });
    } catch (err) {
      console.error('Failed to forward to admin:', err.message);
    }
  }

  // Reply to driver
  const client = getClient();
  await client.replyMessage({
    replyToken,
    messages: [{ type: 'text', text: '✅ ส่งข้อความให้แอดมินแล้วครับ รอตอบกลับนะครับ' }],
  });
}

async function replyText(replyToken, text) {
  const client = getClient();
  await client.replyMessage({
    replyToken,
    messages: [{ type: 'text', text }],
  });
}

async function replyWithFlex(replyToken, flexMessage) {
  const client = getClient();
  await client.replyMessage({
    replyToken,
    messages: [flexMessage],
  });
}

module.exports = {
  handleEvent,
  formatSalaryFlex,
  formatTripsFlex,
  formatHelpMessage,
  getClient,
};
