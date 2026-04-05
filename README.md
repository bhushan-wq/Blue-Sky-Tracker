# Blue Sky Compliance Tracker

A full-stack compliance tool for private fund managers to track Reg D 506(b) and 506(c) blue sky (state securities) notice filing obligations based on an investor pipeline.

## Features

- **Fund Management** — Create and manage Reg D funds (506(b) and 506(c))
- **Investor Pipeline** — Track investors by state and pipeline stage (prospect / committed / closed)
- **Auto-Filing Generation** — Filing obligations are automatically created when investors move to committed or closed stage
- **Filing Tracker** — Track status of all state notice filings (pending / filed / overdue / not required)
- **Dashboard** — At-a-glance view of overdue filings, upcoming deadlines, and fund health
- **State Rules Reference** — Inline-editable table of all 51 jurisdictions with filing requirements, fees, and deadlines
- **Overdue Detection** — Filings past their due date are automatically flagged overdue
- **CSV Export** — Export state rules to CSV

## Tech Stack

- **Frontend**: React 18 + Vite + React Router v6 + Tailwind CSS
- **Backend**: Express.js + better-sqlite3 (SQLite)
- **Database**: SQLite stored at `backend/data/blue_sky.db`

## Setup

### Prerequisites
- Node.js 18+ and npm

### Install all dependencies

```bash
npm run install:all
```

### Start development servers

```bash
npm run dev
```

This starts:
- Backend API on `http://localhost:3001`
- Frontend on `http://localhost:5173`

Open `http://localhost:5173` in your browser.

## Usage

1. **Create a Fund** — Go to Funds, click "New Fund", enter fund name, exemption type (506b or 506c), and first sale date
2. **Add Investors** — Navigate to a fund, go to the Investor Pipeline tab, add investors with their state and pipeline stage
3. **Track Filings** — When an investor is set to "committed" or "closed", a filing obligation is auto-generated
4. **Manage Filing Status** — Use the Filing Tracker to mark filings as filed, add confirmation numbers, and record fees paid
5. **Review State Rules** — Use the State Rules Reference to verify filing requirements for each state

## Important Disclaimer

The state rules data included in this application was compiled for informational purposes and was last verified January 2024. State securities laws and filing requirements change frequently. **Always verify current requirements with a qualified securities attorney or each state's securities regulator before filing.** This tool is not a substitute for legal advice.

## Project Structure

```
blue-sky-tracker/
  package.json              # Root: runs both servers concurrently
  backend/
    index.js                # Express server (port 3001)
    db.js                   # SQLite setup, schema, and seed
    routes/
      funds.js
      investors.js
      filings.js
      state_rules.js
    seed/
      state_rules_data.js   # All 51 jurisdictions pre-populated
    data/
      blue_sky.db           # SQLite database (auto-created)
  frontend/
    src/
      pages/
        Dashboard.jsx
        FundList.jsx
        FundDetail.jsx
        FilingTracker.jsx
        StateRulesRef.jsx
        InvestorPipeline.jsx
      components/
        Layout.jsx
        Modal.jsx
        StatusBadge.jsx
```
