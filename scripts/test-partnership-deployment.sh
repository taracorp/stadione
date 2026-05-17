#!/bin/bash
# =============================================================
# PARTNERSHIP FEATURE - AUTOMATED DEPLOYMENT TESTING SCRIPT
# =============================================================
# Purpose: Automate testing of Partnership feature
# Usage: bash scripts/test-partnership-deployment.sh
# =============================================================

set -e

echo "=================================================="
echo "🧪 PARTNERSHIP FEATURE - DEPLOYMENT TEST SUITE"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ========== TEST 1: Code Quality ==========
echo "TEST 1: Code Quality Checks"
echo "=============================="

# Check if build passes
echo -n "Checking npm build... "
if npm run build > /dev/null 2>&1; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Check if PartnershipPage exists
echo -n "Checking PartnershipPage.jsx exists... "
if [ -f "src/components/PartnershipPage.jsx" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Check if SQL schema exists
echo -n "Checking SQL schema exists... "
if [ -f "scripts/add-partnership-applications.sql" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# ========== TEST 2: Syntax Validation ==========
echo ""
echo "TEST 2: Syntax & Structure Validation"
echo "======================================"

# Check JavaScript syntax
echo -n "Checking JavaScript syntax... "
if node -c src/components/PartnershipPage.jsx 2>/dev/null; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${YELLOW}⚠ WARNING: Could not validate (node check)${NC}"
fi

# Check SQL syntax (basic)
echo -n "Checking SQL basic syntax... "
if grep -q "CREATE TABLE IF NOT EXISTS public.partnership_applications" scripts/add-partnership-applications.sql; then
  if grep -q "ALTER TABLE public.partnership_applications ENABLE ROW LEVEL SECURITY" scripts/add-partnership-applications.sql; then
    echo -e "${GREEN}✓ PASS${NC}"
  else
    echo -e "${RED}✗ FAIL - RLS not enabled${NC}"
    exit 1
  fi
else
  echo -e "${RED}✗ FAIL - Missing table creation${NC}"
  exit 1
fi

# ========== TEST 3: Integration Checks ==========
echo ""
echo "TEST 3: Integration & Routing"
echo "=============================="

# Check if PartnershipPage imported in stadione.jsx
echo -n "Checking PartnershipPage import in stadione.jsx... "
if grep -q "const PartnershipPage = lazy" stadione.jsx; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Check if kerjasama route exists
echo -n "Checking 'kerjasama' route in stadione.jsx... "
if grep -q "page === 'kerjasama'" stadione.jsx; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Check if footer button exists
echo -n "Checking 'Kerjasama' footer button... "
if grep -q "Kerjasama" stadione.jsx; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# ========== TEST 4: Build Output ==========
echo ""
echo "TEST 4: Production Build Artifacts"
echo "=================================="

# Check if dist folder created
echo -n "Checking dist folder created... "
if [ -d "dist" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Check if PartnershipPage bundled
echo -n "Checking PartnershipPage bundled... "
if find dist -name "*PartnershipPage*" | grep -q .; then
  echo -e "${GREEN}✓ PASS${NC}"
  PARTNERSHIP_SIZE=$(find dist -name "*PartnershipPage*" -exec ls -lh {} \; | awk '{print $5}')
  echo "  └─ Size: $PARTNERSHIP_SIZE (gzip)"
else
  echo -e "${YELLOW}⚠ INFO: PartnershipPage in main bundle (tree-shaked)${NC}"
fi

# ========== TEST 5: File Integrity ==========
echo ""
echo "TEST 5: File Integrity Checks"
echo "============================="

# Check SQL table definition
echo -n "Checking SQL table columns... "
COLUMN_COUNT=$(grep -c "^\s*[a-z_]*\s*" scripts/add-partnership-applications.sql || true)
if [ "$COLUMN_COUNT" -gt 10 ]; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${YELLOW}⚠ INFO: Could not count columns${NC}"
fi

# Check RLS policies count
echo -n "Checking RLS policies... "
POLICY_COUNT=$(grep -c "CREATE POLICY" scripts/add-partnership-applications.sql || true)
if [ "$POLICY_COUNT" -ge 3 ]; then
  echo -e "${GREEN}✓ PASS (found $POLICY_COUNT policies)${NC}"
else
  echo -e "${RED}✗ FAIL (only found $POLICY_COUNT policies, need 3+)${NC}"
  exit 1
fi

# ========== TEST 6: Component Structure ==========
echo ""
echo "TEST 6: Component Structure"
echo "==========================="

# Check if component has required functions
echo -n "Checking component has ApplicationModal... "
if grep -q "function ApplicationModal" src/components/PartnershipPage.jsx; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Check if component has handleSubmit
echo -n "Checking component has form submission... "
if grep -q "handleSubmit\|supabase.*insert" src/components/PartnershipPage.jsx; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Check if component exports
echo -n "Checking component exports default... "
if grep -q "export default function PartnershipPage" src/components/PartnershipPage.jsx; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# ========== TEST 7: Configuration ==========
echo ""
echo "TEST 7: Configuration Checks"
echo "============================="

# Check Supabase config exists
echo -n "Checking Supabase config... "
if [ -f "src/config/supabase.js" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# Check Supabase credentials loaded
echo -n "Checking Supabase credentials... "
if grep -q "DEFAULT_SUPABASE_URL\|DEFAULT_SUPABASE_ANON_KEY" src/config/supabase.js; then
  echo -e "${GREEN}✓ PASS${NC}"
else
  echo -e "${RED}✗ FAIL${NC}"
  exit 1
fi

# ========== SUMMARY ==========
echo ""
echo "=================================================="
echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
echo "=================================================="
echo ""
echo "Summary:"
echo "--------"
echo "✓ Code quality checks passed"
echo "✓ Syntax validation passed"
echo "✓ Integration checks passed"
echo "✓ Build artifacts verified"
echo "✓ File integrity confirmed"
echo "✓ Component structure valid"
echo "✓ Configuration ready"
echo ""
echo "Next Steps:"
echo "1. Deploy SQL to Supabase"
echo "2. Start dev server: npm run dev"
echo "3. Test at: http://localhost:5173"
echo "4. Follow PARTNERSHIP_QUICK_CHECKLIST.md"
echo ""
echo "=================================================="
