const { google } = require('googleapis');
const db = require('./db');
const { importExcel } = require('./excel-parser');
const fs = require('fs');
const path = require('path');

// Parse Google Spreadsheet ID from URL or direct ID
function extractSpreadsheetId(input) {
  if (!input) return '';
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input;
}

async function syncFromGoogleSheets(spreadsheetIdOrUrl, serviceAccountPath) {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account file not found: ${serviceAccountPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  console.log(`[Google Sync] Syncing from spreadsheet: ${spreadsheetId}`);

  // Get all sheets
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetNames = spreadsheet.data.sheets.map(s => s.properties.title);
  console.log(`[Google Sync] Sheets: ${sheetNames.join(', ')}`);

  // Read each sheet
  for (const sheetName of sheetNames) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheetName,
    });

    const rows = response.data.values || [];
    console.log(`[Google Sync] Sheet "${sheetName}": ${rows.length} rows`);

    // Process based on sheet name
    if (sheetName.toLowerCase().includes('summery') || sheetName.toLowerCase().includes('summary')) {
      processSummarySheet(rows);
    } else if (sheetName.toLowerCase() === 'sheet1') {
      processTripsSheet(rows);
    } else if (sheetName.toLowerCase().includes('allowance') || sheetName.toLowerCase().includes('deduct')) {
      processAllowanceSheet(rows);
    }
  }

  console.log('[Google Sync] Sync complete');
}

function processSummarySheet(rows) {
  if (rows.length < 5) return;

  // Parse period from row 1
  const periodText = rows[0]?.[0] || '';
  const period = periodText.replace(/CUT\s*OFF\s*/i, '').trim() || 'UNKNOWN';
  db.addPeriod(period);

  const PRICE_TIERS = [400, 440, 470, 500, 530, 550, 650, 700, 750, 830, 870, 1100];

  for (let i = 4; i < rows.length; i++) {
    const row = rows[i];
    if (!row[1] && !row[2]) continue;

    const npcId = String(row[1] || '').trim();
    const name = String(row[2] || '').trim();
    if (!npcId && !name) continue;

    const totalTrips = parseInt(row[16]) || parseInt(row[3]) || 0;
    const priceCounts = {};
    let calculatedTotal = 0;
    PRICE_TIERS.forEach((price, idx) => {
      const count = parseInt(row[4 + idx]) || 0;
      priceCounts[`price_${price}`] = count;
      calculatedTotal += count;
    });

    db.insertDriver(npcId, name, null);
    db.insertSalarySummary({
      npc_id: npcId,
      name,
      total_trips: totalTrips || calculatedTotal,
      ...priceCounts,
      period,
    });
  }
}

function processTripsSheet(rows) {
  if (rows.length < 2) return;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] && !row[1]) continue;

    const { extractPhone, extractNpcId } = require('./excel-parser');
    const driverInfo = row[5] || '';

    db.insertTrip({
      date: row[0] || '',
      customer: row[1] || '',
      bl_number: row[2] || '',
      container_number: row[3] || '',
      container_number_2: row[4] || '',
      driver_info: driverInfo,
      driver_npc_id: extractNpcId(driverInfo),
      driver_phone: extractPhone(driverInfo),
      price: parseFloat(row[6]) || 0,
      unit_type: '30',
      period: 'AUTO',
    });
  }
}

function processAllowanceSheet(rows) {
  if (rows.length < 3) return;

  let section = 'allowance';
  for (const row of rows) {
    const firstCol = String(row[0] || '').toLowerCase();
    if (firstCol.includes('deduct')) {
      section = 'deduction';
      continue;
    }

    const npcId = String(row[1] || '').trim();
    const name = String(row[2] || '').trim();
    const amount = parseFloat(row[3]) || 0;
    const reason = String(row[4] || '').trim();

    if (!npcId && !name) continue;

    db.insertDriver(npcId, name, null);
    db.insertAllowance({
      npc_id: npcId,
      name,
      amount,
      reason,
      period: 'AUTO',
      type: section,
    });
  }
}

module.exports = { syncFromGoogleSheets, extractSpreadsheetId };
