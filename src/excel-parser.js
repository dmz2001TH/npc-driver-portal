const XLSX = require('xlsx');
const db = require('./db');

function extractPhone(text) {
  if (!text) return null;
  // Match Thai phone patterns: 0xx-xxx-xxxx or 0xxxxxxxxx
  const match = text.match(/(0\d{2}[-\s]?\d{3}[-\s]?\d{4})/);
  return match ? match[1].replace(/[-\s]/g, '') : null;
}

function extractNpcId(text) {
  if (!text) return null;
  const match = text.match(/NPC\d+/i);
  return match ? match[0].toUpperCase() : null;
}

function extractDriverName(text) {
  if (!text) return null;
  // Format: "73-0044 สบ : ท.3 สุทธิพงศ์ สมานมิตร์ (กุ้ง) 062-608-9738"
  // Extract the Thai name part (before the phone number)
  const cleaned = text.replace(/\d{2}-\d{4}\s*(สป|สบ)\s*:\s*ท\.\d+\s*/, '').trim();
  const namePart = cleaned.replace(/\(.*?\)/g, '').replace(/0\d{2}[-\s]?\d{3}[-\s]?\d{4}/g, '').trim();
  return namePart || null;
}

function formatExcelDate(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') {
    // XLSX date conversion
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }
  return String(val);
}

function parsePeriod(headerRow) {
  // Row 1 contains period info like "CUT OFF 11 MAR - 20 MAR 2026"
  if (!headerRow || !headerRow[0]) return 'UNKNOWN';
  const text = String(headerRow[0]).trim();
  // Extract the date range
  const match = text.match(/(\d+\s+\w+\s*-\s*\d+\s+\w+\s+\d{4})/i);
  if (match) return match[1];
  // Try just the full text
  return text.replace(/CUT\s*OFF\s*/i, '').trim() || 'UNKNOWN';
}

const PRICE_TIERS = [400, 440, 470, 500, 530, 550, 650, 700, 750, 830, 870, 1100];

function parseSummery(sheet) {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (data.length < 5) return { period: 'UNKNOWN', summaries: [] };

  const period = parsePeriod(data[0]);

  // Price tiers are in row 2 (index 1), starting from column E
  // Data rows start from row 5 (index 4)
  const summaries = [];
  for (let i = 4; i < data.length; i++) {
    const row = data[i];
    if (!row[1] && !row[2]) continue; // Skip empty rows

    const npcId = String(row[1] || '').trim();
    const name = String(row[2] || '').trim();
    if (!npcId && !name) continue;

    // Total trips in column Q (index 16) or column D (index 3)
    const totalTrips = parseInt(row[16]) || parseInt(row[3]) || 0;

    // Price tier columns start from E (index 4) to P (index 15)
    const priceCounts = {};
    PRICE_TIERS.forEach((price, idx) => {
      priceCounts[`price_${price}`] = parseInt(row[4 + idx]) || 0;
    });

    // Calculate total
    let calculatedTotal = 0;
    PRICE_TIERS.forEach((price, idx) => {
      calculatedTotal += (parseInt(row[4 + idx]) || 0);
    });

    summaries.push({
      npc_id: npcId,
      name: name,
      total_trips: totalTrips || calculatedTotal,
      ...priceCounts,
      period,
    });
  }

  return { period, summaries };
}

function parseSheet1(sheet) {
  // Use raw: false so XLSX auto-converts dates
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
  if (data.length < 2) return [];

  // Sheet1 has no header - all rows are data starting from row 0
  const trips = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row[0] && !row[1]) continue;

    const date = formatExcelDate(row[0]);
    const customer = row[1] ? String(row[1]).trim() : '';
    const blNumber = row[2] ? String(row[2]).trim() : '';
    const containerNo = row[3] ? String(row[3]).trim() : '';
    const containerNo2 = row[4] ? String(row[4]).trim() : '';
    const driverInfo = row[5] ? String(row[5]).trim() : '';
    const price = parseFloat(row[6]) || 0;

    const phone = extractPhone(driverInfo);
    const npcId = extractNpcId(driverInfo);

    trips.push({
      date,
      customer,
      bl_number: blNumber,
      container_number: containerNo,
      container_number_2: containerNo2,
      driver_info: driverInfo,
      driver_npc_id: npcId,
      driver_phone: phone,
      price,
      unit_type: '30',
    });
  }

  return trips;
}

