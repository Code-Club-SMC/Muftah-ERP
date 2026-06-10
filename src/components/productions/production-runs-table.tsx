import { formatDistanceToNow } from "date-fns";
import { Eye, Play, NotebookPenIcon, ArrowUpDown, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { toast } from "sonner";
import { useStartProduction } from "@/hooks/production/use-start-production";
import { useCompleteProduction } from "@/hooks/production/use-complete-production";
import { useDeleteProductionRun } from "@/hooks/production/use-delete-production-run";
import { useCancelProduction } from "@/hooks/production/use-cancel-production";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { DataTable } from "../custom/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

type ProductionRunsTableProps = {
  runs: any[];
  manualPagination?: boolean;
  pageCount?: number;
  pagination?: { pageIndex: number; pageSize: number };
  onPaginationChange?: (updater: any) => void;
  totalRecords?: number;
};

export const ProductionRunsTable = ({
  runs,
  manualPagination,
  pageCount,
  pagination,
  onPaginationChange,
  totalRecords,
}: ProductionRunsTableProps) => {
  const startProduction = useStartProduction();
  const completeProduction = useCompleteProduction();
  const deleteProductionRun = useDeleteProductionRun();
  const cancelProduction = useCancelProduction();

  // Lifted dialog state — prevents re-renders from closing open dialogs
  const [startDialogRunId, setStartDialogRunId] = useState<string | null>(null);
  const [finishDialogRunId, setFinishDialogRunId] = useState<string | null>(
    null,
  );
  const [deleteDialogRunId, setDeleteDialogRunId] = useState<string | null>(
    null,
  );
  const [cancelDialogRunId, setCancelDialogRunId] = useState<string | null>(
    null,
  );
  const [cancelReason, setCancelReason] = useState("");
  const [shortfallReason, setShortfallReason] = useState("");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="secondary">Scheduled</Badge>;
      case "in_progress":
        return (
          <Badge variant="default" className="bg-blue-600">
            In Progress
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="bg-green-600">
            Completed
          </Badge>
        );
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "failed":
        return (
          <Badge variant="destructive" className="bg-destructive/10">
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: "batchId",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="-ml-3 h-auto py-1 uppercase text-[10px] font-bold tracking-tight"
            >
              Batch ID
              <ArrowUpDown className="ml-2 h-3 w-3" />
            </Button>
          );
        },
        cell: ({ row }) => (
          <span className="font-mono text-xs font-bold text-primary tracking-tighter">
            {row.getValue("batchId")}
          </span>
        ),
      },
      {
        id: "recipe",
        accessorFn: (row) => row.recipe.name,
        header: () => (
          <span className="text-[10px] font-bold uppercase tracking-wide">
            Recipe
          </span>
        ),
        cell: ({ row }) => (
          <div>
            <p className="font-bold text-sm tracking-tight">
              {row.original.recipe.name}
            </p>
            <p className="text-[10px] font-medium text-muted-foreground uppercase">
              {row.original.recipe.product.name}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: () => (
          <span className="text-[10px] font-bold uppercase tracking-tight text-center block w-full">
            Status
          </span>
        ),
        cell: ({ row }) => getStatusBadge(row.getValue("status")),
      },
      {
        id: "progress",
        header: () => (
          <span className="text-[10px] font-bold uppercase tracking-wide text-center block w-full">
            Progress
          </span>
        ),
        cell: ({ row }) => {
          const run = row.original;
          const progress =
            run.containersProduced > 0
              ? ((run.completedUnits || 0) / run.containersProduced) * 100
              : 0;

          if (run.status !== "in_progress")
            return (
              <span className="text-xs text-muted-foreground text-center block">
                -
              </span>
            );

          return (
            <div className="w-[80px] space-y-1 mx-auto">
              <Progress value={progress} className="h-1.5" />
              <p className="text-[10px] text-center font-medium text-muted-foreground">
                {Math.round(progress)}%
              </p>
            </div>
          );
        },
      },
      {
        id: "target",
        accessorKey: "containersProduced",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-auto py-1 uppercase text-[10px] font-bold tracking-wide"
          >
            Target
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-sm">
            <p className="font-bold">
              {row.original.containersProduced}{" "}
              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                Units
              </span>
            </p>
            {row.original.recipe.containersPerCarton > 0 && (
              <p className="text-[10px] text-muted-foreground font-bold uppercase leading-none">
                {Math.ceil(
                  row.original.containersProduced /
                  row.original.recipe.containersPerCarton,
                )}{" "}
                Cartons
              </p>
            )}
          </div>
        ),
      },
      {
        id: "produced",
        header: () => (
          <span className="text-[10px] font-bold uppercase tracking-wide text-center block w-full">
            Produced
          </span>
        ),
        cell: ({ row }) => {
          const run = row.original;
          const produced = run.completedUnits || 0;
          const perCarton = run.recipe.containersPerCarton || 0;
          const cartons = perCarton > 0 ? Math.ceil(produced / perCarton) : 0;
          const loose = perCarton > 0 ? produced % perCarton : produced;

          if (run.status === "scheduled")
            return (
              <span className="text-xs text-muted-foreground text-center block">
                -
              </span>
            );

          return (
            <div className="text-sm text-center">
              <p className="font-bold text-green-700">
                {produced.toLocaleString()}{" "}
                <span className="text-[10px] font-medium text-green-600/70 uppercase">
                  Units
                </span>
              </p>
              {run.shortfallUnits > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] px-1 py-0 h-4 mt-1 font-bold">
                  SHORT: {run.shortfallUnits}
                </Badge>
              )}
              {perCarton > 0 && produced > 0 && (
                <p className="text-[10px] text-muted-foreground font-bold uppercase leading-none mt-1">
                  {cartons > 0 ? `${cartons} Cartons ` : ""}
                  {loose > 0 ? `+ ${loose} Loose` : ""}
                </p>
              )}
            </div>
          );
        },
      },
      {
        id: "totalCost",
        accessorKey: "totalProductionCost",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-auto py-1 uppercase text-[10px] font-bold tracking-wide"
          >
            Total Cost
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-black text-sm tracking-tight">
              PKR{" "}
              {parseFloat(
                row.original.totalProductionCost || "0",
              ).toLocaleString()}
            </p>
            {row.original.totalChemicalCost && (
              <p className="text-[10px] text-muted-foreground font-black uppercase flex items-center gap-1">
                <span className="text-blue-600/60">
                  Chem: {parseFloat(row.original.totalChemicalCost).toFixed(0)}
                </span>
                <span className="text-muted-foreground/30">|</span>
                <span className="text-purple-600/60">
                  Pkg: {parseFloat(row.original.totalPackagingCost).toFixed(0)}
                </span>
              </p>
            )}
          </div>
        ),
      },
      {
        id: "costPerContainer",
        accessorKey: "costPerContainer",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-auto py-1 uppercase text-[10px] font-bold tracking-wide"
          >
            Cost/Unit
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const run = row.original;

          // Prefer actual cost per pack for completed runs, fall back to computed budget
          const actualCost = Number(run.actualCostPerPack || "0");
          const displayCost = actualCost > 0
            ? actualCost.toFixed(2)
            : (() => {
                const totalCostNumeric = parseFloat(run.totalProductionCost || "0");
                const hasGeneratedOutput = (run.completedUnits || 0) > 0;
                const isStarted = run.status === "in_progress" || run.status === "completed";
                return isStarted && hasGeneratedOutput
                  ? (totalCostNumeric / run.completedUnits!).toFixed(2)
                  : parseFloat(run.costPerContainer || "0").toFixed(2);
              })();

          return (
            <Badge
              variant="outline"
              className="font-bold text-green-600 border-green-200 bg-green-50/50"
            >
              PKR {displayCost}
            </Badge>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-3 h-auto py-1 uppercase text-[10px] font-bold tracking-wide"
          >
            Created
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-xs font-medium text-muted-foreground">
            {formatDistanceToNow(new Date(row.getValue("createdAt")), {
              addSuffix: true,
            })}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => (
          <span className="text-[10px] font-bold uppercase tracking-wide text-center block w-full">
            Actions
          </span>
        ),
        cell: ({ row }) => {
          const run = row.original;
          return (
            <div className="flex justify-end gap-2">
              {run.status === "scheduled" && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 text-[10px] font-black uppercase tracking-wider"
                  disabled={startProduction.isPending}
                  onClick={() => setStartDialogRunId(run.id)}
                >
                  <Play className="size-3 mr-1.5" />
                  Start Run
                </Button>
              )}

              {run.status === "in_progress" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-black uppercase tracking-wider text-destructive border-destructive/30 hover:bg-destructive/10"
                    disabled={cancelProduction.isPending}
                    onClick={() => setCancelDialogRunId(run.id)}
                  >
                    <AlertTriangle className="size-3 mr-1.5" />
                    Mark Failed
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-[10px] font-black uppercase tracking-wider bg-green-600 hover:bg-green-700"
                    disabled={completeProduction.isPending}
                    onClick={() => setFinishDialogRunId(run.id)}
                  >
                    <NotebookPenIcon className="size-3 mr-1.5" />
                    Finish Run
                  </Button>
                </>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-primary transition-colors"
                asChild
              >
                <Link
                  to={`/manufacturing/productions/$runId`}
                  params={{ runId: run.id }}
                >
                  <Eye className="size-4" />
                </Link>
              </Button>

              {(run.status === "scheduled" || run.status === "cancelled") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={() => setDeleteDialogRunId(run.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [startProduction.isPending, completeProduction.isPending, deleteProductionRun.isPending, cancelProduction.isPending],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={runs}
        showSearch={false}
        pageSize={pagination?.pageSize || 6}
        manualPagination={manualPagination}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        autoResetPageIndex={false}
        totalRecords={totalRecords}
      />

      {/* Start Run Confirmation Dialog — lifted outside table to survive re-renders */}
      <AlertDialog
        open={!!startDialogRunId}
        onOpenChange={(open) => !open && setStartDialogRunId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Production?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deduct all the Chemicals at once and the but the packaging material will be deducted as operator input logs are entered.
              All the deductions will be from the factory-floor. This action cannot be easily undone. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!startDialogRunId) return;
                startProduction.mutate(
                  {
                    data: { productionRunId: startDialogRunId },
                  },
                  {
                    onSuccess: () => {
                      toast.success("Production Started", {
                        description:
                          "Materials deducted. Status set to In Progress.",
                      });
                      setStartDialogRunId(null);
                    },
                    onError: (err) => {
                      toast.error("Failed to start production", {
                        description: err.message,
                      });
                    },
                  },
                );
              }}
            >
              Start Production
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Finish Run Confirmation Dialog — lifted outside table to survive re-renders */}
      <AlertDialog
        open={!!finishDialogRunId}
        onOpenChange={(open) => !open && setFinishDialogRunId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Production?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create finished goods in the warehouse. You can transfer
              them to other warehouses afterwards.
            </AlertDialogDescription>
            {(() => {
              const runToFinish = runs.find(r => r.id === finishDialogRunId);
              if (!runToFinish || (runToFinish.completedUnits || 0) >= runToFinish.containersProduced) return null;
              
              return (
                <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-100 space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="size-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-900">Shortfall Detected</h4>
                      <p className="text-xs text-amber-800/80 leading-relaxed mt-1">
                        Actual production ({runToFinish.completedUnits}) is below the target ({runToFinish.containersProduced}). 
                        By completing this run, you are acknowledging the loss of {runToFinish.containersProduced - (runToFinish.completedUnits || 0)} units.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-amber-900">Reason for Shortfall</Label>
                    <Textarea 
                      placeholder="e.g., Quality control failure, material spillage..."
                      value={shortfallReason}
                      onChange={(e) => setShortfallReason(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                </div>
              );
            })()}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                const runToFinish = runs.find(r => r.id === finishDialogRunId);
                const isShort = runToFinish && (runToFinish.completedUnits || 0) < runToFinish.containersProduced;

                if (isShort && !shortfallReason.trim()) {
                  toast.error("Shortfall reason required", {
                    description: "You must provide a reason for completing this run with missing units."
                  });
                  return;
                }

                if (!finishDialogRunId) return;
                completeProduction.mutate(
                  {
                    data: { 
                      productionRunId: finishDialogRunId,
                      shortfallReason: shortfallReason.trim() || undefined
                    },
                  },
                  {
                    onSuccess: () => {
                      toast.success("Production Completed", {
                        description: "Finished goods added to inventory.",
                      });
                      setFinishDialogRunId(null);
                      setShortfallReason("");
                    },
                    onError: (err) => {
                      toast.error("Failed to complete production", {
                        description: err.message,
                      });
                    },
                  },
                );
              }}
            >
              Complete Production
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel/Fail Run Confirmation Dialog */}
      <AlertDialog
        open={!!cancelDialogRunId}
        onOpenChange={(open) => {
          if (!open) {
            setCancelDialogRunId(null);
            setCancelReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Mark Run as Failed / Cancelled
            </AlertDialogTitle>
            <AlertDialogDescription className="text-destructive font-medium">
              CRITICAL: Stock auto-reversal will occur. Please physically return any unused chemical stock to the warehouse floor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Failure / Cancellation</Label>
              <Textarea
                placeholder="e.g. Machine breakdown, Material shortage, etc."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!cancelReason || cancelProduction.isPending}
              onClick={() => {
                if (!cancelDialogRunId) return;
                cancelProduction.mutate(
                  {
                    data: {
                      productionRunId: cancelDialogRunId,
                      reason: cancelReason,
                    },
                  },
                  {
                    onSuccess: () => {
                      setCancelDialogRunId(null);
                      setCancelReason("");
                      toast.error("Production run cancelled.");
                    },
                  },
                );
              }}
            >
              {cancelProduction.isPending ? "Cancelling..." : "Confirm Failure"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Run Confirmation Dialog — lifted outside table to survive re-renders */}
      <AlertDialog
        open={!!deleteDialogRunId}
        onOpenChange={(open) => !open && setDeleteDialogRunId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-5 text-destructive" />
              Delete Production Run?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this production run and all its
              associated material usage records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteProductionRun.isPending}
              onClick={() => {
                if (!deleteDialogRunId) return;
                deleteProductionRun.mutate(
                  {
                    data: { productionRunId: deleteDialogRunId },
                  },
                  {
                    onSuccess: () => {
                      setDeleteDialogRunId(null);
                    },
                  },
                );
              }}
            >
              {deleteProductionRun.isPending ? "Deleting..." : "Delete Run"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
