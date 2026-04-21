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
      bounds: { x: 0, y: 0, width: 1250, height: 421 },
      action: { type: 'postback', data: 'action=salary', displayText: '💰 เช็คเงินเดือน' },
    },
    {
      bounds: { x: 1250, y: 0, width: 1250, height: 421 },
      action: { type: 'postback', data: 'action=trips', displayText: '🚛 การวิ่งงาน' },
    },
    {
      bounds: { x: 0, y: 421, width: 1250, height: 422 },
      action: { type: 'postback', data: 'action=link', displayText: '🔗 จับคู่บัญชี' },
    },
    {
      bounds: { x: 1250, y: 421, width: 1250, height: 422 },
      action: { type: 'postback', data: 'action=admin', displayText: '📞 ติดต่อแอดมิน' },
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
  <text x="1250" y="70" text-anchor="middle" fill="#ffffff" font-size="48" font-weight="bold" font-family="sans-serif">🚛 NPC Driver Portal</text>

  <!-- Grid lines -->
  <line x1="1250" y1="80" x2="1250" y2="843" stroke="#ffffff22" stroke-width="2"/>
  <line x1="0" y1="460" x2="2500" y2="460" stroke="#ffffff22" stroke-width="2"/>

  <!-- Button 1: Salary -->
  <text x="625" y="260" text-anchor="middle" fill="#1DB446" font-size="80">💰</text>
  <text x="625" y="350" text-anchor="middle" fill="#ffffff" font-size="48" font-weight="bold" font-family="sans-serif">เช็คเงินเดือน</text>

  <!-- Button 2: Trips -->
  <text x="1875" y="260" text-anchor="middle" fill="#FF6B35" font-size="80">🚛</text>
  <text x="1875" y="350" text-anchor="middle" fill="#ffffff" font-size="48" font-weight="bold" font-family="sans-serif">การวิ่งงาน</text>

  <!-- Button 3: Link -->
  <text x="625" y="640" text-anchor="middle" fill="#4ECDC4" font-size="80">🔗</text>
  <text x="625" y="730" text-anchor="middle" fill="#ffffff" font-size="48" font-weight="bold" font-family="sans-serif">จับคู่บัญชี</text>

  <!-- Button 4: Admin -->
  <text x="1875" y="640" text-anchor="middle" fill="#FFD93D" font-size="80">📞</text>
  <text x="1875" y="730" text-anchor="middle" fill="#ffffff" font-size="48" font-weight="bold" font-family="sans-serif">ติดต่อแอดมิน</text>
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
