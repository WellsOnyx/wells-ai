# Wells HR - Notion Database Setup

## Overview
Wells HR enables flexible employment arrangements for independent professionals working with Wells Onyx. This system supports 5 different employment models from W2 with benefits to Corp-to-Corp arrangements.

---

## Required Database: HR Employees

### Properties

| Property Name | Type | Configuration | Description |
|--------------|------|---------------|-------------|
| **Name** | Title | - | Employee/contractor full legal name |
| **Email** | Email | - | Primary contact email |
| **Employment Model** | Select | W2 with Benefits, W2 Contractor, 1099 Contractor, Corp-to-Corp, EOR | Type of employment arrangement |
| **Legal Structure** | Select | W2, 1099, C2C, EOR | Legal classification |
| **Status** | Select | 📝 Pending Signature, ✅ Active, ⏸️ Paused, ❌ Terminated | Current employment status |
| **Address** | Text | - | Full mailing address |
| **City** | Text | - | City |
| **State** | Select | All 50 states + DC | State of residence/work |
| **ZIP** | Text | - | ZIP code |
| **SSN (Last 4)** | Text | - | Last 4 digits only (for verification) |
| **Entity Name** | Text | - | For C2C: LLC/Corp name |
| **EIN** | Text | - | For C2C: Business EIN |
| **Platform Fee** | Text | - | Fee structure (e.g., "5% of gross") |
| **Payroll Fee** | Text | - | Monthly payroll processing fee |
| **Benefits Included** | Checkbox | - | Whether employee gets benefits |
| **Unemployment Eligible** | Checkbox | - | Whether eligible for unemployment |
| **Tax Withholding** | Select | Employer Withholds, Contractor Responsible, EOR Handles | Who handles tax withholding |
| **Start Date** | Date | - | Employment start date |
| **End Date** | Date | - | If terminated, end date |
| **YTD Gross Pay** | Number | Currency | Year-to-date gross compensation |
| **YTD Taxes Withheld** | Number | Currency | YTD tax withholding (W2 only) |
| **YTD Net Pay** | Number | Currency | YTD net paid to worker |
| **Contract Signed** | Checkbox | - | Whether employment agreement signed |
| **DocuSign Envelope ID** | Text | - | DocuSign envelope ID |
| **I-9 Verified** | Checkbox | - | I-9 completed (W2 only) |
| **W-4 on File** | Checkbox | - | W-4 on file (W2 only) |
| **W-9 on File** | Checkbox | - | W-9 on file (1099/C2C only) |
| **Insurance Certificate** | Files | - | For C2C: GL and E&O insurance |
| **Notes** | Text | - | Internal notes |
| **Created** | Created Time | - | Record creation timestamp |
| **Last Updated** | Last Edited Time | - | Last modification timestamp |

### Views to Create

1. **Active Employees**
   - Filter: Status = ✅ Active
   - Sort: Name (A-Z)
   - Group by: Employment Model

2. **Pending Onboarding**
   - Filter: Status = 📝 Pending Signature
   - Sort: Created (Newest first)

3. **W2 Employees**
   - Filter: Legal Structure = W2
   - Sort: Name (A-Z)

4. **1099 Contractors**
   - Filter: Legal Structure = 1099
   - Sort: YTD Gross Pay (High to Low)

5. **C2C Contracts**
   - Filter: Legal Structure = C2C
   - Sort: Start Date (Newest first)

6. **Terminated**
   - Filter: Status = ❌ Terminated
   - Sort: End Date (Newest first)

7. **Missing Documents**
   - Filter: Contract Signed = Unchecked OR I-9 Verified = Unchecked (for W2) OR W-9 on File = Unchecked (for 1099)
   - Sort: Status, Name

---

## Formulas to Add

### YTD Platform Fees (Calculate Wells AI revenue from this worker)
```
if(prop("Employment Model") == "W2 with Benefits", prop("YTD Gross Pay") * 0.05, if(prop("Employment Model") == "W2 Contractor", prop("YTD Gross Pay") * 0.05, if(prop("Employment Model") == "1099 Contractor", prop("YTD Gross Pay") * 0.033, if(prop("Employment Model") == "Corp-to-Corp", prop("YTD Gross Pay") * 0.033, if(prop("Employment Model") == "EOR", prop("YTD Gross Pay") * 0.033, 0)))))
```

### Compliance Status
```
if(and(prop("Contract Signed"), if(prop("Legal Structure") == "W2", and(prop("I-9 Verified"), prop("W-4 on File")), if(prop("Legal Structure") == "1099", prop("W-9 on File"), if(prop("Legal Structure") == "C2C", and(prop("W-9 on File"), prop("Insurance Certificate")), true)))), "✅ Compliant", "⚠️ Missing Docs")
```

---

## Environment Variables (Vercel)

Add these to your Vercel project:

```bash
NOTION_HR_EMPLOYEES_DB=<your-database-id>
```

To get database ID:
1. Open database in Notion
2. Copy URL: `https://notion.so/workspace/DATABASE_ID?v=...`
3. Extract the 32-character ID (no hyphens)

---

## Integration with DocuSign (Future)

Once DocuSign is integrated, the system will:

1. Auto-generate employment agreements based on selected model
2. Send via DocuSign for e-signature
3. Store envelope ID in Notion
4. Update "Contract Signed" when completed
5. Attach final PDF to record

