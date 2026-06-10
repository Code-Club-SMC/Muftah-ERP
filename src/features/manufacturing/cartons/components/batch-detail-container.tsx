import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus, ShieldAlert, Lock, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cartonKeys } from "../api/carton.query-keys";
import { useBatchKpis, useIntegrityAlerts, useRunIntegrityCheck, useBatchAuditLog, useUpdateIntegrityAlert } from "../hooks/use-carton-mutations";
import { BatchKpiCards, CartonGrid, IntegrityAlertsWidget, AuditLogTimeline } from "../components";
import { GenericEmpty } from "@/components/custom/empty";
import {
  TopUpSheet,
  RemovePacksSheet,
  SetCountSheet,
  MergeSheet,
  RepackSheet,
  RetireSheet,
  QcHoldSheet,
  TransferSheet,
  BatchStatusSheet,
  AddCartonsSheet,
  AuditLogSheet,
} from "../sheets";
import type { CartonStatus } from "@/lib/cartons/carton.types";

type CartonRow = {
  id: string;
  sku: string | null;
  capacity: number;
  currentPacks: number;
  status: CartonStatus;
  zone: string | null;
  weightAmount?: number;
  weightUnit?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type SheetName =
  | "top-up"
  | "remove-packs"
  | "set-count"
  | "bulk-adjust"
  | "merge"
  | "repack"
  | "retire"
  | "qc-hold"
  | "release-hold"
  | "transfer"
  | "close-batch"
  | "reopen-batch"
  | "add-cartons"
  | "dispatch"
  | "return"
  | "stock-count"
  | "audit-log"
  | null;

export function BatchDetailContainer() {
  const params = useParams({ strict: false }) as Record<string, string>;
  const runId = params.runId;

  const { data: kpis, isLoading: kpisLoading } = useBatchKpis(runId);
  const { data: alerts } = useIntegrityAlerts();
  const runIntegrity = useRunIntegrityCheck();
  const updateAlert = useUpdateIntegrityAlert();

  const hasCartons = kpis ? kpis.totalCartons > 0 : false;
  const runStatus = kpis?.runStatus ?? "";
  const isBatchClosed = ["completed", "cancelled", "failed"].includes(runStatus);
  const canAddCartons = !["cancelled", "failed"].includes(runStatus);
  const canCloseBatch = !["completed", "cancelled", "failed"].includes(runStatus);
  const maxCartons = kpis?.shortfallCartons ?? null;

  const [activeSheet, setActiveSheet] = useState<SheetName>(null);
  const [selectedCarton, setSelectedCarton] = useState<CartonRow | null>(null);
  const [activeTab, setActiveTab] = useState("cartons");
  const [selectedStatus, setSelectedStatus] = useState<CartonStatus | "ALL">("ALL");

  const openSheet = useCallback((sheet: SheetName, carton?: CartonRow) => {
    setSelectedCarton(carton ?? null);
    setActiveSheet(sheet);
  }, []);

  const closeSheet = useCallback(() => {
    setActiveSheet(null);
  }, []);

  const c = selectedCarton;

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
                Batch Cartons
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Carton Management
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canCloseBatch && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold uppercase tracking-wide"
              onClick={() => openSheet("close-batch")}
            >
              <Lock className="size-3.5 mr-1.5" />
              Close Batch
            </Button>
          )}
          {isBatchClosed && (
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60 bg-muted px-2 py-1 rounded">
              {runStatus}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold uppercase tracking-wide"
            onClick={() => runIntegrity.mutate(runId)}
            disabled={runIntegrity.isPending}
          >
            <ShieldAlert className="size-3.5 mr-1.5" />
            {runIntegrity.isPending ? "Checking…" : "Integrity Check"}
          </Button>
          {canAddCartons && (
            <Button
              size="sm"
              className="h-8 text-xs font-bold uppercase tracking-wide"
              onClick={() => openSheet("add-cartons")}
            >
              <Plus className="size-3.5 mr-1.5" />
              Add Cartons
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-8 pb-24 space-y-8 max-w-[1600px] mx-auto">
          {!hasCartons && !kpisLoading ? (
            <div className="py-24">
              <GenericEmpty
                icon={Package}
                title="No Cartons Yet"
                description="This production run doesn't have any cartons. Add cartons to start tracking packs, dispatching, and managing inventory."
                ctaText={canAddCartons ? "Add Cartons to Batch" : undefined}
                onAddChange={canAddCartons ? () => openSheet("add-cartons") : undefined}
              />
            </div>
          ) : (
            <>
              {kpis && <BatchKpiCards kpis={kpis} selectedStatus={selectedStatus} onSelectStatus={setSelectedStatus} />}

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="cartons" className="text-xs font-bold uppercase tracking-wide">
                    Cartons
                  </TabsTrigger>
                  <TabsTrigger value="audit" className="text-xs font-bold uppercase tracking-wide">
                    Audit Log
                  </TabsTrigger>
                  <TabsTrigger value="integrity" className="text-xs font-bold uppercase tracking-wide">
                    Integrity
                    {alerts && alerts.length > 0 && (
                      <span className="ml-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full size-4 inline-flex items-center justify-center">
                        {alerts.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="cartons" className="mt-6">
                  <CartonsTab runId={runId} openSheet={openSheet} selectedStatus={selectedStatus} />
                </TabsContent>

                <TabsContent value="audit" className="mt-6">
                  <BatchAuditLogTab runId={runId} />
                </TabsContent>

                <TabsContent value="integrity" className="mt-6">
                  <IntegrityAlertsWidget
                    alerts={(alerts ?? []).map((a: any) => ({
                      id: a.id,
                      sku: a.sku,
                      batchId: a.batchId,
                      cartonSum: a.cartonSum,
                      ledgerTotal: a.ledgerTotal,
                      delta: a.delta,
                      status: a.status,
                      detectedAt: a.detectedAt,
                      resolution: a.resolution,
                    }))}
                    onAcknowledge={(id) => updateAlert.mutate({ alertId: id, status: "ACKNOWLEDGED" })}
                    onResolve={(id) => updateAlert.mutate({ alertId: id, status: "RESOLVED" })}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>

      {/* ── Sheets ─────────────────────────────────────────────────────── */}
      {c && (
        <>
          <TopUpSheet
            open={activeSheet === "top-up"}
            onOpenChange={(v) => v || closeSheet()}
            cartonId={c.id}
            batchId={runId}
            currentPacks={c.currentPacks}
            capacity={c.capacity}
            sku={c.sku}
          />
          <RemovePacksSheet
            open={activeSheet === "remove-packs"}
            onOpenChange={(v) => v || closeSheet()}
            cartonId={c.id}
            batchId={runId}
            currentPacks={c.currentPacks}
            capacity={c.capacity}
            sku={c.sku}
          />
          <SetCountSheet
            open={activeSheet === "set-count"}
            onOpenChange={(v) => v || closeSheet()}
            cartonId={c.id}
            batchId={runId}
            currentPacks={c.currentPacks}
            capacity={c.capacity}
            sku={c.sku}
          />
          <MergeSheet
            open={activeSheet === "merge"}
            onOpenChange={(v) => v || closeSheet()}
            batchId={runId}
            sourceCartonId={c.id}
            sourceSku={c.sku}
            sourcePacks={c.currentPacks}
          />
          <RepackSheet
            open={activeSheet === "repack"}
            onOpenChange={(v) => v || closeSheet()}
            cartonId={c.id}
            batchId={runId}
            currentCapacity={c.capacity}
            currentPacks={c.currentPacks}
          />
          <RetireSheet
            open={activeSheet === "retire"}
            onOpenChange={(v) => v || closeSheet()}
            cartonId={c.id}
            batchId={runId}
            currentPacks={c.currentPacks}
            sku={c.sku}
          />
          <QcHoldSheet
            mode="apply"
            open={activeSheet === "qc-hold"}
            onOpenChange={(v) => v || closeSheet()}
            cartonId={c.id}
            batchId={runId}
            sku={c.sku}
          />
          <QcHoldSheet
            mode="release"
            open={activeSheet === "release-hold"}
            onOpenChange={(v) => v || closeSheet()}
            cartonId={c.id}
            batchId={runId}
            sku={c.sku}
            preHoldStatus={c.status}
          />
          <TransferSheet
            open={activeSheet === "transfer"}
            onOpenChange={(v) => v || closeSheet()}
            batchId={runId}
            sourceCartonId={c.id}
            sourceSku={c.sku}
            sourcePacks={c.currentPacks}
          />
          <AuditLogSheet
            open={activeSheet === "audit-log"}
            onOpenChange={(v) => v || closeSheet()}
            cartonId={c.id}
            sku={c.sku}
          />
        </>
      )}

      <BatchStatusSheet
        mode="close"
        open={activeSheet === "close-batch"}
        onOpenChange={closeSheet}
        batchId={runId}
      />

      <AddCartonsSheet
        open={activeSheet === "add-cartons"}
        onOpenChange={closeSheet}
        batchId={runId}
        maxCartons={maxCartons}
        runStatus={runStatus}
      />
    </div>
  );
}

function CartonsTab({ runId, openSheet, selectedStatus }: { runId: string; openSheet: (sheet: SheetName, carton?: CartonRow) => void; selectedStatus: CartonStatus | "ALL" }) {
  const { data: cartons, isLoading, error } = useQuery({
    queryKey: cartonKeys.byBatch(runId),
    queryFn: () =>
      import("@/server-functions/manufacturing/cartons").then((m) =>
        m.getCartonsByBatchFn({ data: { productionRunId: runId } }),
      ),
  });

  if (error) {
    return (
      <div className="py-16">
        <GenericEmpty
          icon={ShieldAlert}
          title="Failed to load cartons"
          description={error.message || "An error occurred while fetching carton data."}
        />
      </div>
    );
  }

  const cartonRows: CartonRow[] = (cartons ?? [])
    .filter((c: any) => selectedStatus === "ALL" || c.status === selectedStatus)
    .map((c: any) => ({
      id: c.id,
      sku: c.sku,
      capacity: c.capacity,
      currentPacks: c.currentPacks,
      status: c.status,
      zone: c.zone,
      weightAmount: c.weightAmount,
      weightUnit: c.weightUnit,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

  return <CartonGrid data={cartonRows} isLoading={isLoading} onTopUp={(c) => openSheet("top-up", c)} onRemovePacks={(c) => openSheet("remove-packs", c)} onSetCount={(c) => openSheet("set-count", c)} onRepack={(c) => openSheet("repack", c)} onRetire={(c) => openSheet("retire", c)} onHold={(c) => openSheet("qc-hold", c)} onReleaseHold={(c) => openSheet("release-hold", c)} onTransfer={(c) => openSheet("transfer", c)} onViewAuditLog={(c) => openSheet("audit-log", c)} />;
}

function BatchAuditLogTab({ runId }: { runId: string }) {
  const { data } = useBatchAuditLog(runId, 1, 50);

  const entries = (data?.data ?? []).map((e: any) => ({
    id: e.id,
    type: e.type,
    packsBefore: e.packsBefore,
    delta: e.delta,
    packsAfter: e.packsAfter,
    reason: e.reason,
    performedBy: e.performedByUser?.name ?? e.performedBy,
    performedAt: e.performedAt,
    relatedCartonId: e.relatedCartonId,
  }));

  return <AuditLogTimeline entries={entries} />;
}