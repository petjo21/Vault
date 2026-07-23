# Memory Vault — Phase 1 (MVP)

A personal, private site for storing photos and videos with tags and a timeline view.

## What's included
- Login via email magic link (Supabase Auth — no passwords to manage)
- Upload photos/videos with caption, date, and tags
- Timeline homepage, grouped by date
- Tag-based filtering
- Each user only ever sees their own memories (enforced at the database level)

## Setup (about 15 minutes)

### 1. Create a Supabase project
Go to https://supabase.com → New project (free tier is fine).

### 2. Run the database schema
In your Supabase project: **SQL Editor → New query** → paste the contents of
`supabase/schema.sql` → Run.

### 3. Create the storage bucket
**Storage → New bucket** → name it exactly `memories` → set to **Private**.

Then add a storage policy so each user can only touch files inside their own
`user_id/` folder. Go to **Storage → memories → Policies → New policy** and
create policies (for `select`, `insert`, `update`, `delete`) using this
expression:
```
(storage.foldername(name))[1] = auth.uid()::text
```

### 4. Get your API keys
**Project Settings → API** → copy the `Project URL` and `anon public` key.

### 5. Configure the app
```bash
cp .env.local.example .env.local
# paste your Project URL and anon key into .env.local
npm install
npm run dev
```
Visit http://localhost:3000, log in with your email, and try uploading.

### 6. Deploy online
Push this folder to a GitHub repo, then go to https://vercel.com → New Project
→ import the repo. Add the same two environment variables
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in Vercel's
project settings. Deploy — you'll get a live URL you can open from any device.

## Roadmap
- **Phase 2:** better search (by caption + tag combined), favorites, album view
- **Phase 3:** face grouping — this needs a vision API (AWS Rekognition or
  Azure Face API are the common choices) plus a background job that scans
  new uploads and clusters faces. Not free, and best tackled once Phase 1–2
  are solid.

## Notes
- Free tiers: Supabase gives 1GB storage / 2GB bandwidth free, Vercel's
  free tier is generous for personal use. You'll likely want to upgrade
  Supabase storage once you have a lot of videos.
- This uses Next.js App Router + Supabase JS client directly (no extra
  auth library) to keep the codebase simple to read and extend.