function parseDetail(sheet) {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (data.length < 2) return { unit30: [], unit20: [] };

  // Left side (A-G): 30 UNIT, Right side (H-N): 20 UNIT
  const trips30 = [];
  const trips20 = [];

  let startRow = 0;
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i].map(c => String(c).toLowerCase());
    if (row.some(c => c.includes('date'))) {
      startRow = i;
      break;
    }
  }

  for (let i = startRow + 1; i < data.length; i++) {
    const row = data[i];

    // 30 UNIT (columns A-G)
    if (row[0] && String(row[0]).trim()) {
      const date = String(row[0]).trim();
      const customer = String(row[1] || '').trim();
      const bl = String(row[2] || '').trim();
      const container = String(row[3] || '').trim();
      const driverInfo = String(row[4] || '').trim();
      const price = parseFloat(row[5]) || 0;
      const phone = extractPhone(driverInfo);
      const npcId = extractNpcId(driverInfo);

      trips30.push({
        date, customer, bl_number: bl, container_number: container,
        driver_info: driverInfo, driver_npc_id: npcId, driver_phone: phone,
        price, unit_type: '30',
      });
    }

    // 20 UNIT (columns H-N)
    if (row[7] && String(row[7]).trim()) {
      const date = String(row[7]).trim();
      const customer = String(row[8] || '').trim();
      const bl = String(row[9] || '').trim();
      const container = String(row[10] || '').trim();
      const driverInfo = String(row[11] || '').trim();
      const price = parseFloat(row[12]) || 0;
      const phone = extractPhone(driverInfo);
      const npcId = extractNpcId(driverInfo);

      trips20.push({
        date, customer, bl_number: bl, container_number: container,
        driver_info: driverInfo, driver_npc_id: npcId, driver_phone: phone,
        price, unit_type: '20',
      });
    }
  }

  return { unit30: trips30, unit20: trips20 };
}

function parseAllowanceDeducted(sheet) {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (data.length < 3) return { allowances: [], deductions: [] };

  const allowances = [];
  const deductions = [];
  let section = 'allowance'; // Start with allowances

  // Find the "Deducted" section
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const firstCol = String(row[0] || '').toLowerCase();

    if (firstCol.includes('deduct') || firstCol.includes('หัก')) {
      section = 'deduction';
      continue;
    }

    // Skip header rows
    if (firstCol.includes('no') || firstCol.includes('npc') || firstCol.includes('name') || firstCol.includes('ลำดับ')) {
      continue;
    }

    const npcId = String(row[1] || '').trim();
    const name = String(row[2] || '').trim();
    const amount = parseFloat(row[3]) || 0;
    const reason = String(row[4] || '').trim();

    if (!npcId && !name) continue;

    const item = { npc_id: npcId, name, amount, reason, type: section };
    if (section === 'allowance') {
      allowances.push(item);
    } else {
      deductions.push(item);
    }
  }

  return { allowances, deductions };
}

