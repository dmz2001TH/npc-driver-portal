const Database = require('better-sqlite3');
const path = require('path');
const config = require('./config');

const dbPath = path.resolve(config.dbPath);

let db;

function getDb() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  const d = db;
  d.exec(`
    CREATE TABLE IF NOT EXISTS drivers (
      npc_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      customer TEXT,
      bl_number TEXT,
      container_number TEXT,
      container_number_2 TEXT,
      driver_info TEXT,
      driver_npc_id TEXT,
      driver_phone TEXT,
      price REAL,
      unit_type TEXT DEFAULT '30',
      period TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (driver_npc_id) REFERENCES drivers(npc_id)
    );

    CREATE TABLE IF NOT EXISTS salary_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_id TEXT,
      name TEXT,
      total_trips INTEGER,
      price_400 INTEGER DEFAULT 0,
      price_440 INTEGER DEFAULT 0,
      price_470 INTEGER DEFAULT 0,
      price_500 INTEGER DEFAULT 0,
      price_530 INTEGER DEFAULT 0,
      price_550 INTEGER DEFAULT 0,
      price_650 INTEGER DEFAULT 0,
      price_700 INTEGER DEFAULT 0,
      price_750 INTEGER DEFAULT 0,
      price_830 INTEGER DEFAULT 0,
      price_870 INTEGER DEFAULT 0,
      price_1100 INTEGER DEFAULT 0,
      period TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (npc_id) REFERENCES drivers(npc_id)
    );

    CREATE TABLE IF NOT EXISTS special_allowance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_id TEXT,
      name TEXT,
      amount REAL,
      reason TEXT,
      period TEXT,
      type TEXT DEFAULT 'allowance',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (npc_id) REFERENCES drivers(npc_id)
    );

    CREATE TABLE IF NOT EXISTS line_mappings (
      line_user_id TEXT PRIMARY KEY,
      npc_id TEXT NOT NULL,
      name TEXT,
      matched_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (npc_id) REFERENCES drivers(npc_id)
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS employee_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_user_id TEXT,
      npc_id TEXT,
      message TEXT,
      direction TEXT DEFAULT 'inbound',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_npc_id);
    CREATE INDEX IF NOT EXISTS idx_trips_period ON trips(period);
    CREATE INDEX IF NOT EXISTS idx_salary_period ON salary_summary(period);
    CREATE INDEX IF NOT EXISTS idx_allowance_period ON special_allowance(period);
    CREATE INDEX IF NOT EXISTS idx_messages_user ON employee_messages(line_user_id);
  `);
}

// Driver operations
function insertDriver(npcId, name, phone) {
  const d = getDb();
  d.prepare(`INSERT OR REPLACE INTO drivers (npc_id, name, phone) VALUES (?, ?, ?)`).run(npcId, name, phone);
}

function getDriver(npcId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM drivers WHERE npc_id = ?`).get(npcId);
}

function getAllDrivers() {
  const d = getDb();
  return d.prepare(`SELECT * FROM drivers ORDER BY npc_id`).all();
}

function getUnmappedDrivers() {
  const d = getDb();
  return d.prepare(`
    SELECT d.* FROM drivers d
    LEFT JOIN line_mappings l ON d.npc_id = l.npc_id
    WHERE l.npc_id IS NULL
    ORDER BY d.npc_id
  `).all();
}

// Trip operations
function insertTrip(trip) {
  const d = getDb();
  const stmt = d.prepare(`INSERT INTO trips (date, customer, bl_number, container_number, container_number_2, driver_info, driver_npc_id, driver_phone, price, unit_type, period) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  return stmt.run(trip.date, trip.customer, trip.bl_number, trip.container_number, trip.container_number_2, trip.driver_info, trip.driver_npc_id, trip.driver_phone, trip.price, trip.unit_type, trip.period);
}

function clearTrips() {
  getDb().exec('DELETE FROM trips');
}

function getTripsByDriver(npcId, period) {
  const d = getDb();
  if (period) {
    return d.prepare(`SELECT * FROM trips WHERE driver_npc_id = ? AND period = ? ORDER BY date`).all(npcId, period);
  }
  return d.prepare(`SELECT * FROM trips WHERE driver_npc_id = ? ORDER BY date`).all(npcId);
}

