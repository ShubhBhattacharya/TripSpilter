# TripSplit 🇮🇳 — Collaborative Trip Planner & Direct-to-Vendor UPI Bill Splitter

> **Zero-Float, Escrow-Free Group Expense & Outing Manager built specifically for India.**

TripSplit solves the classic Indian trip dilemma: nobody wants to pay ₹4,000 upfront at a cafe standee and spend days chasing friends on WhatsApp. With TripSplit, scan any merchant UPI QR (Paytm, BharatPe, PhonePe, GPay), enter the bill amount, and every group member instantly gets a personalized QR code loaded with their exact share to pay the vendor directly.

---

## 🌟 Key Features

### 1. ⚡ Direct-to-Vendor UPI QR Split (Core USP)
- **Zero-Float Architecture**: Payments go directly from each member's UPI app (Google Pay, PhonePe, Paytm, BHIM, Cred) straight into the merchant's bank account.
- **Dynamic Scannable QRs**: Generates valid `upi://pay?pa=...&am=...&cu=INR` QR codes tailored for each participant with `qrcode.react`.
- **Flexible Splitting**:
  - **Equal Split**: Even division across all or selected members.
  - **Exact Custom**: Set bespoke rupee amounts per member.
  - **Itemized Split (AI OCR)**: Upload or snap a receipt photo to automatically extract dishes, GST, and service charges.
- **Real-Time Paid/Pending Toggle**: Confetti celebration animations and live collection trackers.

### 2. 🗺️ Interactive Trip Workspace (`/trips/[id]`)
- **Tab 1: Itinerary & Polls**:
  - Day-by-day vertical timeline with Transport, Stay, Food, and Adventure tags.
  - Attached expense badges (`₹4,000 • Paid by Aarav`) and Google Maps deep links.
  - Interactive Group Polls (e.g., *"Where should we have dinner tonight?"*) with live voting bars and dynamic voter avatars.
- **Tab 2: Bookings Vault**:
  - Centralized store for tickets, PNRs, and PDF vouchers (Zostel Manali, Zingbus Volvo AC Sleeper, Solang Paragliding passes).
  - One-click **"Split This Booking"** button that transfers vendor and amount directly into the UPI split tab.
- **Tab 3: Direct QR Split**:
  - Full vendor split console with live scannable QR cards and deep-link buttons.
- **Tab 4: Balances & Simplified Settle Up**:
  - Debt minimization matrix (*"Rohan pays Aarav ₹850"*).
  - One-tap peer-to-peer UPI payment modal with scannable QR and instant settlement toggle.

### 3. 📊 Main Dashboard (`/`)
- **Financial Summary**: High-contrast stat cards for *Total Trip Spend*, *You Owe*, and *You Are Owed*.
- **Quick Action Bar**: One-tap access to *Create Outing*, *Scan Merchant QR*, and *AI Bill Scanner*.
- **Outings Grid**: Visual budget progress bars (`₹24,500 / ₹40,000 used`) and member avatars.
- **Live Activity Stream**: Real-time log of poll votes, booking uploads, and payments.

---

## 🎨 Design System & Aesthetic
- **Theme**: Deep Slate `#0B1120` canvas with `#111827` cards, subtle `#1F2937` borders, and vibrant Emerald Green (`#10B981`) accent.
- **Typography**: Clean sans-serif with `tabular-nums` formatting (`.num-inr`) for Indian Rupee amounts (`₹`).
- **Responsive**: Native mobile fintech experience with bottom navigation & center "+ Split" FAB, and SaaS productivity dashboard on desktop.

---

## 🛠️ Tech Stack
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS
- **Icons**: `lucide-react`
- **QR Engine**: `qrcode.react` (SVG QR generation)
- **Delight & Micro-interactions**: `canvas-confetti`
- **Data Mock**: `src/data/mockData.ts` (pre-populated with realistic Indian trips: *Delhi to Manali*, *Goa Sun & Waves*, *Jaipur Weekend*)

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build for Production
```bash
npm run build
npm run start
```

---

## 📦 Pushing to GitHub

To push this repository to your GitHub account:

```bash
# 1. Create a new repository on GitHub named "TripSplit" (or makeatripplan)
# 2. Link your GitHub remote:
git remote add origin https://github.com/<your-username>/TripSplit.git

# 3. Rename branch to main if not already:
git branch -M main

# 4. Push all commits:
git push -u origin main
```
