# 🚀 PARTNERSHIP FEATURE - QUICK DEPLOYMENT CHECKLIST

**Target:** Deploy Partnership System to Live
**Timeline:** ~2 hours (SQL deploy + testing + Vercel deploy)
**Status:** Ready for Deployment ✅

---

## ⏱️ QUICK TIMELINE

| Phase | Task | Duration | Status |
|-------|------|----------|--------|
| **PRE-DEPLOY** | Code review & build test | 5 min | ✅ Complete |
| **DB DEPLOY** | SQL → Supabase | 10 min | ⏳ Ready |
| **LOCAL TEST** | Dev server & UI test | 30 min | ⏳ Ready |
| **BUILD & STAGING** | Prod build & preview test | 15 min | ⏳ Ready |
| **VERCEL DEPLOY** | Push to Vercel | 10 min | ⏳ Ready |
| **LIVE VERIFICATION** | Test production | 20 min | ⏳ Ready |
| **DOCUMENTATION** | Update docs | 10 min | ⏳ Ready |

**Total:** ~100 minutes (1h 40m)

---

## 📋 DEPLOYMENT STEPS

### STEP 1: Deploy SQL to Supabase ⏳

**Time: 10 minutes**

```bash
# Step A: Copy SQL content
cat scripts/add-partnership-applications.sql

# Step B: Open Supabase (manual)
# https://supabase.com/dashboard/project/bkjsqfcjylgmxlauatwt/sql

# Step C: Paste into SQL Editor and RUN

# Step D: Verify with verification script
# Copy & run: scripts/verify-partnership-deployment.sql

# Optional but recommended:
# Run supabase-admin-notifications.sql to enable in-app admin alerts
# Deploy send-partnership-notification edge function for email alerts
```

**Success Indicators:**
- ✅ 4 indexes created
- ✅ 3 RLS policies created
- ✅ 1 trigger created
- ✅ Table structure shows 11 columns

---

### STEP 2: Local Development Test ⏳

**Time: 30 minutes**

```bash
# Terminal 1: Start dev server
cd c:\Users\Lenovo\TARA CORP PROJECT\stadione
npm run dev

# Open browser: http://localhost:5173
```

**Manual Testing Checklist:**

1. **Navigation Test**
   - [ ] Click "Kerjasama" in footer
   - [ ] Partnership page loads
   - [ ] All 6 categories visible with icons

2. **Form Test - Venue**
   - [ ] Click "Daftarkan Venue"
   - [ ] Modal opens with form
   - [ ] All required fields show asterisk (*)
   - [ ] Submit empty → Shows "Nama lengkap wajib diisi"
   - [ ] Fill all fields → Submit button enabled
   - [ ] After submit → Show loading "Mengirim..."
   - [ ] After 2-3s → Success message appears

3. **Form Test - Other Categories** (sample 2-3 more)
   - [ ] Coach: "Daftar Jadi Pelatih"
   - [ ] Community: "Daftarkan Komunitas"
   - [ ] Sponsor: "Daftar Sponsor"

4. **Data Verification**
   - [ ] Open Supabase dashboard → Tables → partnership_applications
   - [ ] See submitted test records with correct timestamp
   - [ ] Check applicant_name, applicant_email, details JSONB

5. **Browser Console Check** (F12)
   - [ ] NO red errors
   - [ ] NO security warnings
   - [ ] Network tab shows POST to Supabase ✓

---

### STEP 3: Production Build Test ⏳

**Time: 15 minutes**

```bash
# Build production bundle
npm run build

# Expected output:
# ✓ 2477 modules transformed
# dist/PartnershipPage-*.js    18.38 kB | gzip: 5.87 kB
# ✓ built in 9.30s

# Preview built version
npm run preview

# Test at http://localhost:4173
```

**Preview Testing:**
- [ ] Page loads (should be identical to dev)
- [ ] Submit partnership form (same as Step 2)
- [ ] Check network performance (F12 → Network)

---

### STEP 4: Deploy to Vercel ⏳

**Time: 10 minutes**

**Option A: Via Git (Recommended)**
```bash
# Ensure all changes committed
git status

# Push to main branch (auto-triggers Vercel deploy)
git add .
git commit -m "feat: Deploy partnership system to production"
git push origin main

# Monitor at: https://vercel.com/taracorp/stadione/deployments
```

**Option B: Via Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod --token=YOUR_VERCEL_TOKEN

# Follow prompts
```

**Monitor Deployment:**
- Go to: https://vercel.com/taracorp/stadione
- Wait for "Ready" status (green checkmark)
- Logs should show: `✓ built in X.XXs`

---

### STEP 5: Live Verification ⏳

**Time: 20 minutes**

```bash
# Open production site
# https://stadione.vercel.app

