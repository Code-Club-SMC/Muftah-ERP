// -nocheck
import React, { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Layers, Users, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { effectiveCPP } from "@/server-functions/sales/invoices-fn";

// ── Types ────────────────────────────────────────────────────────────────────

export type ItemFormValue = {
    pack: string;
    recipeId: string;
    unitType: "carton" | "units";
    numberOfCartons: number;
    numberOfUnits: number;
    discountCartons: number;
    packsPerCarton: number;
    hsnCode: string;
    perCartonPrice: number;
    retailPrice: number;
};

export type StockItem = {
    id: string;
    recipeId: string;
    recipe?: {
        name?: string;
        hsnCode?: string;
        containersPerCarton?: number | string | null | undefined;
        estimatedCostPerContainer?: number | string | null | undefined;
    };
    quantityCartons?: number;
    quantityContainers?: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export const PKR = (v: number) =>
    `PKR ${v.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const safeEffectiveCPP = (recipeDefault: number): number =>
    Math.max(1, recipeDefault || 1);

export function lineAmount(item: ItemFormValue, recipeContainersPerCarton: number): number {
    const eCPP = safeEffectiveCPP(recipeContainersPerCarton);
    if (item.unitType === "carton") {
        return (item.numberOfCartons || 0) * (item.perCartonPrice || 0);
    }
    return (item.numberOfUnits || 0) * ((item.perCartonPrice || 0) / eCPP);
}

export function findStock(availableStock: any[], recipeId: string) {
    return availableStock.find((s) => s.recipeId === recipeId) ?? null;
}

// ── UI primitives ───────────────────────────────────────────────────────────

export const Section = ({
    icon: Icon,
    title,
    subtitle,
    children,
    className,
    step,
    action,
}: {
    icon: React.ElementType;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    className?: string;
    step?: number;
    action?: React.ReactNode;
}) => (
    <div className={cn("rounded-2xl border bg-card shadow-sm overflow-hidden", className)}>
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b bg-muted/20">
            <div className="flex items-center gap-3">
                {step !== undefined && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground leading-none">
                        {step}
                    </span>
                )}
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-3.5 text-primary" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold leading-none tracking-tight">{title}</h3>
                    {subtitle && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">{subtitle}</p>
                    )}
                </div>
            </div>
            {action && <div>{action}</div>}
        </div>
        <div className="p-5">{children}</div>
    </div>
);

export const ModeToggle = ({
    value,
    onChange,
}: {
    value: "existing" | "new";
    onChange: (v: "existing" | "new") => void;
}) => (
    <div className="flex gap-1 p-1 bg-muted/50 rounded-xl w-fit border mb-5">
        {( ["existing", "new"] as const).map((mode) => (
            <button
                key={mode}
                type="button"
                onClick={() => onChange(mode)}
                className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
                    value === mode
                        ? "bg-background shadow-sm text-foreground border"
                        : "text-muted-foreground hover:text-foreground",
                )}
            >
                {mode === "existing" ? (
                    <><Users className="size-3.5" /> Existing</>
                ) : (
                    <><UserPlus className="size-3.5" /> New Customer</>
                )}
            </button>
        ))}
    </div>
);

export const CartonCompositionBadge = ({
    recipeDefault,
    effectiveValue,
}: {
    recipeDefault: number;
    effectiveValue: number;
}) => (
    <TooltipProvider>
        <Tooltip>
            <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-[9px] px-1.5 h-5 cursor-help gap-1">
                    <Layers className="size-2.5" />
                    {effectiveValue === recipeDefault
                        ? `${recipeDefault} (default)`
                        : `${effectiveValue} / ${recipeDefault} default`}
                </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
                Recipe default: {recipeDefault} packs/carton
                {effectiveValue !== recipeDefault && ` · Override: ${effectiveValue}`}
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);

// ── DirtyStateNotifier ───────────────────────────────────────────────────────
const DirtyEffect = ({ dirty, onDirtyChange }: { dirty: boolean; onDirtyChange: (isDirty: boolean) => void; }) => {
    useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
    return null;
};

export const DirtyStateNotifier = ({ form, onDirtyChange }: { form: any; onDirtyChange: (isDirty: boolean) => void; }) => (
    <form.Subscribe selector={(s: any) => s.isDirty}>
        {(dirty: boolean) => <DirtyEffect dirty={dirty} onDirtyChange={onDirtyChange} />}
    </form.Subscribe>
);

export const blankItem = (): ItemFormValue => ({
    pack: "",
    recipeId: "",
    unitType: "carton",
    numberOfCartons: 1,
    numberOfUnits: 0,
    discountCartons: 0,
    packsPerCarton: 0,
    hsnCode: "",
    perCartonPrice: 0,
    retailPrice: 0,
});

export default {} as any;
