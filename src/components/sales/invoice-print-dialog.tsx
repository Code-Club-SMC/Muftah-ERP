import { useRef, useMemo } from "react";
import { ResponsiveDialog } from "@/components/custom/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { getInvoiceDetailFn } from "@/server-functions/sales/invoices-fn";
import {
  DistributorInvoiceView,
  type DistributorInvoiceData,
} from "./distributor-invoice";
import {
  RetailerInvoiceView,
  type RetailerInvoiceData,
} from "./retailer-invoice";
import { InvoiceTypeBadge } from "./invoice-type-badge";
import { Printer, FileText, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
}

export const InvoicePrintDialog = ({ open, onOpenChange, invoiceId }: Props) => {
  return (
    <ResponsiveDialog
      title="Print Invoice"
      description="Preview and print the generated invoice"
      open={open}
      onOpenChange={onOpenChange}
      className="lg:min-w-[80vw]"
      icon={Printer}
      noScroll
    >
      {invoiceId ? (
        <InvoicePrintContent
          invoiceId={invoiceId}
          onClose={() => onOpenChange(false)}
        />
      ) : (
        <PrintLoadingSkeleton />
      )}
    </ResponsiveDialog>
  );
};

/* ─── Inner content: fetches, transforms, previews ─── */

const InvoicePrintContent = ({
  invoiceId,
  onClose,
}: {
  invoiceId: string;
  onClose: () => void;
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const {
    data: invoice,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["invoice-print", invoiceId],
    queryFn: () => getInvoiceDetailFn({ data: { id: invoiceId } }),
    enabled: !!invoiceId,
    staleTime: 1000 * 60,
  });

  const isDistributor = invoice?.customer?.customerType === "distributor";

  // Memoise transformed data
  const distributorData = useMemo<DistributorInvoiceData | null>(() => {
    if (!invoice) return null;
    return buildDistributorData(invoice);
  }, [invoice]);

  const retailerData = useMemo<RetailerInvoiceData | null>(() => {
    if (!invoice) return null;
    return buildRetailerData(invoice);
  }, [invoice]);

  // Printing logic is now handled internally by RetailerInvoiceView / DistributorInvoiceView
  // which construct exact HTML styling for perfect printing.

  if (isLoading) return <PrintLoadingSkeleton />;

  if (isError || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle className="size-12 text-destructive" />
        <p className="text-sm font-medium text-destructive">
          Failed to load invoice details
        </p>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-1">
      {/* Controls bar */}
      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg shrink-0">
        <span className="text-xs text-muted-foreground font-medium mr-1">
          Template:
        </span>
        {/* Show only the relevant template button; hide the other */}
        {isDistributor ? (
          <Button
            variant="default"
            size="sm"
            className="text-xs h-7"
            disabled
          >
            <FileText className="size-3 mr-1" />
            Distributor
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="text-xs h-7"
            disabled
          >
            <FileText className="size-3 mr-1" />
            Retailer
          </Button>
        )}
        <div className="ml-auto">
          <InvoiceTypeBadge customerType={invoice.customer?.customerType || "retailer"} />
        </div>
      </div>

      {/* Preview pane */}
      <div className="flex-1 overflow-auto border rounded-lg bg-gray-50 dark:bg-zinc-900 p-4 min-h-[400px]">
        <div ref={printRef}>
          {isDistributor && distributorData ? (
            <DistributorInvoiceView invoice={distributorData} showActions={true} />
          ) : retailerData ? (
            <RetailerInvoiceView invoice={retailerData} showActions={true} />
          ) : null}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-end pt-2 border-t shrink-0">
        <Button variant="outline" onClick={onClose} className="rounded-none shadow-none">
          Close Preview
        </Button>
      </div>
    </div>
  );
};

/* ─── Data transformers ─── */

const fmtCartonQty = (n: number): string => `${n} - 0`;