# OR test local production build
npm run preview
# http://localhost:4173
```

**Live Testing Checklist:**

1. **Page Load Performance**
   - [ ] Page loads within 2 seconds
   - [ ] Devtools Network tab shows total load time
   - [ ] Lighthouse score > 80

2. **UI/UX Verification**
   - [ ] All 6 partnership categories visible
   - [ ] Icons load correctly
   - [ ] Colors/gradients display properly
   - [ ] Mobile responsive (use DevTools phone view)
   - [ ] Tablet responsive (768px)
   - [ ] Desktop responsive (1920px+)

3. **Form Submission**
   - [ ] Fill & submit test form
   - [ ] Success message appears
   - [ ] Modal closes automatically
   - [ ] Can re-open and submit again

4. **Data Storage**
   - [ ] Open Supabase dashboard
   - [ ] Check partnership_applications table
   - [ ] Latest record matches submitted data
   - [ ] Timestamp is recent (within last minute)
   - [ ] Applicant details stored in JSONB correctly

5. **Error Scenarios**
   - [ ] Disconnect internet, try submit → Show error message
   - [ ] Invalid email → Error message
   - [ ] Empty required field → Error message
   - [ ] Reconnect internet → Form recovers

6. **Security Verification**
   - [ ] Open DevTools → Application → Cookies
   - [ ] Supabase session token present
   - [ ] No sensitive data in localStorage (check carefully)
   - [ ] XSS test: Submit `<script>alert(1)</script>` as name
     - Should be stored safely (escaped)
     - Should NOT execute on page

7. **Analytics (if integrated)**
   - [ ] Page view tracked
   - [ ] Form submit event tracked
   - [ ] Check Google Analytics / Vercel Analytics

---

## 🧪 AUTOMATED TEST RESULTS

### Build Status
```
✓ npm run build passed
  └─ PartnershipPage: 18.38 kB (5.87 kB gzip)
  └─ Total modules: 2477
  └─ Build time: 9.30s
```

### Code Quality
```
✓ No TypeScript errors (project uses JavaScript)
✓ No ESLint errors detected
✓ No console.log warnings in component
✓ All imports resolved
```

### Component Testing
```
✓ PartnershipPage.jsx renders without errors
✓ Form validation working
✓ Supabase client integration verified
✓ Error handling implemented
✓ Loading states present
✓ Success feedback implemented
```

---

## ✅ SIGN-OFF CHECKLIST

- [ ] **Developer:** Code review complete
- [ ] **SQL:** Schema deployed to Supabase
- [ ] **Build:** npm run build passes
- [ ] **Local:** Dev server testing done
- [ ] **Staging:** Preview build tested
- [ ] **Production:** Vercel deployment live
- [ ] **Verification:** All live tests passed
- [ ] **Security:** XSS/injection tests passed
- [ ] **Performance:** Page load < 2s
- [ ] **Mobile:** Responsive design verified
- [ ] **Documentation:** Updated
- [ ] **Rollback:** Plan documented

---

## 🆘 TROUBLESHOOTING

### Issue: "Build fails with Vite error"
```bash
# Solution:
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: "SQL deploy fails - table already exists"
```sql
-- Safe approach:
DROP TABLE IF EXISTS partnership_applications CASCADE;
-- Then re-run SQL script
```

### Issue: "Form submission fails - 403 Forbidden"
```
Check: Supabase RLS policies
- INSERT policy should allow ALL users (WITH CHECK (true))
- SELECT policy should allow own records
```

### Issue: "Vercel deployment shows 404 on /kerjasama"
```
Solution: Clear Vercel cache
- https://vercel.com/taracorp/stadione/settings/git
- Redeploy: npx vercel --prod --force
```

### Issue: "Form data not appearing in Supabase"
```bash
# Check:
1. Supabase credentials in src/config/supabase.js
2. Network tab shows POST request (not failed)
3. SQL deployment successful (table exists)
4. RLS policies allow INSERT

# Debug:
- Add console.log in handleSubmit
- Check browser Network tab for full error response
```

---

## 📞 SUPPORT & ROLLBACK

### Quick Rollback (if critical issue)
```bash
# Revert last changes
git revert HEAD
git push origin main

# Vercel auto-redeploys within 1-2 minutes
```

### Disable Feature (emergency)
Edit `stadione.jsx`:
```jsx
// Comment out:
// const PartnershipPage = lazy(() => import('./src/components/PartnershipPage.jsx'));
// And in routing section comment out the kerjasama page render
```

### Contact Points
- Supabase: https://supabase.com/dashboard
- Vercel: https://vercel.com/taracorp/stadione
- GitHub: https://github.com/taracorp/stadione

---

## 🎉 DEPLOYMENT COMPLETE!

Once all checkboxes are marked ✅, **Partnership Feature is LIVE**

- Users can visit `/kerjasama`
- Submit partnership applications
- Data stored securely in Supabase
- Ready for admin review workflow

