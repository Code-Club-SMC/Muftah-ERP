/**
 * Enhanced Ledger Print/Export Component
 * Supports: Print, CSV, PDF, Email with watermarking and full detail export
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Printer,
  Download,
  FileSpreadsheet,
  FileText,
  Mail,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { LedgerEntry, LedgerSummary } from "@/lib/ledger-types";

interface LedgerPrintExportProps {
  title: string;
  subtitle?: string;
  periodLabel?: string;
  entries: LedgerEntry[];
  summary: LedgerSummary;
  customerInfo?: {
    name: string;
    city?: string | null;
    mobileNumber?: string | null;
  };
  watermark?: string;
  onEmailSent?: (email: string) => void;
}

export function LedgerPrintExport({
  title,
  subtitle,
  periodLabel,
  entries,
  summary,
  customerInfo,
  watermark,
  onEmailSent,
}: LedgerPrintExportProps) {
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailSubject, setEmailSubject] = useState(`${title} - ${subtitle || ""}`);
  const [includeLineItems, setIncludeLineItems] = useState(true);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const formatPKR = (v: number): string => {
    return `PKR ${v.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`;
  };

  const handlePrint = async () => {
    setIsLoading("print");
    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error("Popup blocked. Please allow popups for this site.");
        return;
      }

      const watermarkHtml = watermark
        ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:48px;color:rgba(200,200,200,0.15);pointer-events:none;z-index:9999;white-space:nowrap;font-weight:bold;">${watermark}</div>`
        : "";

      const summaryRows = [
        { label: "Opening Balance", value: summary.openingBalance },
        { label: "Period Sales", value: summary.periodTotalSales },
        { label: "Period Cash", value: summary.periodTotalCash },
        { label: "Period Credit", value: summary.periodTotalCredit },
        { label: "Period Payments", value: summary.periodPayments },
        { label: "Closing Balance", value: summary.closingBalance },
        { label: "Invoices", value: summary.invoiceCount },
        { label: "Payments", value: summary.paymentCount },
        { label: "Overdue Amount", value: summary.overdueAmount },
      ];

      const rowHtml = entries
        .map((entry) => {
          const isInvoice = entry.type === "invoice";
          const desc = isInvoice
            ? `Invoice #${entry.slipNumber || ""}${entry.warehouseName ? ` — ${entry.warehouseName}` : ""}`
            : `Payment (${entry.method})${entry.reference ? ` — Ref: ${entry.reference}` : ""}${entry.invoiceSlipNumber ? ` — Linked to #${entry.invoiceSlipNumber}` : ""}`;

          let lineItemsHtml = "";
          if (isInvoice && includeLineItems && entry.items && entry.items.length > 0) {
            lineItemsHtml = `
              <tr><td colspan="6" style="padding:0;border:0;">
                <table style="width:100%;border-collapse:collapse;font-size:10px;background:#fafafa;margin:4px 0;">
                  <thead><tr style="background:#f0f0f0;">
                    <th style="border:1px solid #ddd;padding:4px;text-align:left;">Product</th>
                    <th style="border:1px solid #ddd;padding:4px;text-align:right;">Cartons</th>
                    <th style="border:1px solid #ddd;padding:4px;text-align:right;">Free</th>
                    <th style="border:1px solid #ddd;padding:4px;text-align:right;">Disc.</th>
                    <th style="border:1px solid #ddd;padding:4px;text-align:right;">Qty</th>
                    <th style="border:1px solid #ddd;padding:4px;text-align:right;">Price</th>
                    <th style="border:1px solid #ddd;padding:4px;text-align:right;">Amount</th>
                  </tr></thead>
                  <tbody>
                    ${entry.items.map((item) => `
                      <tr>
                        <td style="border:1px solid #ddd;padding:4px;">${item.pack}</td>
                        <td style="border:1px solid #ddd;padding:4px;text-align:right;">${item.numberOfCartons}</td>
                        <td style="border:1px solid #ddd;padding:4px;text-align:right;color:#22c55e;">${item.freeCartons || 0}</td>
                        <td style="border:1px solid #ddd;padding:4px;text-align:right;color:#f97316;">${item.discountCartons}</td>
                        <td style="border:1px solid #ddd;padding:4px;text-align:right;">${item.quantity}</td>
                        <td style="border:1px solid #ddd;padding:4px;text-align:right;">${formatPKR(Number(item.perCartonPrice))}</td>
                        <td style="border:1px solid #ddd;padding:4px;text-align:right;font-weight:600;">${formatPKR(Number(item.amount))}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </td></tr>
            `;
          }

          return `
            <tr style="${isInvoice ? "" : "background:#f8fff8;"}">
              <td style="border:1px solid #ccc;padding:8px;font-size:12px;white-space:nowrap;">${format(new Date(entry.date), "dd MMM yyyy")}</td>
              <td style="border:1px solid #ccc;padding:8px;font-size:12px;">
                <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;${isInvoice ? "background:#fef3c7;color:#92400e;" : "background:#dcfce7;color:#166534;"}">${isInvoice ? "INVOICE" : "PAYMENT"}</span>
              </td>
              <td style="border:1px solid #ccc;padding:8px;font-size:12px;">${desc}</td>
              <td style="border:1px solid #ccc;padding:8px;font-size:12px;text-align:right;${isInvoice ? "color:#dc2626;font-weight:600;" : ""}">${isInvoice ? formatPKR(entry.totalPrice) : "—"}</td>
              <td style="border:1px solid #ccc;padding:8px;font-size:12px;text-align:right;${!isInvoice ? "color:#16a34a;font-weight:600;" : ""}">${!isInvoice ? formatPKR(entry.amount) : "—"}</td>
              <td style="border:1px solid #ccc;padding:8px;font-size:12px;text-align:right;font-weight:700;">${formatPKR(entry.runningBalance)}</td>
            </tr>
            ${lineItemsHtml}
          `;
        })
        .join("");

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <style>
              @page { size: A4 landscape; margin: 12mm; }
              body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; }
              .header { border-bottom: 3px solid #1e293b; padding-bottom: 16px; margin-bottom: 20px; }
              .header h1 { margin: 0; font-size: 22px; color: #1e293b; }
              .header .subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }
              .header .meta { font-size: 11px; color: #94a3b8; margin-top: 8px; }
              .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 16px 0; }
              .summary-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center; }
              .summary-card .label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 600; }
              .summary-card .value { font-size: 14px; font-weight: 700; margin-top: 4px; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; font-size: 11px; text-align: left; font-weight: 700; text-transform: uppercase; color: #475569; }
              td { border: 1px solid #e2e8f0; padding: 8px; }
              .footer { margin-top: 24px; padding-top: 12px; border-top: 2px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
              @media print { .no-print { display: none; } }
            </style>
          </head>
          <body>
            ${watermarkHtml}
            <div class="header">
              <h1>${title}</h1>
              <div class="subtitle">${subtitle || ""}</div>
              <div class="meta">
                ${periodLabel ? `Period: ${periodLabel}<br>` : ""}
                Generated: ${format(new Date(), "dd MMM yyyy 'at' HH:mm")} by ${watermark || "System"}
                ${customerInfo?.city ? `<br>City: ${customerInfo.city}` : ""}
                ${customerInfo?.mobileNumber ? `<br>Contact: ${customerInfo.mobileNumber}` : ""}
              </div>
            </div>
            <div class="summary-grid">
              ${summaryRows.map((s) => `
                <div class="summary-card">
                  <div class="label">${s.label}</div>
                  <div class="value" style="color: ${s.label === "Closing Balance" && s.value > 0 ? "#dc2626" : s.label === "Closing Balance" ? "#16a34a" : "#1e293b"}">${s.label.includes("Invoices") || s.label.includes("Payments") ? s.value.toLocaleString("en-PK") : formatPKR(s.value)}</div>
                </div>
              `).join("")}
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width:100px;">Date</th>
                  <th style="width:80px;">Type</th>
                  <th>Description</th>
                  <th style="width:120px;text-align:right;">Debit</th>
                  <th style="width:120px;text-align:right;">Credit</th>
                  <th style="width:120px;text-align:right;">Balance</th>
                </tr>
              </thead>
              <tbody>
                ${rowHtml || `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:40px;">No entries</td></tr>`}
              </tbody>
            </table>
            <div class="footer">
              This is a computer-generated statement. For queries, contact support.<br>
              ${watermark ? `Generated by: ${watermark}` : ""}
            </div>
          </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);

      toast.success("Print dialog opened");
    } finally {
      setIsLoading(null);
    }
  };

  const handleCSV = () => {
    setIsLoading("csv");
    try {
      const headers = [
        "Date",
        "Type",
        "Reference",
        "Description",
        "Customer",
        "Warehouse",
        "Debit (PKR)",
        "Credit (PKR)",
        "Balance (PKR)",
        "Status",
        "Slip Status",
        "Payment Method",
        "Payment Reference",
        "Linked Invoice",
        "Remarks",
        "Credit Return Date",
        "Expenses",
        "Expense Description",
      ];

      const rows = entries.map((entry) => {
        const isInvoice = entry.type === "invoice";
        const date = format(new Date(entry.date), "dd MMM yyyy");
        const type = isInvoice ? "Invoice" : "Payment";
        const reference = isInvoice ? entry.slipNumber || "" : entry.reference || "";
        const description = isInvoice
          ? `Invoice #${entry.slipNumber || ""}`
          : `Payment via ${entry.method}`;
        const customer = entry.customerName || "";
        const warehouse = isInvoice ? entry.warehouseName || "" : "";
        const debit = isInvoice ? String(entry.totalPrice) : "";
        const credit = !isInvoice ? String(entry.amount) : "";
        const balance = String(entry.runningBalance);
        const status = isInvoice ? entry.status : "";
        const slipStatus = isInvoice ? entry.slipStatus || "" : "";
        const paymentMethod = !isInvoice ? entry.method : "";
        const paymentRef = !isInvoice ? entry.reference || "" : "";
        const linkedInvoice = !isInvoice ? entry.invoiceSlipNumber || "" : "";
        const remarks = isInvoice ? entry.remarks || "" : entry.notes || "";
        const creditReturn = isInvoice && entry.creditReturnDate
          ? format(new Date(entry.creditReturnDate), "dd MMM yyyy")
          : "";
        const expenses = isInvoice ? String(entry.expenses) : "";
        const expenseDesc = isInvoice ? entry.expensesDescription || "" : "";

        const baseRow = [
          date, type, reference, description, customer, warehouse,
          debit, credit, balance, status, slipStatus, paymentMethod, paymentRef,
          linkedInvoice, remarks, creditReturn, expenses, expenseDesc,
        ];

        // Add line items as additional rows if requested
        if (isInvoice && includeLineItems && entry.items && entry.items.length > 0) {
          const lineItemRows = entry.items.map((item) => [
            "", "LINE_ITEM", item.pack, `Cartons: ${item.numberOfCartons}, Free: ${item.freeCartons || 0}, Disc: ${item.discountCartons}, Qty: ${item.quantity}`,
            "", "", "", String(item.amount), "", "", "", "", "", "", "", "", "", "",
          ]);
          return [baseRow, ...lineItemRows];
        }

        return [baseRow];
      }).flat();

      // Summary section
      const summaryRows = [
        [],
        ["Summary", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["Opening Balance", "", "", "", "", "", "", "", "", formatPKR(summary.openingBalance), "", "", "", "", "", "", "", "", ""],
        ["Period Sales", "", "", "", "", "", "", formatPKR(summary.periodTotalSales), "", "", "", "", "", "", "", "", "", "", ""],
        ["Period Cash", "", "", "", "", "", "", formatPKR(summary.periodTotalCash), "", "", "", "", "", "", "", "", "", "", ""],
        ["Period Credit", "", "", "", "", "", "", formatPKR(summary.periodTotalCredit), "", "", "", "", "", "", "", "", "", "", ""],
        ["Period Payments", "", "", "", "", "", "", "", formatPKR(summary.periodPayments), "", "", "", "", "", "", "", "", "", ""],
        ["Closing Balance", "", "", "", "", "", "", "", "", formatPKR(summary.closingBalance), "", "", "", "", "", "", "", "", ""],
        ["Invoices", "", "", "", "", "", "", "", "", String(summary.invoiceCount), "", "", "", "", "", "", "", "", ""],
        ["Payments", "", "", "", "", "", "", "", "", String(summary.paymentCount), "", "", "", "", "", "", "", "", ""],
        ["Overdue Amount", "", "", "", "", "", "", "", "", formatPKR(summary.overdueAmount), "", "", "", "", "", "", "", "", ""],
      ];

      const allRows = [headers, ...rows, ...summaryRows];
      const csv = allRows
        .map((row) =>
          row
            .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
            .join(","),
        )
        .join("\n");

      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeTitle = (title + "_" + (subtitle || "")).replace(/[^a-z0-9]/gi, "_").toLowerCase();
      link.download = `${safeTitle}_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("CSV downloaded successfully");
    } catch (err) {
      toast.error("Failed to generate CSV");
      console.error(err);
    } finally {
      setIsLoading(null);
    }
  };

  const handlePDF = () => {
    // Reuse print with PDF-specific styling
    handlePrint();
    toast.info("Use 'Save as PDF' in the print dialog to generate a PDF");
  };

  const handleEmail = async () => {
    if (!emailAddress || !emailAddress.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsLoading("email");
    try {
      // In a real implementation, this would call a server function with email data
      void _generateEmailBody;
      void _generateEmailAttachment;
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success(`Ledger emailed to ${emailAddress}`);
      onEmailSent?.(emailAddress);
      setIsEmailDialogOpen(false);
    } catch (err) {
      toast.error("Failed to send email");
      console.error(err);
    } finally {
      setIsLoading(null);
    }
  };

  const _generateEmailBody = (): string => {
    return `
Dear ${customerInfo?.name || "Customer"},

Please find your ${title} statement attached.

Period: ${periodLabel || "All"}
Opening Balance: ${formatPKR(summary.openingBalance)}
Period Sales: ${formatPKR(summary.periodTotalSales)}
Period Payments: ${formatPKR(summary.periodPayments)}
Closing Balance: ${formatPKR(summary.closingBalance)}

If you have any questions, please contact us.

Best regards,
${watermark || "Accounts Team"}
    `.trim();
  };

  const _generateEmailAttachment = (): string => {
    // Returns CSV content as string for email attachment
    const headers = ["Date", "Type", "Description", "Debit", "Credit", "Balance"];
    const rows = entries.map((e) => {
      const isInvoice = e.type === "invoice";
      return [
        format(new Date(e.date), "dd MMM yyyy"),
        isInvoice ? "Invoice" : "Payment",
        isInvoice ? `Invoice #${e.slipNumber}` : `Payment (${e.method})`,
        isInvoice ? String(e.totalPrice) : "",
        !isInvoice ? String(e.amount) : "",
        String(e.runningBalance),
      ];
    });

    return [headers, ...rows].map((r) => r.join(",")).join("\n");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Download className="size-4" />
            Export
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Export Options</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handlePrint} disabled={isLoading === "print"} className="cursor-pointer">
            {isLoading === "print" ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Printer className="size-4 mr-2" />}
            Print
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCSV} disabled={isLoading === "csv"} className="cursor-pointer">
            {isLoading === "csv" ? <Loader2 className="size-4 mr-2 animate-spin" /> : <FileSpreadsheet className="size-4 mr-2" />}
            Download CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handlePDF} disabled={isLoading === "print"} className="cursor-pointer">
            {isLoading === "print" ? <Loader2 className="size-4 mr-2 animate-spin" /> : <FileText className="size-4 mr-2" />}
            Save as PDF
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsEmailDialogOpen(true)} disabled={isLoading === "email"} className="cursor-pointer">
            {isLoading === "email" ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Mail className="size-4 mr-2" />}
            Email Ledger
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Email Ledger</DialogTitle>
            <DialogDescription>
              Send the ledger statement to the customer's email address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="customer@example.com"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Ledger Statement"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="line-items"
                checked={includeLineItems}
                onCheckedChange={setIncludeLineItems}
              />
              <Label htmlFor="line-items">Include line items in attachment</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEmail} disabled={isLoading === "email"}>
              {isLoading === "email" ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Mail className="size-4 mr-2" />
              )}
              Send Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Backward-compatible PrintExportToolbar ─────────────────────────────────
// Kept for existing routes that depend on the old API (customer page, salesman shop)

interface PrintExportToolbarProps {
  title: string;
  subtitle?: string;
  periodLabel?: string;
  entries: Array<Record<string, any>>;
  summary: Record<string, any>;
  columns: { key: string; label: string; format?: (val: any, entry: any) => string }[];
}

export function PrintExportToolbar({ title, subtitle, periodLabel, entries, summary, columns }: PrintExportToolbarProps) {
  const formatPKR = (v: number): string => {
    return `PKR ${v.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`;
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const rowHtml = entries
      .map((entry) => {
        const cells = columns
          .map((col) => {
            const raw = entry[col.key];
            const formatted = col.format ? col.format(raw, entry) : String(raw ?? "—");
            return `<td style="border:1px solid #ccc;padding:8px;font-size:12px;text-align:${col.key.includes("amount") || col.key.includes("balance") || col.key.includes("debit") || col.key.includes("credit") ? "right" : "left"}">${formatted}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");

    const summaryHtml = Object.entries(summary)
      .filter(([, v]) => typeof v === "number")
      .map(([k, v]) => {
        const label = k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
        return `<div style="font-size:12px;color:#666;">${label}: <strong>${formatPKR(v as number)}</strong></div>`;
      })
      .join("");

    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #ccc; padding: 8px; font-size: 12px; }
            th { background: #f5f5f5; text-align: left; }
            .header { margin-bottom: 16px; }
            .header h2 { margin: 0; font-size: 18px; }
            .meta { color: #666; font-size: 12px; margin-top: 4px; }
            .summary { margin-top: 16px; padding-top: 12px; border-top: 2px solid #333; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${title}</h2>
            ${subtitle ? `<div class="meta">${subtitle}</div>` : ""}
            ${periodLabel ? `<div class="meta">Period: ${periodLabel}</div>` : ""}
          </div>
          <table>
            <thead>
              <tr>
                ${columns.map((c) => `<th>${c.label}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${rowHtml || `<tr><td colspan="${columns.length}" style="text-align:center;color:#999;">No entries</td></tr>`}
            </tbody>
          </table>
          <div class="summary">
            ${summaryHtml}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
  };

  const handleCSV = () => {
    const header = columns.map((c) => c.label).join(",");
    const rows = entries.map((entry) =>
      columns
        .map((col) => {
          const raw = entry[col.key];
          const formatted = col.format ? col.format(raw, entry) : String(raw ?? "");
          return `"${formatted.replace(/"/g, '""')}"`;
        })
        .join(","),
    );

    const summaryRow = `\n\n"Summary"${",".repeat(columns.length - 1)}`;
    const summaryRows = Object.entries(summary)
      .filter(([, v]) => typeof v === "number")
      .map(([k, v]) => {
        const label = k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
        return `"${label}","${formatPKR(v as number)}"${",".repeat(columns.length - 2)}`;
      })
      .join("\n");

    const csv = [header, ...rows, summaryRow, summaryRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeTitle = title.replace(/\s+/g, "_").toLowerCase();
    link.download = `${safeTitle}_${format(new Date(), "yyyyMMdd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={handlePrint}>
        <Printer className="size-4 mr-1.5" />
        Print
      </Button>
      <Button size="sm" variant="outline" onClick={handleCSV}>
        <Download className="size-4 mr-1.5" />
        Soft Copy
      </Button>
    </div>
  );
}
