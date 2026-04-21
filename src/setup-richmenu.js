const line = require('@line/bot-sdk');
const config = require('./config');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RICH_MENU_SIZE = { width: 2500, height: 843 };

const richMenu = {
  size: RICH_MENU_SIZE,
  selected: true,
  name: 'NPC Driver Portal',
  chatBarText: '📋 เมนู',
  areas: [
    {
      bounds: { x: 0, y: 0, width: 833, height: 421 },
      action: { type: 'postback', data: 'action=salary', displayText: '💰 เช็คเงินเดือน' },
    },
    {
      bounds: { x: 833, y: 0, width: 834, height: 421 },
      action: { type: 'postback', data: 'action=trips', displayText: '🚛 การวิ่งงาน' },
    },
    {
      bounds: { x: 1667, y: 0, width: 833, height: 421 },
      action: { type: 'postback', data: 'action=link', displayText: '🔗 จับคู่บัญชี' },
    },
    {
      bounds: { x: 0, y: 421, width: 833, height: 422 },
      action: { type: 'postback', data: 'action=admin', displayText: '📞 ติดต่อแอดมิน' },
    },
    {
      bounds: { x: 833, y: 421, width: 834, height: 422 },
      action: { type: 'postback', data: 'action=greeting', displayText: '👋 สวัสดี/ทักทาย' },
    },
    {
      bounds: { x: 1667, y: 421, width: 833, height: 422 },
      action: { type: 'postback', data: 'action=help', displayText: '📘 วิธีใช้งาน' },
    },
  ],
};

// SVG for rich menu (convert to PNG)
function generateRichMenuSVG() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="843" viewBox="0 0 2500 843">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
  </defs>
  <rect width="2500" height="843" fill="url(#bg)" rx="20"/>

  <!-- Title -->
  <text x="1250" y="60" text-anchor="middle" fill="#ffffff" font-size="42" font-weight="bold" font-family="sans-serif">🚛 NPC Driver Portal</text>

  <!-- Grid lines -->
  <line x1="833" y1="70" x2="833" y2="843" stroke="#ffffff22" stroke-width="2"/>
  <line x1="1667" y1="70" x2="1667" y2="843" stroke="#ffffff22" stroke-width="2"/>
  <line x1="0" y1="456" x2="2500" y2="456" stroke="#ffffff22" stroke-width="2"/>

  <!-- Row 1 -->
  <text x="416" y="250" text-anchor="middle" fill="#1DB446" font-size="64">💰</text>
  <text x="416" y="340" text-anchor="middle" fill="#ffffff" font-size="40" font-weight="bold" font-family="sans-serif">เช็คเงินเดือน</text>

  <text x="1250" y="250" text-anchor="middle" fill="#FF6B35" font-size="64">🚛</text>
  <text x="1250" y="340" text-anchor="middle" fill="#ffffff" font-size="40" font-weight="bold" font-family="sans-serif">การวิ่งงาน</text>

  <text x="2083" y="250" text-anchor="middle" fill="#4ECDC4" font-size="64">🔗</text>
  <text x="2083" y="340" text-anchor="middle" fill="#ffffff" font-size="40" font-weight="bold" font-family="sans-serif">จับคู่บัญชี</text>

  <!-- Row 2 -->
  <text x="416" y="630" text-anchor="middle" fill="#FFD93D" font-size="64">📞</text>
  <text x="416" y="720" text-anchor="middle" fill="#ffffff" font-size="40" font-weight="bold" font-family="sans-serif">ติดต่อแอดมิน</text>

  <text x="1250" y="630" text-anchor="middle" fill="#E84393" font-size="64">👋</text>
  <text x="1250" y="720" text-anchor="middle" fill="#ffffff" font-size="40" font-weight="bold" font-family="sans-serif">สวัสดี/ทักทาย</text>

  <text x="2083" y="630" text-anchor="middle" fill="#6C5CE7" font-size="64">📘</text>
  <text x="2083" y="720" text-anchor="middle" fill="#ffffff" font-size="40" font-weight="bold" font-family="sans-serif">วิธีใช้งาน</text>
</svg>`;
}

async function createRichMenu() {
  const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: config.line.channelAccessToken,
  });

  console.log('Creating rich menu...');
  const { richMenuId } = await client.createRichMenu(richMenu);
  console.log(`Rich menu ID: ${richMenuId}`);

  // Generate PNG from SVG
  const svgPath = path.join(__dirname, '../../data/richmenu.svg');
  const pngPath = path.join(__dirname, '../../data/richmenu.png');

  fs.writeFileSync(svgPath, generateRichMenuSVG());
  console.log('SVG written to', svgPath);

  try {
    execSync(`rsvg-convert -w 2500 -h 843 "${svgPath}" -o "${pngPath}"`);
    console.log('PNG generated at', pngPath);
  } catch (err) {
    console.error('rsvg-convert failed. Install with: sudo apt install librsvg2-bin');
    console.error('Or manually convert the SVG to 2500x843 PNG');
    throw err;
  }

  // Upload image
  const imageBuffer = fs.readFileSync(pngPath);
  const boundary = '----FormBoundary' + Date.now();
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="richmenu.png"\r\nContent-Type: image/png\r\n\r\n`),
    imageBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const response = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Authorization': `Bearer ${config.line.channelAccessToken}`,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
  }
  console.log('Rich menu image uploaded');

  // Set as default
  await client.setDefaultRichMenu(richMenuId);
  console.log('Rich menu set as default');

  return richMenuId;
}

module.exports = { createRichMenu, generateRichMenuSVG, richMenu };

// CLI
if (require.main === module) {
  createRichMenu().then(id => {
    console.log(`Done! Rich menu ID: ${id}`);
  }).catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
}
