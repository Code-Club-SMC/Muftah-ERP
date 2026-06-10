import { ResponsiveSheet } from "@/components/custom/responsive-sheet";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useGetInvoiceDetail, useDeleteInvoice } from "@/hooks/sales/use-invoices";
import { invoicesKeys } from "@/hooks/sales/use-invoices";
import {
  FileText,
  Calendar,
  MapPin,
  User,
  Package,
  DollarSign,
  Trash2,
  AlertCircle,
  Loader2,
  Edit,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreateInvoiceForm } from "./create-invoice-form";
import { InvoiceTypeBadge } from "./invoice-type-badge";
import { useState } from "react";

const PKR = (v: number) =>
  `PKR ${v.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
  onPrint: () => void;
}

export const InvoiceDetailSheet = ({ open, onOpenChange, invoiceId, onPrint }: Props) => {
  return (
    <ResponsiveSheet
      title="Invoice Detail"
      description="Full invoice information and line items"
      open={open}
      onOpenChange={onOpenChange}
      className="lg:min-w-[70vw]"
      icon={FileText}
    >
      {invoiceId ? (
        <InvoiceDetailContent
          invoiceId={invoiceId}
          onPrint={onPrint}
          onOpenChange={onOpenChange}
        />
      ) : (
        <div className="space-y-4 py-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}
    </ResponsiveSheet>
  );
};

const InvoiceDetailContent = ({
  invoiceId,
  onPrint,
  onOpenChange,
}: {
  invoiceId: string;
  onPrint: () => void;
  onOpenChange: (open: boolean) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const { data: invoice, isLoading, isError, error } = useGetInvoiceDetail(invoiceId);

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <AlertCircle className="size-12 text-destructive" />
        <p className="text-sm font-medium text-destructive">
          {error?.message || "Failed to load invoice details"}
        </p>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </div>
    );
  }

  if (!invoice) return null;

  if (isEditing) {
    return (
      <div className="py-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold">Edit Invoice</h1>
            <p className="text-xs text-muted-foreground">Modify items, prices, or payment details</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} className="gap-1" aria-label="Cancel editing invoice">
            <X className="size-3.5" aria-hidden="true" />
            Cancel Edit
          </Button>
        </div>
        <CreateInvoiceForm
          initialData={invoice}
          onSuccess={() => {
            setIsEditing(false);
            // onSuccess handled by hook invalidation
          }}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  const cash = Number(invoice.cash);
  const credit = Number(invoice.credit);
  const total = Number(invoice.totalPrice);

  const statusLabel = credit === 0 ? "Paid" : cash === 0 ? "Credit" : "Partial";
  const statusVariant = credit === 0 ? "default" : cash === 0 ? "destructive" : "outline";

  return (
    <div className="space-y-5 py-4">
      {/* Header info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Date</p>
            <p className="text-sm font-medium">{format(new Date(invoice.date), "dd MMM yyyy")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <User className="size-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Customer</p>
            <p className="text-sm font-medium">{invoice.customer?.name || "N/A"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Warehouse</p>
            <p className="text-sm font-medium">{invoice.warehouse?.name || "N/A"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="size-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Total</p>
            <p className="text-sm font-bold">{PKR(total)}</p>
          </div>
        </div>
      </div>

      {/* Invoice Type */}
      <div className="flex items-center gap-2">
        <InvoiceTypeBadge customerType={invoice.customer?.customerType || "retailer"} />
        <Badge variant={statusVariant as any} className="capitalize text-xs">
          {statusLabel}
        </Badge>
      </div>

      {/* Payment breakdown */}
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Cash</p>
          <p className={cn("text-lg font-bold", cash > 0 ? "text-green-600" : "text-muted-foreground")}>
            {PKR(cash)}
          </p>
        </div>
        <Separator orientation="vertical" className="h-10" />
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Credit</p>
          <p className={cn("text-lg font-bold", credit > 0 ? "text-red-600" : "text-green-600")}>
            {PKR(credit)}
          </p>
        </div>
        <Separator orientation="vertical" className="h-10" />
      </div>

      {invoice.remarks && (
        <div className="p-3 bg-muted/20 rounded-lg">
          <p className="text-[10px] text-muted-foreground uppercase mb-1">Remarks</p>
          <p className="text-sm">{invoice.remarks}</p>
        </div>
      )}

      {/* Line items table */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Package className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Line Items ({invoice.items?.length || 0})</h2>
        </div>
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px]">#</TableHead>
                <TableHead className="text-[11px]">Product</TableHead>
                <TableHead className="text-[11px] text-right">Cartons</TableHead>
                <TableHead className="text-[11px] text-right">Disc. Ctns</TableHead>
                <TableHead className="text-[11px] text-right">Units</TableHead>
                <TableHead className="text-[11px] text-right">Packs/Ctn</TableHead>
                <TableHead className="text-[11px] text-right">Total Packs</TableHead>
                <TableHead className="text-[11px] text-right">Price/Ctn</TableHead>
                <TableHead className="text-[11px] text-right">Amount</TableHead>
                <TableHead className="text-[11px] text-right">Weight (kg)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items?.map((item, i) => {
                const ppc = Number(item.packsPerCarton) || 0;
                const billedCtns = Number(item.numberOfCartons) || 0;
                const discCtns = Number(item.discountCartons) || 0;
                const looseUnits = Number(item.quantity) || 0;
                const totalPacks = ppc > 0
                  ? (billedCtns + discCtns) * ppc
                  : billedCtns > 0 ? billedCtns + discCtns : looseUnits;
                return (
                <TableRow key={item.id || i}>
                  <TableCell className="text-sm tabular-nums">{i + 1}</TableCell>
                  <TableCell className="text-sm font-medium">{item.pack}</TableCell>
                  <TableCell className="text-sm tabular-nums text-right">{billedCtns || "—"}</TableCell>
                  <TableCell className="text-sm tabular-nums text-right">
                    {discCtns > 0 ? (
                      <span className="text-amber-600 font-semibold">+{discCtns}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-right">{looseUnits || "—"}</TableCell>
                  <TableCell className="text-sm tabular-nums text-right">
                    {ppc > 0 ? ppc : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-right font-semibold">
                    {totalPacks}
                    {ppc > 0 && discCtns > 0 && (
                      <span className="text-[10px] text-amber-600 ml-1">
                        ({billedCtns * ppc}+{discCtns * ppc})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-right">{PKR(Number(item.perCartonPrice))}</TableCell>
                  <TableCell className="text-sm tabular-nums text-right font-semibold">{PKR(Number(item.amount))}</TableCell>
                  <TableCell className="text-sm tabular-nums text-right">{Number(item.totalWeight).toFixed(2)}</TableCell>
                </TableRow>
                );
              })}
              <TableRow className="bg-muted/30 font-semibold">
                <TableCell colSpan={7} className="text-right text-sm">Totals</TableCell>
                <TableCell className="text-sm text-right">—</TableCell>
                <TableCell className="text-sm text-right font-bold">{PKR(total)}</TableCell>
                <TableCell className="text-sm text-right">
                  {invoice.items?.reduce((acc, item) => acc + Number(item.totalWeight), 0).toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <DeleteInvoiceButton
          invoiceId={invoiceId}
          onSuccess={() => onOpenChange(false)}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditing(true)}
          className="gap-1"
        >
          <Edit className="size-3.5" />
          Edit
        </Button>
        <Button size="sm" onClick={onPrint} className="gap-1">
          <FileText className="size-3.5" />
          Print
        </Button>
      </div>
    </div>
  );
};

// ── Isolated delete button with its own mutation state ──
const DeleteInvoiceButton = ({ invoiceId, onSuccess }: { invoiceId: string; onSuccess: () => void }) => {
  const queryClient = useQueryClient();
  const { mutate, isPending } = useDeleteInvoice();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        mutate(invoiceId, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: invoicesKeys.list({}) });
            queryClient.invalidateQueries({ queryKey: invoicesKeys.stats() });
            onSuccess();
          },
          onError: (err: any) => {
            toast.error(err.message || "Failed to delete invoice");
          },
        });
      }}
      disabled={isPending}
      className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
      {isPending ? "Deleting..." : "Delete"}
    </Button>
  );
};
