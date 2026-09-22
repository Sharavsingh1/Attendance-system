# KCCITM Attendance Management System — Node.js 24 Windows Edition

A full-stack college attendance project using Express, JWT, bcryptjs and a local JSON database.

## Why this version?

The original project used `better-sqlite3`, which can require native C++ build tools on Windows. This edition removes that native dependency, so Node.js 24 can install the project without Visual Studio C++ build tools.

## Requirements

- Node.js 20+ (tested design target: Node.js 24 on Windows)
- VS Code or another editor

## Run on Windows

1. Extract the ZIP.
2. Open the **kccitm-attendance** folder in VS Code.
3. Open Terminal → New Terminal.
4. If PowerShell blocks `npm.ps1`, use **Command Prompt** in VS Code, or use `npm.cmd`.
5. Make sure the terminal is in the main project folder, NOT `public`.
6. Run:

```cmd
npm install
npm start
```

If using PowerShell:

```powershell
npm.cmd install
npm.cmd start
```

7. Open http://localhost:3000

## Demo accounts

Student:
- Email: student@kccitm.org
- Password: student123

Admin:
- Email: admin@kccitm.org
- Password: admin123

## Data storage

The first server start creates `attendance-data.json` in the project folder. It stores users, subjects and attendance records locally. Do not commit this file to a public repository if it contains real student data.

## Features

- Student registration/login
- Admin login
- JWT authentication
- Overall attendance dashboard
- Subject-wise attendance
- Attendance history
- Admin attendance management
- Subject management
- Local persistent database without native Node modules
- Responsive KCCITM-style UI

## Production note

Set a strong `JWT_SECRET` environment variable and replace the demo credentials before real deployment. For a real college deployment, use a proper hosted database and add appropriate authentication, authorization, backups and privacy controls.