**DocuSign Templates Needed:**
- W2 with Benefits Agreement
- W2 Contractor Agreement (with unemployment waiver)
- 1099 Independent Contractor Agreement
- Corp-to-Corp Master Services Agreement
- EOR Pass-Through Agreement

---

## Integration with Payroll (Future)

### For W2 Employees (Gusto/Rippling)

When Status = ✅ Active:
1. Sync to payroll system
2. Set up recurring payroll schedule
3. Configure tax withholding (from W-4)
4. Set up benefits (if applicable)
5. Sync gross pay back to Notion monthly

### For 1099/C2C (Bill.com or similar)

When invoice received:
1. Create bill in Bill.com
2. Route for approval
3. Pay via ACH
4. Update YTD Gross Pay in Notion
5. Generate 1099-NEC at year-end

---

## Compliance Automation

### Quarterly Tax Reminders (1099/C2C)
- Week before quarter end: Email reminder to pay estimated taxes
- Include calculator link and IRS payment portal

### Annual Forms (All)
- W2 for W2 employees (by Jan 31)
- 1099-NEC for 1099/C2C (by Jan 31)
- Auto-generate from YTD data in Notion

### State-Specific Alerts
- If State = CA, NY, NJ, MA, IL: Flag unemployment waiver as unenforceable
- Recommend EOR or true IC classification for high-risk states

---

## Cost Calculator (for Wells Onyx)

### W2 with Benefits
- Base salary: $100,000
- Employer taxes (7.65%): $7,650
- Benefits ($600/mo): $7,200
- Workers comp (1-3%): $2,000
- Unemployment insurance (varies): $1,000
- **Total cost: ~$117,850 (18% overhead)**

### W2 Contractor (No Benefits)
- Base salary: $100,000
- Employer taxes (7.65%): $7,650
- Workers comp: $2,000
- Unemployment insurance: $1,000
- **Total cost: ~$110,650 (11% overhead)**

### 1099 Contractor
- Contract value: $100,000
- Platform fee (3.3%): $3,300
- **Total cost: $103,300 (3.3% overhead)**

### Corp-to-Corp
- Contract value: $100,000
- Platform fee (3.3%): $3,300
- **Total cost: $103,300 (3.3% overhead)**

### EOR
- Base salary: $100,000
- EOR fee ($599/mo): $7,188
- Benefits ($400/mo avg): $4,800
- Platform fee (3.3%): $3,300
- **Total cost: ~$115,288 (15% overhead)**

---

## Risk Management

### Misclassification Risk (IC vs Employee)

**IRS 20-Factor Test** (auto-check in Notion):
- Instructions: Does company control how work is done? (Employee)
- Training: Does company provide training? (Employee)
- Integration: Is work integral to business? (Employee)
- Services: Must be rendered personally? (Employee)
- Hiring assistants: Can contractor hire others? (IC)
- Continuing relationship: Ongoing work? (Employee risk)
- Set hours: Company dictates schedule? (Employee)
- Full-time required: Must work full-time? (Employee)
- Location: Work at company location? (Employee)
- Order of work: Company controls sequence? (Employee)
- Reports: Must submit regular reports? (Employee risk)
- Payment: By hour/week/month? (Employee) or by job? (IC)
- Expenses: Company reimburses? (Employee)
- Tools: Company provides? (Employee)
- Investment: Does worker invest in facilities? (IC)
- Profit/loss: Can worker make profit or loss? (IC)
- Multiple clients: Works for several? (IC)
- Services to public: Offers services to general public? (IC)
- Discharge: Can be fired like employee? (Employee)
- Termination: Right to quit without liability? (Employee)

**Recommendation by Score:**
- 0-5 factors pointing to Employee: Safe for IC
- 6-10 factors: Borderline (use C2C or EOR)
- 11+ factors: Must be W2 employee

### State Risk Matrix

| State | Unemployment Waiver | IC Presumption | Recommended Model |
|-------|-------------------|---------------|-------------------|
| CA | ❌ Not enforceable | Employee (ABC test) | EOR or true IC |
| NY | ❌ Not enforceable | Employee bias | EOR or true IC |
| TX | ✅ Enforceable | Neutral | W2 contractor ok |
| FL | ✅ Enforceable | Neutral | W2 contractor ok |

---

## Sample Onboarding Flow

1. **Professional applies** via Wells AI
2. **System recommends model** based on:
   - Work type (full-time vs project)
   - Location (state compliance)
   - Benefits needs
   - Company overhead tolerance
3. **Professional chooses model**
4. **System collects info** (SSN or EIN, address, etc.)
5. **DocuSign sent** (auto-generated agreement)
6. **Professional signs**
7. **Notion updated** → Status = ✅ Active
8. **Payroll integration** triggered (if W2)
9. **Professional can start work**

**Timeline: 1-3 days** (vs weeks with traditional HR)

---

## Next Steps

1. Create Notion database with schema above
2. Add database ID to Vercel environment variables
3. Test onboarding flow at `/hr/onboard`
4. Set up DocuSign templates
5. Integrate payroll system (Gusto for W2, Bill.com for 1099/C2C)
6. Create compliance automation (quarterly reminders, year-end forms)

---

**Wells HR Status:** Backend built, Notion schema ready, UI complete

**Next Build:** DocuSign integration + Payroll sync

**Goal:** Make it so easy that an 80-year-old can hire someone in 10 minutes

---

*Last Updated: October 29, 2025*
