import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getProductionRunsFn } from "@/server-functions/inventory/production/get-production-run-fn";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Warehouse,
  User,
  Activity,
  Calculator,
  FlaskConical,
  ChevronRight,
  Clock,
  AlertCircle,
  BarChart3,
  Receipt,
  ArrowLeft,
  AlertTriangle,
  Package,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { useStartProduction } from "@/hooks/production/use-start-production";
import { useCompleteProduction } from "@/hooks/production/use-complete-production";
import { useCancelProduction } from "@/hooks/production/use-cancel-production";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_protected/manufacturing/productions/$runId/",
)({
  component: ProductionRunDetailsPage,
});

function ProductionRunDetailsPage() {
  const { runId } = Route.useParams();

  const { data: runs } = useSuspenseQuery({
    queryKey: ["production-run", runId],
    queryFn: () => getProductionRunsFn({ data: { runId } }),
  });

  const run = runs[0];

  // Hooks
  const startProduction = useStartProduction();
  const completeProduction = useCompleteProduction();
  const cancelProduction = useCancelProduction();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 space-y-4">
        <AlertCircle className="size-12 text-muted-foreground/50" />
        <h2 className="text-xl font-bold text-muted-foreground">
          Production Run Not Found or Access Denied
        </h2>
        <Button variant="outline" asChild>
          <Link to="/manufacturing/productions">Back to List</Link>
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return (
          <Badge
            variant="secondary"
            className="px-3 py-1 font-bold uppercase  text-[10px]"
          >
            Scheduled
          </Badge>
        );
      case "in_progress":
        return (
          <Badge
            variant="default"
            className="bg-blue-600 px-3 py-1 font-bold uppercase  text-[10px]"
          >
            In Progress
          </Badge>
        );
      case "completed":
        return (
          <Badge
            variant="default"
            className="bg-emerald-600 px-3 py-1 font-bold uppercase  text-[10px]"
          >
            Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge
            variant="destructive"
            className="px-3 py-1 font-bold uppercase  text-[10px]"
          >
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="px-3 py-1 font-bold uppercase  text-[10px]"
          >
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="-ml-2">
            <Link to="/manufacturing/productions">
              <ArrowLeft className="size-5 text-muted-foreground" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 bg-muted px-2 py-0.5 rounded">
                Production Details
              </span>
              <ChevronRight className="size-3 text-muted-foreground/40" />
              <span className="text-[10px] font-bold font-mono text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                {run.batchId}
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {run.recipe.name}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(run.status)}

          <Button variant="outline" size="sm" asChild className="h-8 text-xs font-bold uppercase tracking-wide">
            <Link to="/manufacturing/productions/$runId/cartons" params={{ runId: run.id }}>
              <Package className="size-3.5 mr-1.5" />
              Cartons
            </Link>
          </Button>

          {/* Action Buttons */}
          {run.status === "scheduled" && (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={cancelProduction.isPending}
                onClick={() => setCancelDialogOpen(true)}
                className="h-8 text-xs font-bold uppercase tracking-wide bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20"
              >
                Cancel Run
              </Button>
              <Button
                size="sm"
                disabled={startProduction.isPending}
                onClick={() =>
                  startProduction.mutate(
                    { data: { productionRunId: run.id } },
                    {
                      onSuccess: () => toast.success("Production Started"),
                    },
                  )
                }
                className="h-8 text-xs font-bold uppercase tracking-wide px-4"
              >
                {startProduction.isPending ? "Starting..." : "Start Production"}
              </Button>
            </div>
          )}

          {run.status === "in_progress" && (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={cancelProduction.isPending}
                onClick={() => setCancelDialogOpen(true)}
                className="h-8 text-xs font-bold uppercase tracking-wide bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20"
              >
                Mark as Failed / Cancel
              </Button>
              <Button
                size="sm"
                disabled={completeProduction.isPending}
                onClick={() =>
                  completeProduction.mutate(
                    { data: { productionRunId: run.id } },
                    {
                      onSuccess: () =>
                        toast.success("Production Run Completed"),
                    },
                  )
                }
                className="h-8 text-xs font-bold uppercase tracking-wide px-4 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {completeProduction.isPending
                  ? "Completing..."
                  : "Complete Run"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-8 pb-24 space-y-8 max-w-[1600px] mx-auto">
          {/* Failed Run Warning Banner */}
          {run.status === "cancelled" && (
            <div className="bg-destructive/10 border-l-4 border-destructive p-4 rounded-r-lg  flex items-start gap-4">
              <AlertTriangle className="size-6 text-destructive shrink-0 mt-0.5" />
              <div>
                <h3 className="text-destructive font-bold text-lg">Physical Stock Return Required</h3>
                <p className="text-destructive/90 text-sm mt-1">
                  The system has automatically reversed chemical stock for this failed run. Please ensure physical chemicals are returned from the factory floor back to storage.
                </p>
              </div>
            </div>
          )}

          {/* Top Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Costs Stats */}
            <Card className="md:col-span-2 bg-linear-to-br from-primary/5 via-background to-background border-primary/10  relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                <Calculator className="size-32 -mr-8 -mt-8" />
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase  text-primary flex items-center gap-2">
                  <Receipt className="size-4" />
                  Financials
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-8 items-end">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1 tracking-wider">
                      Total Cost
                    </p>
                    <p className="text-3xl font-black text-foreground tabular-nums">
                      <span className="text-lg font-bold text-muted-foreground/40 mr-1">
                        PKR
                      </span>
                      {parseFloat(
                        run.totalProductionCost || "0",
                      ).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/5 text-emerald-600 border-emerald-500/20 font-bold mb-2"
                    >
                      PKR {Number(run.actualCostPerPack || "0") > 0
                        ? Number(run.actualCostPerPack).toFixed(2)
                        : (parseFloat(run.totalProductionCost || "0") > 0 && (run.completedUnits || 0) > 0
                            ? (parseFloat(run.totalProductionCost || "0") / run.completedUnits!).toFixed(2)
                            : parseFloat(run.costPerContainer || "0").toFixed(2))} /
                      Unit
                    </Badge>
                    <div className="text-xs text-right">
                      <span className="text-muted-foreground mr-2">
                        Chemicals:
                      </span>
                      <span className="font-bold">
                        {(
                          (parseFloat(run.totalChemicalCost || "0") /
                            parseFloat(run.totalProductionCost || "1")) *
                          100
                        ).toFixed(0)}
                        %
                      </span>
                    </div>
                    <div className="text-xs text-right">
                      <span className="text-muted-foreground mr-2">
                        Packaging:
                      </span>
                      <span className="font-bold">
                        {(
                          (parseFloat(run.totalPackagingCost || "0") /
                            parseFloat(run.totalProductionCost || "1")) *
                          100
                        ).toFixed(0)}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Yield Stats */}
            <Card className="bg-background/50 border relative overflow-hidden">
              {(run.shortfallUnits ?? 0) > 0 && (
                <div className="absolute top-0 right-0 py-1.5 px-3 bg-amber-500 text-white text-[9px] font-black uppercase  rotate-0 origin-top-right">
                  Shortfall Detected
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase  text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="size-4" />
                  Production Output
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Total Units
                    </span>
                    <span className="text-2xl font-black tabular-nums">
                      {run.completedUnits}{" "}
                      <span className="text-xs font-bold text-muted-foreground">
                        / {run.containersProduced}
                      </span>
                    </span>
                  </div>
                  <div className="relative pt-1">
                    <Progress
                      value={(run.completedUnits! / run.containersProduced) * 100}
                      className="h-2"
                    />
                    {((run.shortfallUnits ?? 0) > 0) && (
                      <div 
                        className="absolute top-0 h-4 w-0.5 bg-destructive z-10 opacity-60"
                        style={{ left: `${(run.completedUnits! / run.containersProduced) * 100}%` }}
                        title={`Shortfall of ${run.shortfallUnits} units`}
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="bg-muted/30 p-2 rounded">
                      <p className="text-muted-foreground text-[10px] uppercase font-bold">
                        Cartons
                      </p>
                      <p className="font-bold text-base">
                        {Math.floor(
                          run.completedUnits! /
                          (run.recipe.containersPerCarton || 1),
                        )}
                      </p>
                    </div>
                    <div className="bg-amber-50/50 border border-amber-100 p-2 rounded text-amber-900 shrink-0">
                      <p className="text-amber-800/70 text-[10px] uppercase font-bold">
                        Loose/Short
                      </p>
                      <p className="font-bold text-base flex items-baseline gap-1.5">
                        {run.completedUnits! %
                          (run.recipe.containersPerCarton || 1)}
                        {((run.shortfallUnits ?? 0) > 0) && (
                          <span className="text-[10px] text-destructive font-black">
                            ({run.shortfallUnits}V)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timing */}
            <Card className="bg-background/50 border ">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase  text-muted-foreground flex items-center gap-2">
                  <Clock className="size-4" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                    Started
                  </p>
                  <p className="text-sm font-medium">
                    {run.actualStartDate
                      ? format(new Date(run.actualStartDate), "MMM d, h:mm a")
                      : "---"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                    Completed
                  </p>
                  <p className="text-sm font-medium">
                    {run.actualCompletionDate
                      ? format(
                        new Date(run.actualCompletionDate),
                        "MMM d, h:mm a",
                      )
                      : "---"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content: Material Audit */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-primary flex items-center gap-2">
                  <FlaskConical className="size-4" />
                  Material Consumption Audit
                </h3>
                <Badge variant="outline" className="bg-background text-xs">
                  {run.materialsUsed?.length || 0} Records
                </Badge>
              </div>

              <Card className=" border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-bold tracking-wider">
                        Resource
                      </TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-wider text-center">
                        Type
                      </TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-wider text-right">
                        Qty Used
                      </TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-wider text-right">
                        Cost Impact
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {run.materialsUsed?.map((m: any, idx: number) => (
                      <TableRow key={idx} className="group hover:bg-muted/5">
                        <TableCell className="font-medium">
                          {m.materialName}
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            ID: {m.materialId.substring(0, 6)}...
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className="text-[9px] uppercase font-bold border-muted-foreground/20 text-muted-foreground"
                          >
                            {m.materialType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          {parseFloat(m.quantityUsed).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-muted-foreground">
                          PKR {parseFloat(m.totalCost).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!run.materialsUsed?.length && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="h-24 text-center text-muted-foreground text-sm"
                        >
                          No material usage recorded.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>

            {/* Sidebar: Details & Failure Notes */}
            <div className="space-y-6">
              {/* Shortfall Reason Section */}
              {((run.shortfallUnits ?? 0) > 0) && (
                <Card className="bg-red-50 border-red-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase  text-red-600 flex items-center gap-2">
                      <AlertTriangle className="size-4" />
                      Shortfall / Variance Reason
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-bold text-red-900 leading-relaxed bg-white/50 border border-red-100 p-3 rounded italic">
                      "{run.shortfallReason || "No explanation provided."}"
                    </div>
                    <div className="mt-3 text-[10px] text-red-600 font-medium italic">
                      * This run was forced closed early with {run.shortfallUnits} missing units.
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Failure / Notes Section */}
              <Card
                className={
                  run.notes
                    ? "bg-amber-50/50 border-amber-200"
                    : "bg-muted/10 border-border/50"
                }
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-black uppercase  text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="size-4" />
                    Process Notes & Observations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {run.notes ? (
                    <div className="text-sm italic text-amber-900/80 leading-relaxed font-medium whitespace-pre-wrap">
                      "{run.notes}"
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic h-20 flex items-center justify-center border border-dashed rounded-lg bg-background/50">
                      No notes recorded.
                    </div>
                  )}
                  <div className="mt-4 text-[10px] text-muted-foreground">
                    * Review these notes for failure reasons or production
                    anomalies.
                  </div>
                </CardContent>
              </Card>

              {/* Logistics */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-xs font-black uppercase  text-muted-foreground flex items-center gap-2">
                    <Activity className="size-4" />
                    Logistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Warehouse className="size-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">
                        Warehouse
                      </p>
                      <p className="text-sm font-bold">{run.warehouse.name}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <User className="size-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">
                        Initiated By
                      </p>
                      <p className="text-sm font-bold">{run.initiator?.name || "System"}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                      <User className="size-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">
                        Assigned Operator
                      </p>
                      <p className="text-sm font-bold">{run.operator.name}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Cancel/Fail Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Run as Failed / Cancelled</DialogTitle>
            <DialogDescription>
              This will stop the production run. Please provide a reason for the
              record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Failure / Cancellation</Label>
              <Textarea
                placeholder="e.g. Machine breakdown, Material shortage, etc."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <div className="text-xs text-destructive font-medium p-3 bg-destructive/10 rounded-md border border-destructive/20">
              Note: Unused chemical materials will be automatically reversed in the warehouse stock. Please return physical stock.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelDialogOpen(false)}>
              Back
            </Button>
            <Button
              variant="destructive"
              disabled={!cancelReason || cancelProduction.isPending}
              onClick={() => {
                cancelProduction.mutate(
                  {
                    data: {
                      productionRunId: run.id,
                      reason: cancelReason,
                    },
                  },
                  {
                    onSuccess: () => {
                      setCancelDialogOpen(false);
                      setCancelReason("");
                      toast.error("Production run cancelled.");
                    },
                  },
                );
              }}
            >
              {cancelProduction.isPending
                ? "Cancelling..."
                : "Confirm Failure/Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Progress = ({
  value,
  className,
}: {
  value: number;
  className?: string;
}) => (
  <div
    className={`w-full bg-secondary rounded-full overflow-hidden ${className}`}
  >
    <div
      className="h-full bg-primary transition-all duration-500 ease-in-out"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);
