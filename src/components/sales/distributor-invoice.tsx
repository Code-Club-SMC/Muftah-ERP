import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

export type DistributorInvoiceItem = {
    serialNo: number;
    itemCode: string;
    itemDescription: string;
    /** e.g. "48-0"  (cartons-loose) */
    cartonQty: string;
    /** e.g. "4-0" */
    schemeCarton: string;
    cartonRate: number;
    grossAmount: number;
    discount: number;
    netAmount: number;
};

export type DistributorInvoiceData = {
    companyName: string;
    docType: string;
    party: {
        name: string;
        address: string;
        city: string;
        tel: string;
        mob: string;
    };
    date: string;
    estNo: string | number;
    docNo: string | number;
    pvNo: string | number;
    mBillNo: string | number;
    transporter: string;
    biltyNo: string | number;
    items: DistributorInvoiceItem[];
    dispDate: string;
    freight: number;
    previousBalance: number;
    invoiceAmount?: number;
    totalProfit?: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtN(val: number): string {
    return val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtD(val: number): string {
    return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sumQtyPart(items: DistributorInvoiceItem[], field: "cartonQty" | "schemeCarton"): string {
    const totalCartons = items.reduce((acc, it) => {
        const parts = it[field].split("-");
        return acc + (parseInt(parts[0], 10) || 0);
    }, 0);
    const totalLoose = items.reduce((acc, it) => {
        const parts = it[field].split("-");
        return acc + (parseInt(parts[1], 10) || 0);
    }, 0);
    return `${fmtN(totalCartons)} - ${totalLoose}`;
}

// ── Border palette ────────────────────────────────────────────────────────────
const OUTER = "1px solid #999";
const INNER = "1px solid #ccc";
const CELL_PAD = "3px 6px";
const FONT_SZ = 11;

const th: React.CSSProperties = {
    padding: CELL_PAD,
    fontSize: FONT_SZ,
    fontWeight: 700,
    border: INNER,
    textAlign: "center",
    verticalAlign: "middle",
    background: "#fff",
};

const td: React.CSSProperties = {
    padding: CELL_PAD,
    fontSize: FONT_SZ,
    border: INNER,
    verticalAlign: "middle",
};

const tdR: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const tdC: React.CSSProperties = { ...td, textAlign: "center" };

const totTd: React.CSSProperties = {
    padding: CELL_PAD,
    fontSize: FONT_SZ,
    fontWeight: 700,
    border: INNER,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    background: "#f5f5f5",
};

// ── Component ─────────────────────────────────────────────────────────────────

type DistributorInvoiceViewProps = {
    invoice: DistributorInvoiceData;
    showActions?: boolean;
};

export const DistributorInvoiceView = ({
    invoice,
    showActions = true,
}: DistributorInvoiceViewProps) => {
    const printRef = useRef<HTMLDivElement>(null);

    // Derived totals
    const totalGross = invoice.items.reduce((s, it) => s + it.grossAmount, 0);
    const totalDisc = invoice.items.reduce((s, it) => s + it.discount, 0);
    const totalNet = invoice.items.reduce((s, it) => s + it.netAmount, 0);
    const schemeTotals = sumQtyPart(invoice.items, "schemeCarton");

    // Extract carton count from labels like "20 Cartons (480 Packs)" or legacy "20 - 0"
    const parseCartonCount = (label: string): number => {
        // New format: "N Cartons (...)"
        const newFmt = label.match(/^(\d+)\s+Cartons/);
        if (newFmt) return parseInt(newFmt[1], 10) || 0;
        // Legacy format: "N - M"
        return parseInt(label.split("-")[0], 10) || 0;
    };

    const orderCartons = invoice.items.reduce((a, it) => a + parseCartonCount(it.cartonQty), 0);
    const schemeCartons = invoice.items.reduce((a, it) => a + parseCartonCount(it.schemeCarton), 0);
    const netCartons = orderCartons + schemeCartons;
    const invoiceAmt = invoice.invoiceAmount ?? totalNet;
    const grandTotal = invoiceAmt + invoice.previousBalance;

    // ── Print ────────────────────────────────────────────────────────────────
    const handlePrint = () => {
        const pw = window.open("", "_blank");
        if (!pw) { window.print(); return; }

        const rows = invoice.items.map((it) => `
            <tr>
                <td class="tc">${it.serialNo}</td>
                <td>${it.itemDescription}</td>
                <td class="tc">${it.cartonQty}</td>
                <td class="tc">${it.schemeCarton}</td>
                <td class="tr">${fmtN(it.cartonRate)}</td>
                <td class="tr">${fmtN(it.grossAmount)}</td>
                <td class="tr">${fmtN(it.discount)}</td>
                <td class="tr">${fmtD(it.netAmount)}</td>
            </tr>`
        ).join("");

        pw.document.write(`
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${invoice.companyName} – ${invoice.docType}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#fff;}
@media print{@page{margin:10mm;size:A4 landscape;}}
.wrap{max-width:1000px;margin:0 auto;padding:20px 24px;}
.top-hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;}
.co-name{font-size:14px;font-weight:800;}
.doc-type{font-size:13px;font-weight:700;text-align:right;}
.info-row{display:flex;gap:12px;margin-bottom:10px;}
.party-box,.doc-box{border:1px solid #999;padding:7px 10px;font-size:11px;line-height:1.7;}
.party-box{flex:1.2;}
.doc-box{flex:1;}
.lbl{font-weight:700;}
table{width:100%;border-collapse:collapse;}
th{padding:3px 6px;font-size:11px;font-weight:700;border:1px solid #ccc;text-align:center;background:#f5f5f5;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
td{padding:3px 6px;font-size:11px;border:1px solid #ccc;vertical-align:middle;}
.tc{text-align:center;}
.tr{text-align:right;font-variant-numeric:tabular-nums;}
.tot-td{padding:3px 6px;font-size:11px;font-weight:700;border:1px solid #ccc;text-align:right;background:#f0f0f0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.summary-grid{display:flex;gap:0;margin-top:8px;}
.sum-left{flex:1.5;font-size:11px;line-height:1.9;padding-right:12px;}
.sum-right{font-size:11px;line-height:1.9;text-align:right;white-space:nowrap;}
.sum-right .row{display:flex;justify-content:space-between;gap:40px;}
.grand{font-weight:800;font-size:12px;border-top:1px solid #999;padding-top:2px;margin-top:2px;}
</style>
</head>
<body>
<div class="wrap">

  <div class="top-hdr">
    <div class="co-name">${invoice.companyName}</div>
    <div class="doc-type">${invoice.docType}</div>
  </div>

  <div class="info-row">
    <div class="party-box">
      <div><span class="lbl">Party Name</span> : ${invoice.party.name}</div>
      <div>&nbsp;</div>
      <div><span class="lbl">Address</span> : ${invoice.party.address}</div>
      <div>&nbsp;</div>
      <div><span class="lbl">City</span> : ${invoice.party.city}</div>
      <div><span class="lbl">Tel</span> : ${invoice.party.tel} &nbsp;&nbsp; <span class="lbl">Mob</span> : ${invoice.party.mob}</div>
    </div>
    <div class="doc-box">
      <div><span class="lbl">Date</span> : ${invoice.date}</div>
      <div><span class="lbl">Est. #</span> : ${invoice.estNo} &nbsp;&nbsp; <span class="lbl">Doc No</span> : ${invoice.docNo}</div>
      <div><span class="lbl">P.V No</span> : ${invoice.pvNo} &nbsp;&nbsp; <span class="lbl">M.Bill No</span> : ${invoice.mBillNo}</div>
      <div><span class="lbl">Transporter</span> : ${invoice.transporter || "0"}</div>
      <div><span class="lbl">Bilty No</span> : ${invoice.biltyNo || "0"}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:4%">Serial No.</th>
        <th style="width:36%">Item Description</th>
        <th style="width:10%">Carton Qty</th>
        <th style="width:8%">Scheme Carton</th>
        <th style="width:8%">Carton Rate</th>
        <th style="width:12%">Gross Amount</th>
        <th style="width:8%">Disc.</th>
        <th style="width:12%">Net Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr>
        <td class="tot-td" colspan="3"></td>
        <td class="tot-td">${schemeTotals}</td>
        <td class="tot-td"></td>
        <td class="tot-td">${fmtN(totalGross)}</td>
        <td class="tot-td">${fmtN(totalDisc)}</td>
        <td class="tot-td">${fmtD(totalNet)}</td>
      </tr>
    </tbody>
  </table>

  <div class="summary-grid">
    <div class="sum-left">
      <div><strong>No. of Lines</strong> ${invoice.items.length}</div>
      <div><strong>Comments</strong> :</div>
      <div>${invoice.dispDate}</div>
    </div>
    <div style="flex:1;font-size:11px;line-height:2;">
      <div><strong>Total Order Cartons</strong> :&nbsp; ${fmtN(orderCartons)} - 0</div>
      <div><strong>Total Scheme Cartons</strong> :&nbsp; ${fmtN(schemeCartons)} - 0</div>
      <div><strong>Net Cartons</strong> :&nbsp; ${fmtN(netCartons)} - 0</div>
    </div>
      <div style="font-size:11px;line-height:2;text-align:right;white-space:nowrap;padding-left:24px;">
        <div><strong>Freight</strong> :&nbsp; ${fmtD(invoice.freight)}</div>
        <div><strong>Invoice Amount</strong> :&nbsp; ${fmtD(invoiceAmt)}</div>
        ${invoice.totalProfit !== undefined ? `<div><strong style="color:${invoice.totalProfit >= 0 ? '#059669' : '#dc2626'}">Total Profit</strong> :&nbsp; <span style="color:${invoice.totalProfit >= 0 ? '#059669' : '#dc2626'}">${fmtD(invoice.totalProfit)}</span></div>` : ''}
        <div><strong>Previous Balance</strong> :&nbsp; ${fmtD(invoice.previousBalance)}</div>
        <div style="font-weight:800;font-size:12px;border-top:1px solid #999;padding-top:2px;margin-top:2px;"><strong>Grand Total</strong> :&nbsp; ${fmtD(grandTotal)}</div>
      </div>
  </div>

</div>
</body>
</html>`);
        pw.document.close();
        setTimeout(() => { try { pw.focus(); pw.print(); } catch (_) { } }, 400);
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div style={{ maxWidth: 1020, margin: "0 auto", background: "#fff", fontFamily: "Arial, sans-serif", color: "#111" }}>

            {showActions && (
                <div className="flex justify-end gap-3 print:hidden py-3 px-4 border-b border-gray-200 mb-4 bg-gray-50">
                    <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs font-semibold">
                        <Printer className="size-3.5 mr-2" /> Print / Save PDF
                    </Button>
                </div>
            )}

            <div ref={printRef} style={{ padding: "20px 24px" }}>

                {/* ── Top header: company name + doc type ── */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{invoice.companyName}</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{invoice.docType}</div>
                </div>

                {/* ── Party info + Doc info side by side ── */}
                <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>

                    {/* Party box */}
                    <div style={{ flex: 1.2, border: OUTER, padding: "7px 10px", fontSize: FONT_SZ, lineHeight: 1.7 }}>
                        <div><strong>Party Name</strong> : {invoice.party.name}</div>
                        <div>&nbsp;</div>
                        <div><strong>Address</strong> : {invoice.party.address}</div>
                        <div>&nbsp;</div>
                        <div><strong>City</strong> : {invoice.party.city}</div>
                        <div>
                            <strong>Tel</strong> : {invoice.party.tel}
                            &nbsp;&nbsp;
                            <strong>Mob</strong> : {invoice.party.mob}
                        </div>
                    </div>

                    {/* Doc info box */}
                    <div style={{ flex: 1, border: OUTER, padding: "7px 10px", fontSize: FONT_SZ, lineHeight: 1.7 }}>
                        <div><strong>Date</strong> : {invoice.date}</div>
                        <div>
                            <strong>Est. #</strong> : {invoice.estNo}
                            &nbsp;&nbsp;
                            <strong>Doc No</strong> : {invoice.docNo}
                        </div>
                        <div>
                            <strong>P.V No</strong> : {invoice.pvNo}
                            &nbsp;&nbsp;
                            <strong>M.Bill No</strong> : {invoice.mBillNo}
                        </div>
                        <div><strong>Transporter</strong> : {invoice.transporter || "0"}</div>
                        <div><strong>Bilty No</strong> : {invoice.biltyNo || "0"}</div>
                    </div>
                </div>

                {/* ── Items table ── */}
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <colgroup>
                        <col style={{ width: "4%" }} />
                        <col style={{ width: "36%" }} />
                        <col style={{ width: "10%" }} />
                        <col style={{ width: "8%" }} />
                        <col style={{ width: "8%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "8%" }} />
                        <col style={{ width: "12%" }} />
                    </colgroup>
                    <thead>
                        <tr style={{ background: "#f5f5f5" }}>
                            <th style={th}>Serial<br />No.</th>
                            <th style={th}>Item<br />Description</th>
                            <th style={th}>Carton<br />Qty</th>
                            <th style={th}>Scheme<br />Carton</th>
                            <th style={th}>Carton<br />Rate</th>
                            <th style={th}>Gross<br />Amount</th>
                            <th style={th}>Disc.</th>
                            <th style={th}>Net<br />Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.items.map((it) => (
                            <tr key={it.serialNo}>
                                <td style={tdC}>{it.serialNo}</td>
                                <td style={td}>{it.itemDescription}</td>
                                <td style={tdC}>{it.cartonQty}</td>
                                <td style={tdC}>{it.schemeCarton}</td>
                                <td style={tdR}>{fmtN(it.cartonRate)}</td>
                                <td style={tdR}>{fmtN(it.grossAmount)}</td>
                                <td style={tdR}>{fmtN(it.discount)}</td>
                                <td style={tdR}>{fmtD(it.netAmount)}</td>
                            </tr>
                        ))}

                        {/* Totals row */}
                        <tr>
                            <td style={totTd} colSpan={2}></td>
                            <td style={totTd}>{fmtN(orderCartons)}</td>
                            <td style={totTd}>{schemeTotals}</td>
                            <td style={totTd}></td>
                            <td style={totTd}>{fmtN(totalGross)}</td>
                            <td style={totTd}>{fmtN(totalDisc)}</td>
                            <td style={totTd}>{fmtD(totalNet)}</td>
                        </tr>
                    </tbody>
                </table>

                {/* ── Bottom summary ── */}
                <div style={{ display: "flex", gap: 0, marginTop: 8, alignItems: "flex-start" }}>

                    {/* Left: no. of lines / comments */}
                    <div style={{ flex: 1.5, fontSize: FONT_SZ, lineHeight: 1.9 }}>
                        <div><strong>No. of Lines</strong> {invoice.items.length}</div>
                        <div><strong>Comments</strong> :</div>
                        <div>{invoice.dispDate}</div>
                    </div>

                    {/* Middle: carton totals */}
                    <div style={{ flex: 1, fontSize: FONT_SZ, lineHeight: 2 }}>
                        <div><strong>Total Order Cartons</strong> : &nbsp;{fmtN(orderCartons)} - 0</div>
                        <div><strong>Total Scheme Cartons</strong> : &nbsp;{fmtN(schemeCartons)} - 0</div>
                        <div><strong>Net Cartons</strong> : &nbsp;{fmtN(netCartons)} - 0</div>
                    </div>

                    {/* Right: financial summary */}
                    <div style={{ fontSize: FONT_SZ, lineHeight: 2, textAlign: "right", whiteSpace: "nowrap", paddingLeft: 24 }}>
                        <div><strong>Freight</strong> : &nbsp;{fmtD(invoice.freight)}</div>
                        <div><strong>Invoice Amount</strong> : &nbsp;{fmtD(invoiceAmt)}</div>
                        {invoice.totalProfit !== undefined && (
                            <div><strong style={{ color: invoice.totalProfit >= 0 ? "#059669" : "#dc2626" }}>Total Profit</strong> : &nbsp;<span style={{ color: invoice.totalProfit >= 0 ? "#059669" : "#dc2626" }}>{fmtD(invoice.totalProfit)}</span></div>
                        )}
                        <div><strong>Previous Balance</strong> : &nbsp;{fmtD(invoice.previousBalance)}</div>
                        <div style={{
                            fontWeight: 800,
                            fontSize: 12,
                            borderTop: "1px solid #999",
                            paddingTop: 2,
                            marginTop: 2,
                        }}>
                            <strong>Grand Total</strong> : &nbsp;{fmtD(grandTotal)}
                        </div>
                    </div>

                </div>
            </div>{/* /printRef */}
        </div>
    );
};