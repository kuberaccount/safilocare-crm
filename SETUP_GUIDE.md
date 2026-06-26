# Safilocare CRM — Setup Guide
## How to go live at crm.safilocare.com (no coding needed)

---

## STEP 1: Set up Firebase (Google's database) — 10 min

1. Go to https://console.firebase.google.com
2. Click "Create a project" → name it "safilocare-crm" → Continue
3. Disable Google Analytics (not needed) → Create project
4. Click "Add app" (the </> web icon)
5. Name it "safilocare-crm" → Register app
6. You'll see a code block — COPY the firebaseConfig values
7. Open the file: `lib/firebase.js`
8. Replace each "REPLACE_WITH_YOUR_..." with your actual values

### Enable Google Login:
- In Firebase console → Authentication → Get started
- Sign-in method → Google → Enable → Save

### Enable the Database:
- Firebase console → Firestore Database → Create database
- Choose "Start in test mode" → Next → Select any location → Done

---

## STEP 2: Upload code to GitHub — 5 min

1. Go to https://github.com and create a free account
2. Click "New repository" → name it "safilocare-crm" → Create
3. Upload all the project files by dragging them into GitHub

---

## STEP 3: Deploy to Vercel (makes it live) — 5 min

1. Go to https://vercel.com → Sign up with Google
2. Click "New Project" → Import your GitHub repo
3. Leave all settings as-is → Click "Deploy"
4. Vercel gives you a URL like: safilocare-crm.vercel.app ✅

---

## STEP 4: Connect your domain crm.safilocare.com — 10 min

1. In Vercel → Your project → Settings → Domains
2. Add domain: `crm.safilocare.com`
3. Vercel shows you 2 values to copy (a CNAME record)
4. Go to where you bought safilocare.com (GoDaddy / Namecheap etc.)
5. Find "DNS Settings" → Add the CNAME record Vercel gave you
6. Wait 5–30 minutes → Done!

Your CRM is now live at crm.safilocare.com 🎉

---

## What each file does (for reference)

| File | Purpose |
|------|---------|
| `lib/firebase.js` | Connects to Google Firebase database |
| `pages/index.js` | Login page with Google sign-in |
| `pages/dashboard.js` | Main dashboard with stats |
| `pages/contacts.js` | Add & manage B2B contacts |
| `pages/pipeline.js` | Kanban board for deals |
| `pages/activities.js` | Log emails, calls, meetings |
| `pages/reports.js` | Charts and analytics |
| `components/Layout.js` | Sidebar navigation |
| `components/Modal.js` | Popup forms |

---

## Need help? Share any error messages and I'll fix them instantly.
