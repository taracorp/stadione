# 🎯 PARTNERSHIP DEPLOYMENT - COMMAND REFERENCE GUIDE

**Quick Reference for Live Deployment**

---

## ⚡ QUICK START (Copy & Paste Commands)

### Terminal 1: Stop any running processes
```bash
# Press Ctrl+C if dev server running
```

### Terminal 2: Run Automated Tests
```bash
cd "c:\Users\Lenovo\TARA CORP PROJECT\stadione"
bash scripts/test-partnership-deployment.sh
```

Expected output:
```
✓ ALL TESTS PASSED!
```

### Terminal 3: Start Dev Server
```bash
cd "c:\Users\Lenovo\TARA CORP PROJECT\stadione"
npm run dev
```

Expected output:
```
VITE v5.4.21  ready in 587 ms
➜  Local:   http://localhost:5173/
```

---

## 📋 MANUAL CHECKLIST (Follow Sequentially)

### Phase 1: SQL Deployment (5 minutes)
```
STEP 1: Open Supabase Dashboard
URL: https://supabase.com/dashboard/project/bkjsqfcjylgmxlauatwt

STEP 2: New SQL Query
Click: "SQL Editor" → "New Query"

STEP 3: Copy SQL Schema
File: scripts/add-partnership-applications.sql
Copy entire contents

STEP 4: Paste & Execute
Paste in SQL editor
Click: "Run"

STEP 5: Verify
Expected: "✓ Query executed successfully"
```

### Phase 2: Local Testing (10 minutes)
```
STEP 1: Open Browser
URL: http://localhost:5173

STEP 2: Navigate to Partnership
Click: "Kerjasama" button in footer

STEP 3: Test Form Submission
- Click: "Daftarkan Venue"
- Fill: All required fields
- Click: "Daftar"
- Wait: Loading state "Mengirim..."
- Expect: Success "✓ Pendaftaran diterima!"

STEP 4: Verify in Supabase
In Supabase SQL Editor, run:
SELECT * FROM partnership_applications ORDER BY created_at DESC LIMIT 1;

Expected: Your test data appears with status='pending'
```

### Phase 3: Production Build (2 minutes)
```bash
# Terminal command:
cd "c:\Users\Lenovo\TARA CORP PROJECT\stadione"
npm run build

# Expected output:
# ✓ 2477 modules transformed
# ✓ built in 9.30s
```

### Phase 4: Git Commit & Deploy (5 minutes)
```bash
cd "c:\Users\Lenovo\TARA CORP PROJECT\stadione"

# Stage changes
git add -A

# Commit
git commit -m "feat: Add partnership system - 6 categories, Supabase integration"

# Push (auto-deploys to Vercel)
git push origin main

# Monitor at: https://vercel.com/taracorp/stadione
```

### Phase 5: Live Verification (5 minutes)
```
STEP 1: Wait for Vercel Deploy
Check: https://vercel.com/taracorp/stadione
Wait for status: ✅ Ready (green)

STEP 2: Test Live Site
URL: https://stadione.vercel.app
Click: "Kerjasama"

STEP 3: Test Live Form
- Fill form
- Submit
- Check: Success message

STEP 4: Verify Live Data
In Supabase SQL:
SELECT applicant_name, type, created_at 
FROM partnership_applications 
ORDER BY created_at DESC LIMIT 1;

Should see: Your live submission
```

---

## 📁 KEY FILES & LOCATIONS

| File | Purpose | Location |
|------|---------|----------|
| **SQL Schema** | Database table & policies | `scripts/add-partnership-applications.sql` |
| **Component** | React UI form | `src/components/PartnershipPage.jsx` |
| **Main App** | Routing & integration | `stadione.jsx` (lines 73, 1828, 5325) |
| **Config** | Supabase client | `src/config/supabase.js` |
| **Deployment Guides** | Documentation | `PARTNERSHIP_*.md` (3 files) |
| **Verification Script** | SQL checks | `scripts/verify-partnership-deployment.sql` |
| **Test Script** | Auto tests | `scripts/test-partnership-deployment.sh` |

---