const buildDistributorData = (inv: any): DistributorInvoiceData => {
  const items = (inv.items ?? []).map((item: any, i: number) => {
    const billedCartons = Number(item.numberOfCartons) || 0;
    const discCartons = Number(item.discountCartons) || 0;
    const packsPerCarton = Number(item.packsPerCarton) || 0;
    const marginPerPack = Number(item.margin) || 0;

    // Carton qty label: "N Cartons (M Packs)" when packsPerCarton is known
    const totalPacks = packsPerCarton > 0 ? billedCartons * packsPerCarton : 0;
    const cartonQtyLabel = totalPacks > 0
      ? `${billedCartons} Cartons (${totalPacks} Packs)`
      : fmtCartonQty(billedCartons);

    const schemeTotal = packsPerCarton > 0 ? discCartons * packsPerCarton : 0;
    const schemeLabel = discCartons > 0
      ? (schemeTotal > 0 ? `${discCartons} Cartons (${schemeTotal} Packs)` : fmtCartonQty(discCartons))
      : "0 - 0";

    return {
      serialNo: i + 1,
      itemCode: "",
      itemDescription: item.pack,
      cartonQty: cartonQtyLabel,
      schemeCarton: schemeLabel,
      cartonRate: Number(item.perCartonPrice) || 0,
      grossAmount: Number(item.amount) || 0,
      discount: 0,
      netAmount: Number(item.amount) || 0,
      // For profit calculation
      _billedCartons: billedCartons,
      _discCartons: discCartons,
      _packsPerCarton: packsPerCarton,
      _marginPerPack: marginPerPack,
    };
  });

  // Calculate total profit using COGS from invoice items when available.
  // If COGS is not available (legacy invoices), fall back to the selling-price derivation.
  const totalProfit = items.reduce((sum: number, item: any) => {
    const billedPacks = item._billedCartons * item._packsPerCarton;
    const freePacks = item._discCartons * item._packsPerCarton;
    const totalPacks = billedPacks + freePacks;

    // Use actual COGS per unit if available
    const cogsPerUnit = parseFloat(item.costOfGoodsSoldPerUnit || "0");
    if (cogsPerUnit > 0) {
      const lineSellingTotal = item._billedCartons * item.cartonRate;
      const lineCOGS = totalPacks * cogsPerUnit;
      return sum + (lineSellingTotal - lineCOGS);
    }

    // Fallback: circular derivation from selling prices
    const costPerPack = item._packsPerCarton > 0
      ? (item.cartonRate / item._packsPerCarton) - item._marginPerPack
      : 0;
    const revenue = billedPacks * item._marginPerPack;
    const freeCost = freePacks * Math.max(0, costPerPack);
    return sum + revenue - freeCost;
  }, 0) - (Number(inv.expenses) || 0);

  return {
    companyName: "IIPL",
    docType: "Sales Estimate",
    party: {
      name: inv.customer?.name ?? "N/A",
      address: inv.customer?.address ?? "N/A",
      city: inv.customer?.city ?? "N/A",
      tel: inv.customer?.mobileNumber ?? "N/A",
      mob: "",
    },
    date: format(new Date(inv.date), "dd-MMM-yyyy"),
    estNo: inv.slipNumber ?? inv.id.slice(-8).toUpperCase(),
    docNo: inv.slipNumber ?? inv.id.slice(-8).toUpperCase(),
    pvNo: "—",
    mBillNo: inv.slipNumber ?? "—",
    transporter: inv.warehouse?.name ?? "—",
    biltyNo: "—",
    dispDate: "—",
    items: items.map(({ _billedCartons, _discCartons, _packsPerCarton, _marginPerPack, ...rest }) => rest),
    freight: Number(inv.expenses) || 0,
    previousBalance: 0,
    invoiceAmount: Number(inv.totalPrice) || 0,
    totalProfit: Math.round(totalProfit * 100) / 100,
  };
};

const buildRetailerData = (inv: any): RetailerInvoiceData => {
  const isDist = inv.customer?.customerType === "distributor";
  return {
    invoiceNo: inv.slipNumber ?? inv.id.slice(-8).toUpperCase(),
    date: format(new Date(inv.date), "dd-MMM-yyyy"),
    customer: {
      name: inv.customer?.name ?? "N/A",
      completeAddress: inv.customer?.address ?? "N/A",
      phoneNumber: inv.customer?.mobileNumber ?? "N/A",
    },
    saleType: isDist ? "Wholesale" : "Retail",
    items: (inv.items ?? []).map((item: any, i: number) => {
      const packsPerCarton = Number(item.packsPerCarton) || 0;
      const billedCartons = Number(item.numberOfCartons) || 0;
      const discCartons = Number(item.discountCartons) || 0;
      const looseUnits = Number(item.quantity) || 0;

      // Compute qty display:
      // - Carton order: "N Cartons (M Packs)" — shows carton count and total packs
      // - Loose order: looseUnits directly
      let qty: number | string;
      if (billedCartons > 0 || discCartons > 0) {
        // Carton-based order
        const billedPacks = packsPerCarton > 0 ? billedCartons * packsPerCarton : billedCartons;
        const discPacks = packsPerCarton > 0 ? discCartons * packsPerCarton : discCartons;
        const cartonLabel = discCartons > 0
          ? `${billedCartons}+${discCartons} Cartons (${billedPacks + discPacks} Packs)`
          : (packsPerCarton > 0
            ? `${billedCartons} Cartons (${billedPacks} Packs)`
            : `${billedCartons} Cartons`);
        qty = cartonLabel;
      } else {
        // Loose/units order
        qty = looseUnits;
      }

      return {
        sNo: i + 1,
        productName: item.pack,
        hsnCode: item.hsnCode ?? "—",
        gstRate: 0,
        rate: Number(item.perCartonPrice) || 0,
        qty,
        grossAmount: Number(item.amount) || 0,
        netAmount: Number(item.amount) || 0,
      };
    }),
    cgstRate: 0,
    sgstRate: 0,
  };
};

/* ─── Skeleton ─── */

const PrintLoadingSkeleton = () => (
  <div className="space-y-4 p-1">
    <Skeleton className="h-10 w-full rounded-lg" />
    <Skeleton className="h-[400px] w-full rounded-lg" />
    <div className="flex justify-end gap-2">
      <Skeleton className="h-9 w-20 rounded-md" />
      <Skeleton className="h-9 w-24 rounded-md" />
    </div>
  </div>
);