function importExcel(excelPath) {
  console.log(`Reading Excel: ${excelPath}`);
  const wb = XLSX.readFile(excelPath);
  console.log(`Sheets: ${wb.SheetNames.join(', ')}`);

  // Clear existing data
  db.clearTrips();
  db.clearSalarySummary();
  db.clearAllowances();

  // Parse Summery
  const summerySheet = wb.Sheets['Summery'];
  if (summerySheet) {
    const { period, summaries } = parseSummery(summerySheet);
    console.log(`Period: ${period}, Drivers: ${summaries.length}`);
    db.addPeriod(period);

    for (const s of summaries) {
      db.insertDriver(s.npc_id, s.name, null);
      db.insertSalarySummary({ ...s, period });
    }
  }

  // Parse Sheet1 (trips)
  const sheet1 = wb.Sheets['Sheet1'];
  if (sheet1) {
    const trips = parseSheet1(sheet1);
    // Get period from summery
    let period = 'UNKNOWN';
    if (summerySheet) {
      const data = XLSX.utils.sheet_to_json(summerySheet, { header: 1, defval: '' });
      period = parsePeriod(data[0]);
    }

    for (const trip of trips) {
      db.insertTrip({ ...trip, period });
    }
    console.log(`Trips imported: ${trips.length}`);
  }

  // Parse Detail
  const detailSheet = wb.Sheets['Detail'];
  if (detailSheet) {
    const { unit30, unit20 } = parseDetail(detailSheet);
    let period = 'UNKNOWN';
    if (summerySheet) {
      const data = XLSX.utils.sheet_to_json(summerySheet, { header: 1, defval: '' });
      period = parsePeriod(data[0]);
    }

    for (const trip of [...unit30, ...unit20]) {
      if (trip.driver_npc_id) {
        db.insertTrip({ ...trip, period });
      }
    }
    console.log(`Detail trips: 30-unit=${unit30.length}, 20-unit=${unit20.length}`);
  }

  // Parse Allowance/Deducted
  const allowanceSheet = wb.Sheets[' Special Allowance and Deducted'] || wb.Sheets['Special Allowance and Deducted'];
  if (allowanceSheet) {
    const { allowances, deductions } = parseAllowanceDeducted(allowanceSheet);
    let period = 'UNKNOWN';
    if (summerySheet) {
      const data = XLSX.utils.sheet_to_json(summerySheet, { header: 1, defval: '' });
      period = parsePeriod(data[0]);
    }

    for (const a of [...allowances, ...deductions]) {
      if (a.npc_id) {
        db.insertDriver(a.npc_id, a.name, null);
        db.insertAllowance({ ...a, period });
      }
    }
    console.log(`Allowances: ${allowances.length}, Deductions: ${deductions.length}`);
  }

  // Match trips to drivers by nickname or create new driver records from Sheet1
  const d = db.getDb();

  // Build nickname map from Summery drivers: "(Peet)" -> npc_id
  const allDrivers = d.prepare(`SELECT npc_id, name FROM drivers`).all();
  const nicknameMap = {};
  for (const dr of allDrivers) {
    const nickMatch = dr.name.match(/\(([^)]+)\)/);
    if (nickMatch) {
      nicknameMap[nickMatch[1].toLowerCase()] = dr.npc_id;
    }
  }

  // Collect unique driver info from trips
  const tripDriverMap = {};
  const allTrips = d.prepare(`SELECT id, driver_phone, driver_info FROM trips`).all();
  for (const t of allTrips) {
    if (!t.driver_info) continue;
    const codeMatch = t.driver_info.match(/^(\d+-\d+)/);
    if (codeMatch) {
      const code = codeMatch[1];
      if (!tripDriverMap[code]) {
        const phone = extractPhone(t.driver_info);
        const nickMatch = t.driver_info.match(/\(([^)]+)\)/);
        const name = extractDriverName(t.driver_info);
        tripDriverMap[code] = { code, name, nick: nickMatch ? nickMatch[1] : null, phone, info: t.driver_info };
      }
    }
  }

  // Create driver records for Sheet1 drivers that don't match Summery
  const createdCodes = {};
  for (const [code, info] of Object.entries(tripDriverMap)) {
    // Try to match by nickname
    let npcId = null;
    if (info.nick) {
      npcId = nicknameMap[info.nick.toLowerCase()] || null;
    }

    // If no match, create a driver record using code as ID
    if (!npcId) {
      npcId = `DRV${code.replace('-', '')}`;
      const existing = d.prepare(`SELECT npc_id FROM drivers WHERE npc_id = ?`).get(npcId);
      if (!existing) {
        d.prepare(`INSERT INTO drivers (npc_id, name, phone) VALUES (?, ?, ?)`).run(npcId, info.name || `Driver ${code}`, info.phone);
      }
    }
    createdCodes[code] = npcId;
  }

  // Update trips with driver_npc_id
  let matchedCount = 0;
  for (const t of allTrips) {
    if (!t.driver_info) continue;
    const codeMatch = t.driver_info.match(/^(\d+-\d+)/);
    if (codeMatch) {
      const npcId = createdCodes[codeMatch[1]];
      if (npcId) {
        d.prepare(`UPDATE trips SET driver_npc_id = ? WHERE id = ?`).run(npcId, t.id);
        matchedCount++;
      }
    }
  }

  // Update driver phones from matched trips
  const phoneUpdates = d.prepare(`SELECT DISTINCT driver_npc_id, driver_phone FROM trips WHERE driver_phone IS NOT NULL AND driver_npc_id IS NOT NULL`).all();
  for (const t of phoneUpdates) {
    d.prepare(`UPDATE drivers SET phone = ? WHERE npc_id = ? AND (phone IS NULL OR phone = '')`).run(t.driver_phone, t.driver_npc_id);
  }

  const total = d.prepare(`SELECT COUNT(*) as c FROM trips`).get().c;
  console.log(`Driver matching: ${matchedCount}/${total} trips matched to drivers`);

  console.log('Import complete!');
  return { success: true };
}

module.exports = {
  importExcel,
  parseSummery,
  parseSheet1,
  parseDetail,
  parseAllowanceDeducted,
  extractPhone,
  extractNpcId,
  extractDriverName,
  formatExcelDate,
};
