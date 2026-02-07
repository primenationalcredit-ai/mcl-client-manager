# MCL Client Manager — Setup Guide

## Architecture
```
GitHub Repo → Netlify (hosts app + email function)
                ↓
            Supabase (database)
                ↓
    Google Sheet (CSV sync every 2 min)
    SendGrid (emails via Netlify function)
    Zapier → RingCentral (texts via webhook)
```

---

## Step 1: Supabase (Database) — 5 min

1. Go to [supabase.com](https://supabase.com) → your project (or create one)
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy-paste the ENTIRE contents of `supabase-schema.sql` → click **Run**
5. Then create another new query, paste `supabase-seed.sql` → click **Run**
   - This loads your 358 clients
6. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public key** (starts with `eyJ...`)

✅ Database is ready with all clients + templates

---

## Step 2: GitHub Repo — 2 min

1. Go to [github.com/new](https://github.com/new) → create repo `mcl-client-manager` (private)
2. On your computer, open terminal:
```bash
cd mcl-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mcl-client-manager.git
git push -u origin main
```

---

## Step 3: Netlify Deploy — 3 min

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **Add new site → Import an existing project → GitHub**
3. Select your `mcl-client-manager` repo
4. Build settings should auto-detect:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Click **Show advanced → New variable** and add these env vars:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SENDGRID_API_KEY` | Your SendGrid API key (SG.xxx) |
| `SENDGRID_FROM_EMAIL` | Your verified sender email |

6. Click **Deploy site**
7. Wait ~60 seconds, your app is live!

---

## Step 4: SendGrid (Emails) — 5 min

If you don't have SendGrid yet:
1. Go to [sendgrid.com](https://sendgrid.com) → sign up (free tier = 100 emails/day)
2. **Settings → Sender Authentication** → verify your sender email
3. **Settings → API Keys** → Create API Key → Full Access → copy it
4. Add to Netlify env vars (Step 3 above)

Already done! The Netlify function handles sending.

---

## Step 5: Zapier → RingCentral (Texts) — 5 min

1. Go to [zapier.com](https://zapier.com)
2. Create a new Zap:
   - **Trigger:** Webhooks by Zapier → Catch Hook
   - **Action:** RingCentral → Send SMS
3. In the RingCentral action, map:
   - **To Number:** `{{phone}}`
   - **Message:** `{{message}}`
4. Turn on the Zap
5. Copy the webhook URL (looks like `https://hooks.zapier.com/hooks/catch/xxxxx/yyyyy/`)
6. In your app → **Settings** → paste the Zapier webhook URL → Save

---

## Step 6: Local Development (optional)

```bash
cd mcl-app
cp .env.example .env
# Fill in your Supabase URL and key in .env
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## How It Works

| Feature | How |
|---------|-----|
| **New leads** | CSV sync reads Google Sheet every 2 min, adds clients with no email/phone |
| **Send email** | Click send → Netlify function → SendGrid API → client inbox |
| **Send text** | Click send → Zapier webhook → RingCentral → client phone |
| **MCL import** | Paste PDF text → parser matches names → updates stages → queues actions |
| **31-day follow-up** | Clients in "1st Dispute" auto-appear in Action Queue on day 31 |
| **In-service dates** | Set a date, client parks in "In Service", auto-moves when date arrives |
| **Action Queue** | All pending items in one place — nothing sends until you approve |

---

## Env Vars Summary

### Netlify Site Settings (all 4 required):
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=joe@asapcreditrepairusa.com
```

### In-App Settings:
- Agent name → Settings tab
- Zapier webhook URL → Settings tab
- CSV sync URL → Sync tab (pre-configured)
