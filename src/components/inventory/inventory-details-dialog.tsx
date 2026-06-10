import {
  Calendar,
  Clock,
  Warehouse,
  Info,
  History,
  CheckCircle2,
  AlertCircle,
  User,
  Phone,
  Factory,
  Truck,
  ArrowRight,
  FlaskConical,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { getTransferHistoryFn } from "@/server-functions/inventory/stock/get-transfer-history-fn";
import { LabReportsList } from "./lab-reports/lab-reports-list";
import { Separator } from "@/components/ui/separator";

type DetailsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "chemical" | "packaging" | "finished";
  item: any;
};

export const InventoryDetailsDialog = ({
  open,
  onOpenChange,
  type,
  item,
}: DetailsProps) => {
  if (!item) return null;

  const material =
    type === "chemical"
      ? item.chemical
      : type === "packaging"
        ? item.packagingMaterial
        : item.recipe;
  const isFinished = type === "finished";

  const createdAt = new Date(item.createdAt);
  const updatedAt = new Date(item.updatedAt);

  const currentQty = isFinished
    ? item.quantityCartons * (item.recipe.containersPerCarton || 0) +
    item.quantityContainers
    : parseFloat(item.quantity);
  const minLevel = isFinished
    ? 0
    : parseFloat(material.minimumStockLevel?.toString() || "0");
  const isLow = !isFinished && currentQty < minLevel;

  const materialId = isFinished
    ? item.recipe?.id
    : type === "chemical"
      ? item.chemical?.id
      : item.packagingMaterial?.id;

  const { data: transferHistory } = useQuery({
    queryKey: ["transfer-history", type, materialId],
    queryFn: () =>
      getTransferHistoryFn({ data: { materialType: type, materialId } }),
    enabled: open && !!materialId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-3xl p-0 gap-0 overflow-hidden border-none ">
        <div className="bg-primary/5 p-6 border-b border-primary/10">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/20 uppercase text-[10px] font-bold "
              >
                {type.replace("_", " ")} Details
              </Badge>
              {isLow && (
                <Badge
                  variant="destructive"
                  className="animate-pulse text-[10px] font-bold uppercase "
                >
                  Low Stock Warning
                </Badge>
              )}
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
              {isFinished ? material.product.name : material.name}
              {isFinished && (
                <span className="text-sm font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {material.name}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground flex items-center gap-4 pt-1">
              <span className="flex items-center gap-1.5">
                <Warehouse className="size-3.5" />
                <span className="font-semibold text-foreground">
                  {item.warehouse.name}
                </span>
              </span>
              <span className="size-1 rounded-full bg-muted-foreground/30" />
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">
                  Inventory Audit Record
                </span>
              </span>
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-background shadow-xs min-h-[110px] flex flex-col">
                <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
                  <p className="text-[10px] font-black uppercase text-muted-foreground ">
                    Current Stock
                  </p>
                  <div className="flex flex-col gap-1">
                    <span className="text-3xl font-black text-foreground leading-none tracking-tighter">
                      {isFinished
                        ? item.quantityCartons
                        : currentQty.toFixed(0)}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 uppercase w-fit">
                      {isFinished
                        ? "Cartons"
                        : material.unit ||
                        (type === "packaging" ? "pcs" : "kg")}
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-background shadow-xs min-h-[110px] flex flex-col">
                <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
                  <p className="text-[10px] font-black uppercase text-muted-foreground ">
                    {isFinished ? "WAC / Pack" : "Value / Unit"}
                  </p>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-3xl font-black text-foreground leading-none tracking-tighter">
                        {isFinished
                          ? parseFloat(
                            (material as any).weightedAverageCostPerPack || material.estimatedCostPerContainer,
                          ).toFixed(2)
                          : parseFloat(material.costPerUnit).toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-md border border-primary/20 uppercase  w-fit">
                      PKR
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-background shadow-xs min-h-[110px] flex flex-col">
                <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
                  <p className="text-[10px] font-black uppercase text-muted-foreground ">
                    Threshold
                  </p>
                  <div className="flex flex-col gap-1">
                    <span className="text-3xl font-black text-foreground leading-none tracking-tighter">
                      {isFinished ? "N/A" : minLevel.toFixed(0)}
                    </span>
                    {!isFinished && (
                      <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md border border-border uppercase w-fit">
                        {material.unit || (type === "packaging" ? "pcs" : "kg")}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Transfer History Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase ">
                <Truck className="size-3.5" />
                <span>Recent Movements</span>
              </div>

              {transferHistory && transferHistory.length > 0 ? (
                <div className="border rounded-2xl overflow-hidden bg-muted/10">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/20 text-xs uppercase text-muted-foreground font-bold tracking-wider">
                      <tr>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Route</th>
                        <th className="px-4 py-3 text-right">Quantity</th>
                        <th className="px-4 py-3 text-right">By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-muted/10">
                      {transferHistory.map((transfer) => (
                        <tr
                          key={transfer.id}
                          className="group hover:bg-muted/5 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-foreground">
                            {format(
                              new Date(transfer.createdAt),
                              "MMM d, h:mm a",
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-xs">
                              <span
                                className={
                                  transfer.fromWarehouseId === item.warehouse.id
                                    ? "font-bold text-foreground"
                                    : "text-muted-foreground"
                                }
                              >
                                {transfer.fromWarehouse.name}
                              </span>
                              <ArrowRight className="size-3 text-muted-foreground/50" />
                              <span
                                className={
                                  transfer.toWarehouseId === item.warehouse.id
                                    ? "font-bold text-foreground"
                                    : "text-muted-foreground"
                                }
                              >
                                {transfer.toWarehouse.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium">
                            {parseFloat(transfer.quantity).toFixed(
                              isFinished ? 0 : 2,
                            )}
                            <span className="text-[10px] text-muted-foreground ml-1">
                              {isFinished ? "ctn" : material.unit || "units"}
                            </span>
                            {transfer.notes?.includes("loose units") && (
                              <div className="text-[10px] text-amber-600 font-bold tracking-tight">
                                + Loose Units
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                            {transfer.performedBy.name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 border border-dashed rounded-2xl flex flex-col items-center justify-center text-center gap-2 bg-muted/5">
                  <Truck className="size-8 text-muted-foreground/20" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No transfer history found
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 uppercase ">
                    Stock has not been moved between warehouses yet.
                  </p>
                </div>
              )}
            </div>

            {/* Supplier Information */}
            {!isFinished && material.lastSupplier ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase ">
                  <Factory className="size-3.5" />
                  <span>Primary Supplier</span>
                </div>
                <div className="bg-muted/10 border rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Factory className="size-24 -rotate-12" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground ">
                        Supplier Name
                      </p>
                      <p className="font-bold text-base text-foreground flex items-center gap-2">
                        {material.lastSupplier.supplierName}
                        <Link
                          to="/suppliers/$supplierId"
                          params={{ supplierId: material.lastSupplier.id }}
                        >
                          <Badge
                            variant="outline"
                            className="ml-2 hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors text-[10px] uppercase  h-5"
                          >
                            View Profile
                          </Badge>
                        </Link>
                      </p>
                    </div>

                    {material.lastSupplier.supplierShopName && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground ">
                          Shop Name
                        </p>
                        <p className="font-medium text-sm text-foreground">
                          {material.lastSupplier.supplierShopName}
                        </p>
                      </div>
                    )}

                    {material.lastSupplier.phone && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground ">
                          Contact
                        </p>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Phone className="size-3.5" />
                          <span>{material.lastSupplier.phone}</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground ">
                        Recent Activity
                      </p>
                      <p className="text-xs text-muted-foreground italic">
                        Last supplied on {format(updatedAt, "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              !isFinished && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-muted-foreground font-bold text-xs uppercase ">
                    <Factory className="size-3.5" />
                    <span>Primary Supplier</span>
                  </div>
                  <div className="bg-muted/5 border border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-2">
                    <Factory className="size-8 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">
                      No supplier information recorded for this material.
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 uppercase ">
                      Supplier history will appear here after the first
                      purchase.
                    </p>
                  </div>
                </div>
              )
            )}

            {/* Lab Reports Section (Chemicals Only) */}
            {type === "chemical" && material?.id && (
              <>
                <Separator />
                <LabReportsList
                  chemicalId={material.id}
                  chemicalName={material.name}
                />
              </>
            )}

            {/* Inventory Timeline */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase ">
                <History className="size-3.5" />
                <span>Lifecycle Traceability</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border border-dashed bg-muted/20 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-3.5" />
                    <span className="text-[10px] font-extrabold uppercase  opacity-70">
                      Initial Registration
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-base text-foreground">
                      {format(createdAt, "PPP")}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground/60">
                      {format(createdAt, "pp")}
                    </p>
                  </div>
                </div>
                <div className="p-5 rounded-2xl border border-dashed bg-muted/20 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-3.5" />
                    <span className="text-[10px] font-extrabold uppercase  opacity-70">
                      Last Modification
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-base text-foreground">
                      {format(updatedAt, "PPP")}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground/60">
                      {format(updatedAt, "pp")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Classification Info */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase ">
                <Info className="size-3.5" />
                <span>Attribute Profile</span>
              </div>
              <div className="bg-muted/10 border rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-muted/20 last:border-0 hover:bg-muted/5 transition-colors">
                      <td className="p-5 font-bold text-muted-foreground/80 bg-muted/20 w-1/3 text-xs uppercase ">
                        Classification
                      </td>
                      <td className="p-5 font-semibold text-foreground text-sm">
                        {type === "chemical"
                          ? "Chemical"
                          : type === "packaging"
                            ? "Packaging Material"
                            : "Finished Manufactured Good"}
                      </td>
                    </tr>
                    <tr className="border-b border-muted/20 last:border-0 hover:bg-muted/5 transition-colors">
                      <td className="p-5 font-bold text-muted-foreground/80 bg-muted/20 text-xs uppercase ">
                        Health Status
                      </td>
                      <td className="p-5">
                        {isLow ? (
                          <span className="flex items-center gap-2 text-destructive font-black text-xs uppercase">
                            <AlertCircle className="size-4 animate-pulse" />
                            Critically Low Levels
                          </span>
                        ) : (
                          <span className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase">
                            <CheckCircle2 className="size-4" />
                            Inventory Healthy
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-muted/20 last:border-0 hover:bg-muted/5 transition-colors">
                      <td className="p-5 font-bold text-muted-foreground/80 bg-muted/20 text-xs uppercase ">
                        Locality
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <Badge className="bg-background text-foreground border-border px-3 py-1 font-bold text-xs tracking-tight ">
                            {item.warehouse.name}
                          </Badge>
                          {!item.warehouse.isActive && (
                            <span className="text-[10px] font-black text-destructive uppercase  animate-pulse italic">
                              (Inactive)
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 bg-muted/30 border-t flex justify-end">
          <button
            onClick={() => onOpenChange(false)}
            className="px-6 py-2 bg-foreground text-background font-bold rounded-xl text-sm transition-all hover:opacity-90 active:scale-95 "
          >
            Close Details
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
