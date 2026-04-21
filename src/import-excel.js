#!/usr/bin/env node
const path = require('path');
const config = require('./config');
const { importExcel } = require('./excel-parser');

const excelPath = process.argv[2] || path.resolve(config.excelPath);

console.log('=== NPC Driver Portal - Excel Import ===');
try {
  const result = importExcel(excelPath);
  console.log('Done!', result);
} catch (err) {
  console.error('Import failed:', err.message);
  process.exit(1);
}
