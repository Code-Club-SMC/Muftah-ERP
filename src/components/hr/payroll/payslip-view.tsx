import { useState, useRef } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, Edit2 } from "lucide-react";
import { OverrideBradfordDialog } from "./override-bradford-dialog";

export type PayslipData = {
    id: string;
    employee: {
        employeeCode: string;
        firstName: string;
        lastName: string;
        cnic: string | null;
        designation: string;
        bankName: string | null;
        bankAccountNumber: string | null;
    };
    payroll: {
        month: string;
        startDate: string;
        endDate: string;
    };
    daysPresent: number | null;
    daysAbsent: number | null;
    daysLeave: number | null;
    totalOvertimeHours: string | null;
    nightShiftsCount: number | null;
    bradfordFactorScore: string | null;
    bradfordFactorOverride: string | null;
    bradfordFactorPeriod: string | null;
    /** Remaining vacation/leave days at year-end */
    vacationBalance?: number | null;
    basicSalary: string;
    allowanceBreakdown: Record<string, number> | null;
    overtimeAmount: string | null;
    nightShiftAllowanceAmount: string | null;
    incentiveAmount: string | null;
    commissionAmount: string | null;
    bonusAmount: string | null;
    absentDeduction: string | null;
    leaveDeduction: string | null;
    advanceDeduction: string | null;
    taxDeduction: string | null;
    otherDeduction: string | null;
    grossSalary: string;
    totalDeductions: string;
    netSalary: string;
    carriedForwardDeficit?: string | null;
    commissionBreakdown?: Array<{
      orderId: string;
      orderRef: string;
      orderDate: string;
      orderValue: number;
      rate: number;
      amount: number;
    }> | null;
    remarks: string | null;
    paymentSource?: string | null;
    createdAt: Date;
};

type PayslipViewProps = {
    payslip: PayslipData;
    showActions?: boolean;
};

// ── Labels matching official payslip exactly ────────────────────────────────
const allowanceLabels: Record<string, string> = {
    houseRent: "House Rent",
    utilities: "Utilities Allowance",
    bikeMaintenance: "Bike Maintenance",
    mobile: "Mobile Package",
    fuel: "Fuel Allowance",
    special: "Special Allowance",
    conveyance: "Conveyance Allowance",
    nightShift: "Night Shift Allowance",
    technical: "Technical Allowance",
};

function fmt(val: number): string {
    return val.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}

function toN(s: string | null | undefined): number {
    const n = parseFloat(s || "0");
    return isNaN(n) ? 0 : n;
}

// ── Border palette ───────────────────────────────────────────────────────────
const OUTER_BORDER = "1px solid #999";
const CELL_BORDER = "1px solid #bbb";
const ROW_BORDER = "1px solid #d8d8d8";
const BLUE_HDR = "#4472C4";
const LIGHT_BLUE = "#ADD8E6";

// ── Shared cell style builders ───────────────────────────────────────────────
const base: React.CSSProperties = {
    padding: "3px 8px",
    fontSize: 11,
    verticalAlign: "middle",
};

// Employee info section styles
const empVal: React.CSSProperties = { ...base, fontWeight: 700, borderBottom: CELL_BORDER, borderRight: CELL_BORDER };
const empLbl: React.CSSProperties = { ...base, fontWeight: 700, borderBottom: CELL_BORDER, borderRight: CELL_BORDER };
const empData: React.CSSProperties = { ...base, borderBottom: CELL_BORDER };

// Earnings header
const earnHdrBase: React.CSSProperties = {
    ...base,
    fontWeight: 700,
    background: LIGHT_BLUE,
    WebkitPrintColorAdjust: "exact",
    printColorAdjust: "exact" as never,
};