## 🔗 LIVE URLS

| Service | URL |
|---------|-----|
| **Live App** | https://stadione.vercel.app |
| **Partnership Page** | https://stadione.vercel.app/kerjasama |
| **Supabase Dashboard** | https://supabase.com/dashboard/project/bkjsqfcjylgmxlauatwt |
| **Vercel Deployments** | https://vercel.com/taracorp/stadione |
| **GitHub Repo** | https://github.com/taracorp/stadione |
| **Local Dev** | http://localhost:5173 |

---

## ✅ FINAL VERIFICATION

After deployment to live, verify these 6 points:

1. **Page Load**
   ```
   [ ] Visit https://stadione.vercel.app
   [ ] Footer visible with "Kerjasama" button
   ```

2. **Click Partnership**
   ```
   [ ] Click "Kerjasama" in footer
   [ ] Partnership page loads (6 categories)
   ```

3. **Submit Test Form**
   ```
   [ ] Click "Daftarkan Venue"
   [ ] Fill form with test data
   [ ] Click "Daftar"
   [ ] See success message
   ```

4. **Check Data Storage**
   ```
   [ ] Open Supabase SQL Editor
   [ ] Run: SELECT * FROM partnership_applications 
            ORDER BY created_at DESC LIMIT 1;
   [ ] Verify: Test data appears
   ```

5. **Check Browser Console**
   ```
   [ ] Press F12 (Developer Tools)
   [ ] Go to Console tab
   [ ] Verify: NO red errors
   ```

6. **Test Mobile**
   ```
   [ ] Press Ctrl+Shift+M (toggle phone view)
   [ ] Verify: Form still works on mobile
   ```

---

## 🆘 TROUBLESHOOTING QUICK FIXES

### Issue: "Build fails"
```bash
npm install
rm -rf node_modules
npm run build
```

### Issue: "SQL deploy fails - Syntax error"
```
Check: SQL Editor in Supabase
- Verify: All text copied correctly
- Verify: No extra spaces or special characters
- Try: Run each statement separately
```

### Issue: "Form won't submit"
```
1. Open DevTools (F12)
2. Go to Network tab
3. Try submitting form
4. Look for POST request to Supabase
5. Check response: Should be 200 or 201
```

### Issue: "Data not in Supabase"
```sql
-- Check if table exists:
SELECT * FROM information_schema.tables 
WHERE table_name = 'partnership_applications';

-- Check RLS policies:
SELECT * FROM pg_policies 
WHERE tablename = 'partnership_applications';

-- If missing: Re-run SQL schema
```

### Issue: "Vercel still deploying"
```
Monitor at: https://vercel.com/taracorp/stadione
Wait for: ✅ Ready (green checkmark)
If stuck > 5 min: Click "Redeploy"
```

---

## 📊 DEPLOYMENT SUMMARY

### What's Being Deployed
- ✅ 1 database table (partnership_applications)
- ✅ 1 React component (PartnershipPage.jsx)
- ✅ 6 partnership application categories
- ✅ Form validation & error handling
- ✅ Supabase integration & RLS security
- ✅ Vercel production deployment

### Expected Results
- ✅ Users can apply for partnership
- ✅ Data stored in Supabase
- ✅ Live at https://stadione.vercel.app/kerjasama
- ✅ Mobile responsive & accessible
- ✅ Admin can review applications later

### Support Contacts
- Supabase: https://supabase.com/support
- Vercel: https://vercel.com/support
- GitHub: https://github.com/taracorp/stadione/issues

---

## 📝 DEPLOYMENT SIGN-OFF

| Step | Status | Time |
|------|--------|------|
| 1. Tests passed | ✅ | 5 min |
| 2. SQL deployed | ⏳ | 5 min |
| 3. Local tested | ⏳ | 10 min |
| 4. Build created | ⏳ | 2 min |
| 5. Deployed to Vercel | ⏳ | 5 min |
| 6. Live verified | ⏳ | 5 min |
| **TOTAL** | **⏳** | **~32 min** |

---

**Ready to Deploy! Follow the phases above in order. 🚀**

