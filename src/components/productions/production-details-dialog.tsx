import { Dialog, DialogContent } from "../ui/dialog";
import { Badge } from "../ui/badge";
import { format } from "date-fns";
import { Button } from "../ui/button";
import {
  Warehouse,
  User,
  Activity,
  Calculator,
  FlaskConical,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Receipt,
  Calendar1Icon,
} from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: any;
};

export const ProductionDetailsDialog = ({ open, onOpenChange, run }: Props) => {
  if (!run) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return (
          <Badge
            variant="secondary"
            className="px-3 py-1 font-bold uppercase  text-[9px]"
          >
            Scheduled
          </Badge>
        );
      case "in_progress":
        return (
          <Badge
            variant="default"
            className="bg-blue-600 px-3 py-1 font-bold uppercase  text-[9px]"
          >
            In Progress
          </Badge>
        );
      case "completed":
        return (
          <Badge
            variant="default"
            className="bg-emerald-600 px-3 py-1 font-bold uppercase  text-[9px]"
          >
            Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge
            variant="destructive"
            className="px-3 py-1 font-bold uppercase  text-[9px]"
          >
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="px-3 py-1 font-bold uppercase  text-[9px]"
          >
            {status}
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-7xl max-h-[92vh] overflow-y-auto flex flex-col p-0 border-none ">
        {/* Premium Header */}
        <div className="relative bg-muted/30 p-8 pt-10 pb-6 border-b">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pr-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 bg-muted px-2 py-0.5 rounded">
                  Process Record
                </span>
                <ChevronRight className="size-3 text-muted-foreground/40" />
                <span className="text-[10px] font-bold font-mono text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                  {run.batchId}
                </span>
              </div>
              <h2 className="text-3xl font-black tracking-tight leading-none text-foreground">
                {run.recipe.product.name}
              </h2>
              <p className="text-muted-foreground font-medium text-lg leading-snug">
                {run.recipe.name}
              </p>
            </div>
            <div className="flex flex-col items-start md:items-end gap-3">
              {getStatusBadge(run.status)}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-wider bg-background/50 px-3 py-1.5 rounded-full border ">
                <Calendar1Icon className="size-3" />
                Created {format(new Date(run.createdAt), "MMMM d, yyyy")}
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-8 space-y-10">
            {/* High-Level Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Costs Stats */}
              <div className="col-span-1 md:col-span-2 bg-primary/2 rounded-2xl border border-primary/10 p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Calculator className="size-24 -mr-6 -mt-6" />
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2 text-primary">
                      <Receipt className="size-4" />
                      <span className="text-xs font-black uppercase ">
                        Financial Summary
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/5 text-emerald-600 border-emerald-500/20 font-bold"
                    >
                      PKR {Number(run.actualCostPerPack || "0") > 0
                        ? Number(run.actualCostPerPack).toFixed(2)
                        : (parseFloat(run.totalProductionCost || "0") > 0 && (run.completedUnits || 0) > 0
                            ? (parseFloat(run.totalProductionCost || "0") / run.completedUnits!).toFixed(2)
                            : parseFloat(run.costPerContainer || "0").toFixed(2))} /
                      Unit
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-end">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1 tracking-wider">
                        Total Investment
                      </p>
                      <p className="text-4xl font-black text-foreground tabular-nums">
                        <span className="text-xl font-bold text-muted-foreground/40 mr-1">
                          PKR
                        </span>
                        {parseFloat(
                          run.totalProductionCost || "0",
                        ).toLocaleString()}
                      </p>
                    </div>
                    <div className="space-y-2 border-l border-primary/10 pl-8">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-medium">
                          Chemicals
                        </span>
                        <span className="font-bold tabular-nums">
                          PKR{" "}
                          {parseFloat(
                            run.totalChemicalCost || "0",
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-medium">
                          Packaging
                        </span>
                        <span className="font-bold tabular-nums">
                          PKR{" "}
                          {parseFloat(
                            run.totalPackagingCost || "0",
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Yield Stats */}
              <div className="bg-muted/20 rounded-2xl border p-6 flex flex-col justify-between">
                <div className="flex items-center gap-2 text-muted-foreground/60 mb-6 font-black uppercase  text-[10px]">
                  <BarChart3 className="size-4" />
                  Output Analytics
                </div>
                <div className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Total Yield
                    </span>
                    <span className="text-xl font-black">
                      {run.containersProduced}{" "}
                      <span className="text-xs font-bold text-muted-foreground">
                        Packs
                      </span>
                    </span>
                  </div>
                  <Separator className="bg-border/50" />
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <p className="text-muted-foreground mb-0.5">Cartons</p>
                      <p className="font-bold">{run.cartonsProduced}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-0.5">
                        Loose Units
                      </p>
                      <p className="font-bold text-amber-600">
                        {run.looseUnitsProduced}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Sections Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Execution Log */}
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2 px-1">
                  <Activity className="size-3.5" />
                  Logistics & Timeline
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <LogCard
                    icon={<Warehouse className="size-4" />}
                    label="Production Facility"
                    value={run.warehouse.name}
                  />
                  <LogCard
                    icon={<User className="size-4" />}
                    label="Assigned Operator"
                    value={run.operator.name}
                  />
                  <LogCard
                    icon={<Clock className="size-4" />}
                    label="Production Started"
                    value={
                      run.actualStartDate
                        ? format(new Date(run.actualStartDate), "PPpp")
                        : "---"
                    }
                  />
                  <LogCard
                    icon={<CheckCircle2 className="size-4" />}
                    label="Production Completed"
                    value={
                      run.actualCompletionDate
                        ? format(new Date(run.actualCompletionDate), "PPpp")
                        : "---"
                    }
                  />
                </div>
              </div>

              {/* Batch Notes */}
              <div className="flex flex-col">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2 px-1 mb-6">
                  <AlertCircle className="size-3.5" />
                  Internal Memo
                </h3>
                <div className="flex-1 p-6 rounded-2xl bg-amber-500/3 border border-amber-500/10 italic text-sm text-amber-900/70 leading-relaxed font-medium">
                  {run.notes
                    ? `"${run.notes}"`
                    : "No internal notes recorded for this batch."}
                </div>
              </div>
            </div>

            {/* Material Audit Table */}
            <div className="space-y-6 pb-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2 px-1">
                <FlaskConical className="size-3.5" />
                Material Extraction Audit
              </h3>
              <div className="rounded-2xl border border-border overflow-hidden bg-background">
                <Table>
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-6 py-4 text-[10px]  uppercase text-muted-foreground h-auto">
                        Resource Name
                      </TableHead>
                      <TableHead className="px-6 py-4 text-[10px]  uppercase text-muted-foreground h-auto text-center">
                        Category
                      </TableHead>
                      <TableHead className="px-6 py-4 text-[10px]  uppercase text-muted-foreground h-auto text-center">
                        Batch Draw
                      </TableHead>
                      <TableHead className="px-6 py-4 text-[10px]  uppercase text-muted-foreground h-auto text-right">
                        Audit Cost
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {run.materialsUsed?.map((m: any) => (
                      <TableRow
                        key={m.id}
                        className="hover:bg-muted/2 transition-colors group border-border/50"
                      >
                        <TableCell className="px-6 py-4">
                          <div className="space-y-0.5">
                            <p className="font-bold text-foreground text-sm leading-none">
                              {m.materialName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-center">
                          <Badge
                            variant="outline"
                            className="text-[9px]  uppercase py-0 px-2 h-5 tracking-tighter bg-muted/20"
                          >
                            {m.materialType}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-center">
                          <span className="font-bold font-mono text-xs bg-muted/30 px-2 py-1 rounded">
                            {parseFloat(m.quantityUsed).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right">
                          <span className="font-black text-xs tabular-nums text-foreground/80">
                            PKR {parseFloat(m.totalCost).toLocaleString()}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="p-6 bg-muted/10 border-t flex justify-between items-center px-8">
          <p className="text-[10px] font-bold text-muted-foreground uppercase ">
            System Generated Audit Log • Titan ERP
          </p>
          <Button
            onClick={() => onOpenChange(false)}
            size="lg"
            variant="default"
            className="px-8 font-bold text-xs uppercase  h-11"
          >
            Close Audit Record
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const LogCard = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex items-center gap-4 group p-1">
    <div className="size-10 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary group-hover:border-primary/20 transition-all duration-300">
      {icon}
    </div>
    <div className="space-y-0.5">
      <p className="text-[10px] font-black uppercase text-muted-foreground/50  leading-none">
        {label}
      </p>
      <p className="font-bold text-sm tracking-tight text-foreground/80">
        {value}
      </p>
    </div>
  </div>
);