// Earnings row cells
const eCell: React.CSSProperties = { ...base, borderBottom: ROW_BORDER };
const eCellR: React.CSSProperties = { ...base, borderBottom: ROW_BORDER, borderRight: CELL_BORDER, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const dCell: React.CSSProperties = { ...base, borderBottom: ROW_BORDER };
const dCellR: React.CSSProperties = { ...base, borderBottom: ROW_BORDER, textAlign: "right", fontVariantNumeric: "tabular-nums" };

// Totals
const totLbl: React.CSSProperties = { ...base, fontWeight: 700, textAlign: "right", background: "#f0f0f0", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" as never };
const totNum: React.CSSProperties = { ...base, fontWeight: 700, textAlign: "right", background: "#f0f0f0", fontVariantNumeric: "tabular-nums", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" as never };
const totNumR: React.CSSProperties = { ...totNum, borderRight: CELL_BORDER };

// Net Pay
const netLbl: React.CSSProperties = { ...base, fontWeight: 800, fontSize: 13, background: LIGHT_BLUE, textAlign: "center", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" as never };
const netNum: React.CSSProperties = { ...base, fontWeight: 800, fontSize: 13, background: LIGHT_BLUE, textAlign: "right", fontVariantNumeric: "tabular-nums", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" as never };

export const PayslipView = ({
    payslip,
    showActions = true,
}: PayslipViewProps) => {
    const { employee, payroll } = payslip;
    const [overrideOpen, setOverrideOpen] = useState(false);
    const [commissionExpanded, setCommissionExpanded] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    // ── Bradford Factor ──────────────────────────────────────────────────────
    const effectiveBradford =
        payslip.bradfordFactorOverride != null
            ? toN(payslip.bradfordFactorOverride)
            : toN(payslip.bradfordFactorScore);

    const bradfordPeriod =
        payslip.bradfordFactorPeriod ||
        (payroll.startDate && payroll.endDate
            ? `${format(parseISO(payroll.startDate), "d MMM yyyy")} to ${format(parseISO(payroll.endDate), "d MMM yyyy")}`
            : "—");

    const bradfordColor =
        effectiveBradford === 0
            ? "#15803d"
            : effectiveBradford < 50
                ? "#a16207"
                : effectiveBradford < 250
                    ? "#c2410c"
                    : "#b91c1c";

    // ── Earnings ─────────────────────────────────────────────────────────────
    const dynamicAllowances = Object.entries(payslip.allowanceBreakdown || {})
        .filter(([key]) => key !== "basicSalary" && key !== "nightShift")
        .map(([key, val]) => ({
            label: allowanceLabels[key] || `${key} Allowance`,
            value: Number(val),
        }))
        .filter((e) => e.value > 0);

    const earnings: { label: string; value: number }[] = [
        { label: "Basic Salary", value: toN(payslip.basicSalary) },
        ...dynamicAllowances,
        ...(toN(payslip.overtimeAmount) > 0
            ? [{ label: "Overtime Amount", value: toN(payslip.overtimeAmount) }]
            : []),
        ...(toN(payslip.nightShiftAllowanceAmount) > 0
            ? [{ label: "Night Shift Allowance", value: toN(payslip.nightShiftAllowanceAmount) }]
            : []),
        ...(toN(payslip.incentiveAmount) > 0
            ? [{ label: "Incentive", value: toN(payslip.incentiveAmount) }]
            : []),
        ...(toN(payslip.commissionAmount) > 0
            ? [{ label: "Commission", value: toN(payslip.commissionAmount) }]
            : []),
        ...(toN(payslip.bonusAmount) > 0
            ? [{ label: "Eid Allowance", value: toN(payslip.bonusAmount) }]
            : []),
    ];

    // ── Deductions ───────────────────────────────────────────────────────────
    const deductions: { label: string; value: number }[] = [
        { label: "Income Tax", value: toN(payslip.taxDeduction) },
        { label: "Absent / Undertime", value: toN(payslip.absentDeduction) },
        { label: "Unapproved Leave", value: toN(payslip.leaveDeduction) },
        { label: "Loan Recovery", value: toN(payslip.advanceDeduction) },   // official label
        { label: "Other Deductions", value: toN(payslip.otherDeduction) },
        ...(toN(payslip.carriedForwardDeficit) > 0
            ? [{ label: "Carried Forward Deficit", value: toN(payslip.carriedForwardDeficit) }]
            : []),
    ].filter((d) => d.value > 0);

    const totalEarnings = earnings.reduce((s, e) => s + e.value, 0);
    const totalDedns = deductions.reduce((s, d) => s + d.value, 0);
    const netPay = totalEarnings - totalDedns; // Allow negative for deficit display

    const rowCount = Math.max(earnings.length, deductions.length, 7);
    const ep = [...earnings, ...Array(rowCount - earnings.length).fill(null)];
    const dp = [...deductions, ...Array(rowCount - deductions.length).fill(null)];

    // ── Formatted values ─────────────────────────────────────────────────────
    const payrollMonthFmt = format(parseISO(payroll.month), "MMM-yy");   // "Mar-26"
    const vacBalance = payslip.vacationBalance != null ? `${payslip.vacationBalance} Days` : "—";

    // ── Print: open a full new tab with self-contained HTML ──────────────────
    const handlePrint = () => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) { window.print(); return; }

        // Build combined rows
        const earningRows: string[] = [];
        const deductRows: string[] = [];
        const maxRows = Math.max(earnings.length, deductions.length, 7);

        for (let i = 0; i < maxRows; i++) {
            const e = earnings[i];
            const d = deductions[i];
            earningRows.push(
                e
                    ? `<td class="ecell">${e.label}</td><td class="ecell tc"></td><td class="ecell tr bdr">${fmt(e.value)}</td>`
                    : `<td class="ecell"></td><td class="ecell"></td><td class="ecell bdr"></td>`
            );
            deductRows.push(
                d
                    ? `<td class="ecell">${d.label}</td><td class="ecell tc"></td><td class="ecell tr">${fmt(d.value)}</td>`
                    : `<td class="ecell"></td><td class="ecell"></td><td class="ecell"></td>`
            );
        }

        const combinedRows = earningRows
            .map((er, i) => `<tr>${er}${deductRows[i]}</tr>`)
            .join("");

        printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Payslip – ${payrollMonthFmt} – ${employee.firstName} ${employee.lastName}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, sans-serif; font-size:11px; color:#111; background:#fff; }
@media print {
  body { padding:0; }
  .no-print { display:none !important; }
  @page { margin:12mm; size:A4; }
}
.payslip { max-width:760px; margin:0 auto; padding:28px 32px; }

/* ── Outer wrapper ── */
.main-box { border:${OUTER_BORDER}; }

/* ── Blue company header ── */
.co-hdr {
  background: ${BLUE_HDR};
  padding:10px 16px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
.co-hdr span { color:#fff; font-size:15px; font-weight:700; letter-spacing:.5px; }

/* ── STATEMENT OF EARNINGS ── */
.soe {
  text-align:center;
  font-weight:700;
  font-size:12px;
  padding:6px;
  border-bottom:${OUTER_BORDER};
}

/* ── Employee info table ── */
.emp-tbl { width:100%; border-collapse:collapse; }
.ev  { padding:3px 8px; font-size:11px; font-weight:700; border-bottom:${CELL_BORDER}; border-right:${CELL_BORDER}; vertical-align:middle; }
.el  { padding:3px 8px; font-size:11px; font-weight:700; border-bottom:${CELL_BORDER}; border-right:${CELL_BORDER}; vertical-align:middle; }
.ed  { padding:3px 8px; font-size:11px; border-bottom:${CELL_BORDER}; vertical-align:middle; }

/* ── Earnings / Deductions table ── */
.earn-tbl { width:100%; border-collapse:collapse; border-top:${OUTER_BORDER}; }
.ehdr     { padding:3px 8px; font-size:11px; font-weight:700; background:${LIGHT_BLUE}; -webkit-print-color-adjust:exact; print-color-adjust:exact; vertical-align:middle; }
.ehdr-c   { padding:3px 8px; font-size:11px; font-weight:700; background:${LIGHT_BLUE}; text-align:center; -webkit-print-color-adjust:exact; print-color-adjust:exact; vertical-align:middle; }
.ehdr-r   { padding:3px 8px; font-size:11px; font-weight:700; background:${LIGHT_BLUE}; text-align:right; border-right:${CELL_BORDER}; -webkit-print-color-adjust:exact; print-color-adjust:exact; vertical-align:middle; }
.ehdr-r2  { padding:3px 8px; font-size:11px; font-weight:700; background:${LIGHT_BLUE}; text-align:right; -webkit-print-color-adjust:exact; print-color-adjust:exact; vertical-align:middle; }

.ecell   { padding:3px 8px; font-size:11px; border-bottom:${ROW_BORDER}; vertical-align:middle; }
.bdr     { border-right:${CELL_BORDER}; }
.tc      { text-align:center; }
.tr      { text-align:right; font-variant-numeric:tabular-nums; }

.tot-l   { padding:3px 8px; font-size:11px; font-weight:700; text-align:right; background:#f0f0f0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.tot-n   { padding:3px 8px; font-size:11px; font-weight:700; text-align:right; background:#f0f0f0; font-variant-numeric:tabular-nums; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.tot-nr  { padding:3px 8px; font-size:11px; font-weight:700; text-align:right; background:#f0f0f0; font-variant-numeric:tabular-nums; border-right:${CELL_BORDER}; -webkit-print-color-adjust:exact; print-color-adjust:exact; }

.net-l   { padding:4px 8px; font-size:13px; font-weight:800; background:${LIGHT_BLUE}; text-align:center; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.net-n   { padding:4px 8px; font-size:13px; font-weight:800; background:${LIGHT_BLUE}; text-align:right; font-variant-numeric:tabular-nums; -webkit-print-color-adjust:exact; print-color-adjust:exact; }

/* ── Remarks box ── */
.remarks { border:${OUTER_BORDER}; border-top:none; padding:8px 10px; min-height:54px; font-size:11px; }

/* ── Footer ── */
.footer { margin-top:18px; border-top:1px solid #e5e7eb; padding-top:8px; text-align:center; font-size:9px; color:#9ca3af; text-transform:uppercase; letter-spacing:2px; }

.bradford { font-weight:700; color:${bradfordColor}; }
</style>
</head>
<body>
<div class="payslip">

  <div class="main-box">

    <!-- Blue company header -->
    <div class="co-hdr">
      <img src="/company-logo-transparent.png" alt="Muftah" style="width:36px;height:36px;object-fit:contain;" />
      <span>Muftah Chemical Pvt Ltd.</span>
    </div>

    <!-- STATEMENT OF EARNINGS -->
    <div class="soe">STATEMENT OF EARNINGS</div>

    <!-- Employee info table -->
    <table class="emp-tbl">
      <colgroup>
        <col style="width:33%" />
        <col style="width:40%" />
        <col style="width:27%" />
      </colgroup>
      <tbody>
        <tr>
          <td class="ev">${employee.employeeCode}</td>
          <td class="el">Payroll Month</td>
          <td class="ed">${payrollMonthFmt}</td>
        </tr>
        <tr>
          <td class="ev">${employee.firstName} ${employee.lastName}</td>
          <td class="el">CNIC</td>
          <td class="ed">${employee.cnic || "N/A"}</td>
        </tr>
        <tr>
          <td class="ev">${employee.designation}</td>
          <td class="el">Vacation Balance to Year End</td>
          <td class="ed">${vacBalance}</td>
        </tr>
        <tr>
          <td class="el">Bank Account Number</td>
          <td class="el">Bradford factor Period</td>
          <td class="ed">${bradfordPeriod}</td>
        </tr>
        <tr>
          <td class="el">Bank Name</td>
          <td class="el">Bradford factor</td>
          <td class="ed bradford">${effectiveBradford}${payslip.bradfordFactorOverride != null ? ' <span style="font-size:9px;color:#9ca3af;font-weight:400">(override)</span>' : ""}</td>
        </tr>
      </tbody>
    </table>

    <!-- Earnings / Deductions table -->
    <table class="earn-tbl">
      <colgroup>
        <col style="width:27%" />
        <col style="width:10%" />
        <col style="width:13%" />
        <col style="width:27%" />
        <col style="width:10%" />
        <col style="width:13%" />
      </colgroup>
      <tbody>
        <tr>
          <th class="ehdr">Earning</th>
          <th class="ehdr-c">Hrs/Days</th>
          <th class="ehdr-r">PKR</th>
          <th class="ehdr">Deduction</th>
          <th class="ehdr-c">Hrs/Days</th>
          <th class="ehdr-r2">PKR</th>
        </tr>
        ${combinedRows}
        <tr>
          <td class="tot-l" colspan="2">Total Earnings</td>
          <td class="tot-nr">${fmt(totalEarnings)}</td>
          <td class="tot-l" colspan="2">Total Deduction</td>
          <td class="tot-n">${fmt(totalDedns)}</td>
        </tr>
        <tr>
          <td class="net-l" colspan="4">Net Pay</td>
          <td class="net-n">${fmt(netPay)}</td>
          <td class="net-l">PKR</td>
        </tr>
      </tbody>
    </table>

  </div><!-- /main-box -->

  ${payslip.commissionBreakdown && payslip.commissionBreakdown.length > 0 ? `
  <!-- Commission Breakdown -->
  <div style="border:${OUTER_BORDER};border-top:none;font-size:11px;">
    <div style="padding:6px 10px;background:#f8f9fa;font-weight:600;">
      Commission Breakdown (${payslip.commissionBreakdown.length} orders)
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#e9ecef;">
          <th style="${base};text-align:left;font-weight:600;border-bottom:${CELL_BORDER}">Order Ref</th>
          <th style="${base};text-align:left;font-weight:600;border-bottom:${CELL_BORDER}">Date</th>
          <th style="${base};text-align:right;font-weight:600;border-bottom:${CELL_BORDER}">Order Value</th>
          <th style="${base};text-align:right;font-weight:600;border-bottom:${CELL_BORDER}">Rate %</th>
          <th style="${base};text-align:right;font-weight:600;border-bottom:${CELL_BORDER};border-right:${CELL_BORDER}">Commission</th>
        </tr>
      </thead>
      <tbody>
        ${payslip.commissionBreakdown.map((item) => `
        <tr>
          <td style="${base};border-bottom:${ROW_BORDER}">${item.orderRef}</td>
          <td style="${base};border-bottom:${ROW_BORDER}">${item.orderDate}</td>
          <td style="${base};text-align:right;border-bottom:${ROW_BORDER};font-variant-numeric:tabular-nums">${fmt(item.orderValue)}</td>
          <td style="${base};text-align:right;border-bottom:${ROW_BORDER};font-variant-numeric:tabular-nums">${item.rate.toFixed(2)}%</td>
          <td style="${base};text-align:right;border-bottom:${ROW_BORDER};border-right:${CELL_BORDER};font-variant-numeric:tabular-nums;font-weight:600">${fmt(item.amount)}</td>
        </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
  ` : ""}

  <!-- Remarks -->
  <div class="remarks">
    ${payslip.remarks || "Salaries are paid as per company policy."}
    ${payslip.paymentSource ? `<br/><br/><strong>Paid From:</strong> ${payslip.paymentSource}` : ""}
  </div>

  <!-- Footer -->
  <div class="footer">System Generated Slip &bull; Muftah Chemical PVT LTD</div>

</div><!-- /payslip -->
</body>
</html>
        `);

        printWindow.document.close();
        setTimeout(() => {
            try { printWindow.focus(); printWindow.print(); } catch (_) { /* user can Ctrl+P */ }
        }, 400);
    };

    // ── React render ────────────────────────────────────────────────────────
    return (
        <div style={{ maxWidth: 780, margin: "0 auto", background: "#fff", fontFamily: "Arial, sans-serif", color: "#111" }}>

            {/* ── Actions toolbar ── */}
            {showActions && (
                <div className="flex justify-end gap-3 print:hidden py-3 px-4 border-b border-gray-200 mb-4 bg-gray-50">
                    <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs font-semibold">
                        <Printer className="size-3.5 mr-2" /> Print / Save PDF
                    </Button>
                </div>
            )}

            <div ref={printRef} style={{ padding: "24px 28px" }}>

                {/* ── Main bordered wrapper ── */}
                <div style={{ border: OUTER_BORDER }}>

                    {/* Blue company header */}
                    <div style={{
                        background: BLUE_HDR,
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                    }}>
                        <img
                            src="/company-logo-transparent.png"
                            alt="Logo"
                            style={{ width: 36, height: 36, objectFit: "contain" }}
                        />
                        <span style={{ color: "#fff", fontSize: 15, fontWeight: 700, letterSpacing: 0.5 }}>
                            Muftah Chemical Pvt Ltd.
                        </span>
                    </div>

                    {/* STATEMENT OF EARNINGS */}
                    <div style={{
                        textAlign: "center",
                        fontWeight: 700,
                        fontSize: 12,
                        padding: "6px",
                        borderBottom: OUTER_BORDER,
                    }}>
                        STATEMENT OF EARNINGS
                    </div>

                    {/* Employee info table – 3 columns */}
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <colgroup>
                            <col style={{ width: "33%" }} />
                            <col style={{ width: "40%" }} />
                            <col style={{ width: "27%" }} />
                        </colgroup>
                        <tbody>
                            {/* Row 1: code | Payroll Month | value */}
                            <tr>
                                <td style={empVal}>{employee.employeeCode}</td>
                                <td style={empLbl}>Payroll Month</td>
                                <td style={empData}>{payrollMonthFmt}</td>
                            </tr>
                            {/* Row 2: name | CNIC | value */}
                            <tr>
                                <td style={empVal}>{employee.firstName} {employee.lastName}</td>
                                <td style={empLbl}>CNIC</td>
                                <td style={empData}>{employee.cnic || "N/A"}</td>
                            </tr>
                            {/* Row 3: designation | Vacation Balance | value */}
                            <tr>
                                <td style={empVal}>{employee.designation}</td>
                                <td style={empLbl}>Vacation Balance to Year End</td>
                                <td style={empData}>{vacBalance}</td>
                            </tr>
                            {/* Row 4: Bank Account Number | Bradford Period | value */}
                            <tr>
                                <td style={empLbl}>Bank Account Number</td>
                                <td style={empLbl}>Bradford factor Period</td>
                                <td style={empData}>{bradfordPeriod}</td>
                            </tr>
                            {/* Row 5: Bank Name | Bradford Factor | value */}
                            <tr>
                                <td style={empLbl}>Bank Name</td>
                                <td style={empLbl}>Bradford factor</td>
                                <td style={{
                                    ...empData,
                                    fontWeight: 700,
                                    color: bradfordColor,
                                }}>
                                    {effectiveBradford}
                                    {payslip.bradfordFactorOverride != null && (
                                        <span style={{ fontSize: 9, marginLeft: 4, color: "#9ca3af", fontWeight: 400 }}>
                                            (override)
                                        </span>
                                    )}
                                    {showActions && (
                                        <button
                                            type="button"
                                            onClick={() => setOverrideOpen(true)}
                                            title="Override Bradford Factor"
                                            data-no-print="true"
                                            style={{ marginLeft: 6, background: "none", border: "none", cursor: "pointer", padding: 0, verticalAlign: "middle" }}
                                        >
                                            <Edit2 style={{ width: 11, height: 11, color: "#9ca3af" }} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Earnings / Deductions table */}
                    <table style={{ width: "100%", borderCollapse: "collapse", borderTop: OUTER_BORDER }}>
                        <colgroup>
                            <col style={{ width: "27%" }} />
                            <col style={{ width: "10%" }} />
                            <col style={{ width: "13%" }} />
                            <col style={{ width: "27%" }} />
                            <col style={{ width: "10%" }} />
                            <col style={{ width: "13%" }} />
                        </colgroup>
                        <tbody>

                            {/* Column headers */}
                            <tr>
                                <th style={{ ...earnHdrBase, textAlign: "left" }}>Earning</th>
                                <th style={{ ...earnHdrBase, textAlign: "center" }}>Hrs/Days</th>
                                <th style={{ ...earnHdrBase, textAlign: "right", borderRight: CELL_BORDER }}>PKR</th>
                                <th style={{ ...earnHdrBase, textAlign: "left" }}>Deduction</th>
                                <th style={{ ...earnHdrBase, textAlign: "center" }}>Hrs/Days</th>
                                <th style={{ ...earnHdrBase, textAlign: "right" }}>PKR</th>
                            </tr>

                            {/* Line items */}
                            {ep.map((earning, i) => {
                                const ded = dp[i];
                                return (
                                    <tr key={i}>
                                        <td style={eCell}>{earning?.label ?? ""}</td>
                                        <td style={{ ...eCell, textAlign: "center" }}></td>
                                        <td style={eCellR}>{earning ? fmt(earning.value) : ""}</td>
                                        <td style={dCell}>{ded?.label ?? ""}</td>
                                        <td style={{ ...dCell, textAlign: "center" }}></td>
                                        <td style={dCellR}>{ded ? fmt(ded.value) : ""}</td>
                                    </tr>
                                );
                            })}

                            {/* Totals */}
                            <tr>
                                <td colSpan={2} style={totLbl}>Total Earnings</td>
                                <td style={totNumR}>{fmt(totalEarnings)}</td>
                                <td colSpan={2} style={totLbl}>Total Deduction</td>
                                <td style={totNum}>{fmt(totalDedns)}</td>
                            </tr>

                            {/* Net Pay */}
                            <tr>
                                <td colSpan={4} style={netLbl}>Net Pay</td>
                                <td style={netNum}>{fmt(netPay)}</td>
                                <td style={netLbl}>PKR</td>
                            </tr>

                        </tbody>
                    </table>

                </div>{/* /main-box */}

                {/* Commission Breakdown (Expandable) */}
                {payslip.commissionBreakdown && payslip.commissionBreakdown.length > 0 && (
                    <div style={{
                        border: OUTER_BORDER,
                        borderTop: "none",
                        fontSize: 11,
                    }}>
                        <div
                            style={{
                                padding: "6px 10px",
                                background: "#f8f9fa",
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                fontWeight: 600,
                            }}
                            onClick={() => setCommissionExpanded(!commissionExpanded)}
                        >
                            <span>Commission Breakdown ({payslip.commissionBreakdown.length} orders)</span>
                            <span style={{ fontSize: 9 }}>{commissionExpanded ? "▲ Collapse" : "▼ Expand"}</span>
                        </div>
                        {commissionExpanded && (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ background: "#e9ecef" }}>
                                        <th style={{ ...base, textAlign: "left", fontWeight: 600, borderBottom: CELL_BORDER }}>Order Ref</th>
                                        <th style={{ ...base, textAlign: "left", fontWeight: 600, borderBottom: CELL_BORDER }}>Date</th>
                                        <th style={{ ...base, textAlign: "right", fontWeight: 600, borderBottom: CELL_BORDER }}>Order Value</th>
                                        <th style={{ ...base, textAlign: "right", fontWeight: 600, borderBottom: CELL_BORDER }}>Rate %</th>
                                        <th style={{ ...base, textAlign: "right", fontWeight: 600, borderBottom: CELL_BORDER, borderRight: CELL_BORDER }}>Commission</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payslip.commissionBreakdown.map((item) => (
                                        <tr key={item.orderId}>
                                            <td style={{ ...base, borderBottom: ROW_BORDER }}>{item.orderRef}</td>
                                            <td style={{ ...base, borderBottom: ROW_BORDER }}>{item.orderDate}</td>
                                            <td style={{ ...base, textAlign: "right", borderBottom: ROW_BORDER, fontVariantNumeric: "tabular-nums" }}>{fmt(item.orderValue)}</td>
                                            <td style={{ ...base, textAlign: "right", borderBottom: ROW_BORDER, fontVariantNumeric: "tabular-nums" }}>{item.rate.toFixed(2)}%</td>
                                            <td style={{ ...base, textAlign: "right", borderBottom: ROW_BORDER, borderRight: CELL_BORDER, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmt(item.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* Remarks */}
                <div style={{
                    border: OUTER_BORDER,
                    borderTop: "none",
                    padding: "8px 10px",
                    minHeight: 54,
                    marginBottom: 32,
                    fontSize: 11,
                }}>
                    {payslip.remarks || "Salaries are paid as per company policy."}
                    {payslip.paymentSource && (
                        <div style={{ marginTop: 8 }}>
                            <strong>Paid From:</strong> {payslip.paymentSource}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    marginTop: 20,
                    borderTop: "1px solid #f3f4f6",
                    paddingTop: 10,
                    textAlign: "center",
                    fontSize: 9,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                }}>
                    System Generated Slip • Muftah Chemical PVT LTD
                </div>

            </div>{/* /printRef */}

            <OverrideBradfordDialog
                open={overrideOpen}
                onOpenChange={setOverrideOpen}
                payslipId={payslip.id}
                currentScore={payslip.bradfordFactorOverride || payslip.bradfordFactorScore}
            />
        </div>
    );
};