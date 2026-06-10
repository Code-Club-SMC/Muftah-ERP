import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useState, useCallback } from "react";
import { z } from "zod";
import { ArrowLeft, Boxes, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GenericLoader } from "@/components/custom/generic-loader";
import { CartonGrid, BatchKpiCards } from "@/features/manufacturing/cartons/components";
import { useRecipeCartons, useRecipeKpis } from "@/features/manufacturing/cartons/hooks/use-carton-mutations";
import {
  TopUpSheet,
  RemovePacksSheet,
  SetCountSheet,
  RepackSheet,
  RetireSheet,
  QcHoldSheet,
  TransferSheet,
  AuditLogSheet,
  AddCartonsToRecipeSheet,
} from "@/features/manufacturing/cartons/sheets";
import type { CartonStatus } from "@/lib/cartons/carton.types";
import { type CartonRow } from "@/features/manufacturing/cartons/components/carton-grid";

export const Route = createFileRoute(
  "/_protected/inventory/factory-floor/cartons/$recipeId"
)({
  validateSearch: (search) =>
    z.object({
      page: z.coerce.number().int().min(1).default(1),
    }).parse(search),
  component: RecipeCartonRoute,
});


type SheetName =
  | "top-up"
  | "remove-packs"
  | "set-count"
  | "repack"
  | "retire"
  | "qc-hold"
  | "release-hold"
  | "transfer"
  | "audit-log"
  | "add-cartons"
  | null;

function RecipeCartonRoute() {
  const { recipeId } = Route.useParams();
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();

  const [selectedStatus, setSelectedStatus] = useState<CartonStatus | "ALL">("ALL");

  const handleSelectStatus = useCallback((status: CartonStatus | "ALL") => {
    setSelectedStatus(status);
    navigate({ search: (prev) => ({ ...prev, page: 1 }) });
  }, [navigate]);

  const { data: response, isLoading, error, refetch } = useRecipeCartons(recipeId, page, 100, undefined, selectedStatus);
  const { data: kpis } = useRecipeKpis(recipeId);
  const cartons = (response?.data || []).map(c => ({
    ...c,
    status: c.status as CartonStatus
  })) as CartonRow[];
  const meta = response?.meta;

  const [activeSheet, setActiveSheet] = useState<SheetName>(null);
  const [selectedCarton, setSelectedCarton] = useState<CartonRow | null>(null);

  const handlePageChange = (newPage: number) => {
    navigate({ search: (prev) => ({ ...prev, page: newPage }) });
  };

  const openSheet = useCallback((sheet: SheetName, carton?: CartonRow) => {
    setSelectedCarton(carton ?? null);
    setActiveSheet(sheet);
  }, []);

  const closeSheet = useCallback(() => {
    setActiveSheet(null);
  }, []);

  const c = selectedCarton;

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="flex flex-col min-h-full p-8">
        <header className="border-b pb-8 mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="icon" asChild className="-ml-2">
              <Link to="/inventory/factory-floor">
                <ArrowLeft className="size-5 text-muted-foreground" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Boxes className="size-5 text-primary" />
              <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">
                Inventory / Cartons
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-3xl uppercase tracking-tighter">
                Carton Management
              </h1>
              <p className="mt-2 text-muted-foreground">
                Manage individual cartons for this recipe across all production batches.
              </p>
            </div>
            <Button
              size="sm"
              className="h-9 text-xs font-bold uppercase tracking-wide"
              onClick={() => openSheet("add-cartons")}
            >
              <Plus className="size-3.5 mr-1.5" />
              Add Cartons
            </Button>
          </div>
        </header>

        {kpis && (
          <BatchKpiCards
            kpis={kpis}
            selectedStatus={selectedStatus}
            onSelectStatus={handleSelectStatus}
          />
        )}

        <Suspense fallback={<GenericLoader title="Loading cartons..." />}>
          <CartonGrid
            data={cartons}
            isLoading={isLoading}
            page={page}
            totalPages={meta?.totalPages}
            totalItems={meta?.total}
            onPageChange={handlePageChange}
            error={error as any}
            onRetry={() => refetch()}
            onTopUp={(c) => openSheet("top-up", c as any)}
            onRemovePacks={(c) => openSheet("remove-packs", c as any)}
            onSetCount={(c) => openSheet("set-count", c as any)}
            onRepack={(c) => openSheet("repack", c as any)}
            onRetire={(c) => openSheet("retire", c as any)}
            onHold={(c) => openSheet("qc-hold", c as any)}
            onReleaseHold={(c) => openSheet("release-hold", c as any)}
            onTransfer={(c) => openSheet("transfer", c as any)}
            onViewAuditLog={(c) => openSheet("audit-log", c as any)}
          />
        </Suspense>

        {/* Add Cartons Sheet */}
        <AddCartonsToRecipeSheet
          open={activeSheet === "add-cartons"}
          onOpenChange={(v) => v || closeSheet()}
          recipeId={recipeId}
        />

        {/* Sheets */}
        {c && (
          <>
            <TopUpSheet
              open={activeSheet === "top-up"}
              onOpenChange={(v) => v || closeSheet()}
              cartonId={c.id}
              batchId={""} // BatchId is optional in some operations or can be empty for global view
              currentPacks={c.currentPacks}
              capacity={c.capacity}
              sku={c.sku}
            />
            <RemovePacksSheet
              open={activeSheet === "remove-packs"}
              onOpenChange={(v) => v || closeSheet()}
              cartonId={c.id}
              batchId={""}
              currentPacks={c.currentPacks}
              capacity={c.capacity}
              sku={c.sku}
            />
            <SetCountSheet
              open={activeSheet === "set-count"}
              onOpenChange={(v) => v || closeSheet()}
              cartonId={c.id}
              batchId={""}
              currentPacks={c.currentPacks}
              capacity={c.capacity}
              sku={c.sku}
            />
            <RepackSheet
              open={activeSheet === "repack"}
              onOpenChange={(v) => v || closeSheet()}
              cartonId={c.id}
              batchId={""}
              currentCapacity={c.capacity}
              currentPacks={c.currentPacks}
            />
            <RetireSheet
              open={activeSheet === "retire"}
              onOpenChange={(v) => v || closeSheet()}
              cartonId={c.id}
              batchId={""}
              currentPacks={c.currentPacks}
              sku={c.sku}
            />
            <QcHoldSheet
              mode="apply"
              open={activeSheet === "qc-hold"}
              onOpenChange={(v) => v || closeSheet()}
              cartonId={c.id}
              batchId={""}
              sku={c.sku}
            />
            <QcHoldSheet
              mode="release"
              open={activeSheet === "release-hold"}
              onOpenChange={(v) => v || closeSheet()}
              cartonId={c.id}
              batchId={""}
              sku={c.sku}
              preHoldStatus={c.status}
            />
            <TransferSheet
              open={activeSheet === "transfer"}
              onOpenChange={(v) => v || closeSheet()}
              batchId={""}
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
      </div>
    </main>
  );
}
