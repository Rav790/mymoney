<<<<<<< HEAD
# MyMoney

**MyMoney** is a modern, mobile-first personal finance manager built with React + Tailwind CSS.  
It runs fully on the client and stores data in `localStorage` (no backend required).

---

## Features

- Dashboard with total balance, income vs expense, recent transactions, budget preview, and savings progress
- Transactions module with search, filters, sorting, calendar grouping, edit/delete, and swipe-to-delete (mobile)
- Add/Edit transaction form with receipt upload (base64), account/category selection, and validation
- Budget planner with monthly category budgets, progress bars, rollover support, and remaining amount
- Accounts with custom icons/colors, balances, account types, and transfer between accounts
- Analytics with Recharts:
  - Monthly income vs expense (bar)
  - Expense breakdown (pie)
  - Cash flow (line)
  - Savings growth (area)
  - Top spending categories, spending heatmap, month-over-month comparison
- Savings goals with target tracking, contribution history, completion flow, and countdown
- Recurring transactions with due-date simulation and auto-log support
- Reports with monthly/yearly summaries, CSV export, and printable view
- Settings:
  - Profile + avatar
  - Currency and decimals
  - Dark mode
  - Backup/restore JSON
  - Clear all data
  - Category Manager (add/edit/delete custom categories)
- Security:
  - 4-digit passcode lock (hashed)
  - Auto-lock after inactivity
  - First-time onboarding after PIN setup (user name + avatar)

---

## Tech Stack

- **React** (Vite)
- **Tailwind CSS**
- **Recharts**
- **date-fns**
- **lucide-react**
- **localStorage** for persistence

---

## Local Setup

### Prerequisites

- Node.js 18+ (20+ recommended)
- npm

### Install and run

```bash
npm install
npm run dev
```

Open the local URL shown by Vite (usually `http://localhost:5173`).

### Production build

```bash
npm run build
npm run preview
```

---

## Data Storage

- App data key: **`mymoney_data`**
- Data is persisted in browser `localStorage`
- To reset manually from browser console:

```js
localStorage.removeItem('mymoney_data');
```

---

## Deploy to Netlify

### Option 1: Git-based (recommended)

1. Push this project to GitHub
2. In Netlify: **Add new site → Import an existing project**
3. Select your GitHub repository
4. Use:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Click **Deploy site**

### Option 2: Manual deploy

```bash
npm run build
```

Then drag the `dist` folder into Netlify’s manual deploy UI.

---

## Project Scripts

- `npm run dev` → Start development server
- `npm run build` → Create production build
- `npm run preview` → Preview production build locally
- `npm run lint` → Run ESLint

---

## Notes

- Default currency is **INR (₹)**
- On first launch, financial values start empty so users can enter their own data
- This is a client-only app; no external API calls are required
- All data is stored locally in the browser; clearing browser data will reset the app
- For any issues or feature requests, please open an issue on GitHub.

---## License 
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
