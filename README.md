# 🚛 NPC Driver Portal

LINE Bot for NPC truck drivers — ระบบจัดการข้อมูลคนขับรถบรรทุก

## Quick Start

```bash
# 1. Install
cd npc-driver-portal
npm install

# 2. Import Excel data
npm run import

# 3. Configure LINE (edit .env or use Admin Panel)
cp .env.example .env
# Edit .env with your LINE credentials

# 4. Start server
npm start
# → http://localhost:4000/admin
```

## Features

- **💰 เช็คเงินเดือน** — สรุปรายได้ แยกตาม price tier + เงินพิเศษ/หัก
- **🚛 การวิ่งงาน** — รายการเที่ยว วันที่ ลูกค้า ตู้ ราคา
- **🔗 จับคู่บัญชี** — จับคู่ LINE กับรหัสพนักงาน (กดเลือก/ส่งเบอร์/แอดมินจัดการ)
- **📞 ติดต่อแอดมิน** — ส่งข้อความหาแอดมิน
- **Admin Panel** — ตั้งค่า LINE, import Excel, ดูบทสนทนา, สร้าง Rich Menu

## Tech Stack

- Node.js + Express
- LINE Messaging API (`@line/bot-sdk`)
- SQLite (`better-sqlite3`)
- Excel Parser (`xlsx`)
- Google Sheets API (`googleapis`)

## Commands

| Command | Description |
|---------|-------------|
| `npm start` | รัน server |
| `npm run dev` | Dev mode (auto-reload) |
| `npm run import` | Import จาก Excel |
| `npm run sync` | Sync จาก Google Sheets |
| `npm run setup-menu` | สร้าง Rich Menu |

## Admin Panel

ไปที่ `http://localhost:4000/admin` เพื่อ:
- ตั้งค่า LINE credentials
- Import Excel
- ดูรายชื่อที่จับคู่แล้ว
- ดู/ตอบข้อความพนักงาน
- สร้าง Rich Menu

## Environment Variables

```env
LINE_CHANNEL_SECRET=     # จาก LINE Developers Console
LINE_CHANNEL_ACCESS_TOKEN=  # จาก LINE Developers Console
PORT=4000
ADMIN_LINE_USER_ID=      # LINE User ID ของแอดมิน
DB_PATH=./data/drivers.db
EXCEL_PATH=./data/template.xlsx
```

## Project Structure

```
src/
├── config.js              — Environment config
├── db.js                  — SQLite schema + CRUD
├── excel-parser.js        — Parse 4 sheets from Excel
├── import-excel.js        — CLI: npm run import
├── index.js               — Express server + webhook
├── admin.js               — Admin Web UI
├── setup-richmenu.js      — Rich Menu setup
├── google-sheets-sync.js  — Google Sheets sync
└── bot/handler.js         — LINE event handler
```
