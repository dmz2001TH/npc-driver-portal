require('dotenv').config();

module.exports = {
  port: process.env.PORT || 4000,
  line: {
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  },
  adminUserId: process.env.ADMIN_LINE_USER_ID || '',
  dbPath: process.env.DB_PATH || './data/drivers.db',
  excelPath: process.env.EXCEL_PATH || './data/template.xlsx',
  google: {
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
    serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT || './data/gservice-account.json',
    apiKey: process.env.GOOGLE_API_KEY || '',
  },
  autoSyncInterval: parseInt(process.env.AUTO_SYNC_INTERVAL) || 900000,
};