// Salary operations
function insertSalarySummary(summary) {
  const d = getDb();
  const stmt = d.prepare(`INSERT INTO salary_summary (npc_id, name, total_trips, price_400, price_440, price_470, price_500, price_530, price_550, price_650, price_700, price_750, price_830, price_870, price_1100, period) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  return stmt.run(summary.npc_id, summary.name, summary.total_trips, summary.price_400 || 0, summary.price_440 || 0, summary.price_470 || 0, summary.price_500 || 0, summary.price_530 || 0, summary.price_550 || 0, summary.price_650 || 0, summary.price_700 || 0, summary.price_750 || 0, summary.price_830 || 0, summary.price_870 || 0, summary.price_1100 || 0, summary.period);
}

function getSalaryByDriver(npcId, period) {
  const d = getDb();
  if (period) {
    return d.prepare(`SELECT * FROM salary_summary WHERE npc_id = ? AND period = ? ORDER BY period DESC`).all(npcId, period);
  }
  return d.prepare(`SELECT * FROM salary_summary WHERE npc_id = ? ORDER BY period DESC`).all(npcId);
}

function clearSalarySummary() {
  getDb().exec('DELETE FROM salary_summary');
}

// Allowance operations
function insertAllowance(allowance) {
  const d = getDb();
  const stmt = d.prepare(`INSERT INTO special_allowance (npc_id, name, amount, reason, period, type) VALUES (?, ?, ?, ?, ?, ?)`);
  return stmt.run(allowance.npc_id, allowance.name, allowance.amount, allowance.reason, allowance.period, allowance.type || 'allowance');
}

function getAllowancesByDriver(npcId, period) {
  const d = getDb();
  if (period) {
    return d.prepare(`SELECT * FROM special_allowance WHERE npc_id = ? AND period = ?`).all(npcId, period);
  }
  return d.prepare(`SELECT * FROM special_allowance WHERE npc_id = ?`).all(npcId);
}

function clearAllowances() {
  getDb().exec('DELETE FROM special_allowance');
}

// LINE mapping operations
function createMapping(lineUserId, npcId, name) {
  const d = getDb();
  d.prepare(`INSERT OR REPLACE INTO line_mappings (line_user_id, npc_id, name) VALUES (?, ?, ?)`).run(lineUserId, npcId, name);
}

function getMappingByLineId(lineUserId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM line_mappings WHERE line_user_id = ?`).get(lineUserId);
}

function getMappingByNpcId(npcId) {
  const d = getDb();
  return d.prepare(`SELECT * FROM line_mappings WHERE npc_id = ?`).get(npcId);
}

function getAllMappings() {
  const d = getDb();
  return d.prepare(`SELECT l.*, d.name as driver_name FROM line_mappings l JOIN drivers d ON l.npc_id = d.npc_id`).all();
}

function deleteMapping(lineUserId) {
  getDb().prepare(`DELETE FROM line_mappings WHERE line_user_id = ?`).run(lineUserId);
}

// Config operations
function getConfig(key) {
  const d = getDb();
  const row = d.prepare(`SELECT value FROM config WHERE key = ?`).get(key);
  return row ? row.value : null;
}

function setConfig(key, value) {
  const d = getDb();
  d.prepare(`INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run(key, value);
}

// Period operations
function getPeriods() {
  const d = getDb();
  return d.prepare(`SELECT period FROM periods ORDER BY id DESC`).all().map(r => r.period);
}

function addPeriod(period) {
  const d = getDb();
  d.prepare(`INSERT OR IGNORE INTO periods (period) VALUES (?)`).run(period);
}

// Message logging
function logMessage(lineUserId, npcId, message, direction = 'inbound') {
  const d = getDb();
  d.prepare(`INSERT INTO employee_messages (line_user_id, npc_id, message, direction) VALUES (?, ?, ?, ?)`).run(lineUserId, npcId, message, direction);
}

function getMessages(lineUserId, limit = 50) {
  const d = getDb();
  return d.prepare(`SELECT * FROM employee_messages WHERE line_user_id = ? ORDER BY created_at DESC LIMIT ?`).all(lineUserId, limit);
}

function getAllChats() {
  const d = getDb();
  return d.prepare(`
    SELECT l.line_user_id, l.npc_id, l.name, d.name as driver_name,
           (SELECT message FROM employee_messages WHERE line_user_id = l.line_user_id ORDER BY created_at DESC LIMIT 1) as last_message,
           (SELECT created_at FROM employee_messages WHERE line_user_id = l.line_user_id ORDER BY created_at DESC LIMIT 1) as last_time
    FROM line_mappings l
    JOIN drivers d ON l.npc_id = d.npc_id
    ORDER BY last_time DESC
  `).all();
}

module.exports = {
  getDb,
  insertDriver,
  getDriver,
  getAllDrivers,
  getUnmappedDrivers,
  insertTrip,
  clearTrips,
  getTripsByDriver,
  insertSalarySummary,
  getSalaryByDriver,
  clearSalarySummary,
  insertAllowance,
  getAllowancesByDriver,
  clearAllowances,
  createMapping,
  getMappingByLineId,
  getMappingByNpcId,
  getAllMappings,
  deleteMapping,
  getConfig,
  setConfig,
  getPeriods,
  addPeriod,
  logMessage,
  getMessages,
  getAllChats,
};
