const express = require('express');
const line = require('@line/bot-sdk');
const config = require('./config');
const db = require('./db');
const admin = require('./admin');
const { handleEvent } = require('./bot/handler');

// Validate LINE config
const lineConfig = {
  channelSecret: config.line.channelSecret,
  channelAccessToken: config.line.channelAccessToken,
};

const app = express();
const PORT = config.port;

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'NPC Driver Portal',
    drivers: db.getAllDrivers().length,
    mappings: db.getAllMappings().length,
  });
});

// LINE Webhook — only register if credentials are configured
if (lineConfig.channelSecret && lineConfig.channelAccessToken) {
  app.post('/webhook', line.middleware(lineConfig), async (req, res) => {
    try {
      await Promise.all(req.body.events.map(handleEvent));
      res.json({ success: true });
    } catch (err) {
      console.error('Webhook error:', err);
      res.status(500).json({ error: err.message });
    }
  });
} else {
  app.post('/webhook', (req, res) => {
    res.status(503).json({ error: 'LINE not configured. Set credentials in Admin Panel first.' });
  });
}

// Admin panel
app.use('/admin', admin);

// Initialize database on startup
console.log('Initializing database...');
db.getDb(); // This triggers schema creation

// Auto-sync from Excel if file exists
const fs = require('fs');
if (fs.existsSync(config.excelPath)) {
  console.log('Auto-importing Excel data...');
  try {
    const { importExcel } = require('./excel-parser');
    importExcel(config.excelPath);
  } catch (err) {
    console.error('Auto-import failed:', err.message);
  }
}

// Auto-sync from Google Sheets
const googleSyncInterval = config.autoSyncInterval;
let syncInterval = null;

async function startGoogleSync() {
  const spreadsheetId = db.getConfig('GOOGLE_SPREADSHEET_ID') || config.google.spreadsheetId;
  const serviceAccountPath = db.getConfig('GOOGLE_SERVICE_ACCOUNT') || config.google.serviceAccount;

  if (!spreadsheetId) {
    console.log('Google Sheets not configured — skipping auto-sync');
    return;
  }

  if (!fs.existsSync(serviceAccountPath)) {
    console.log('Google service account not found — skipping auto-sync');
    return;
  }

  try {
    const { syncFromGoogleSheets } = require('./google-sheets-sync');
    console.log('Starting Google Sheets auto-sync...');
    await syncFromGoogleSheets(spreadsheetId, serviceAccountPath);

    syncInterval = setInterval(async () => {
      try {
        await syncFromGoogleSheets(spreadsheetId, serviceAccountPath);
        console.log('[Auto-sync] Google Sheets sync complete');
      } catch (err) {
        console.error('[Auto-sync] Failed:', err.message);
      }
    }, googleSyncInterval);
  } catch (err) {
    console.error('Google sync setup failed:', err.message);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  if (syncInterval) clearInterval(syncInterval);
  console.log('Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (syncInterval) clearInterval(syncInterval);
  process.exit(0);
});

app.listen(PORT, async () => {
  console.log(`
╔══════════════════════════════════════╗
║   🚛 NPC Driver Portal               ║
║   Running on port ${PORT}              ║
║   Admin: http://localhost:${PORT}/admin ║
╚══════════════════════════════════════╝
  `);

  // Start Google sync after server is up
  startGoogleSync();
});
