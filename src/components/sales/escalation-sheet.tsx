/**
 * Escalation Sheet Component for Credit Recovery
 * Professional form with Zod validation, similar to add-warehouse-form pattern
 */

import { useForm } from "@tanstack/react-form";
import { AlertTriangle, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatPKR } from "@/lib/currency-format";
import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// Zod Schema for Escalation Form
// ═══════════════════════════════════════════════════════════════════════════

export const escalationSchema = z.object({
  escalationLevel: z.number().int().min(0).max(5, "Maximum escalation level is 5"),
  recoveryStatus: z.enum(["pending", "in_progress", "partially_paid", "overdue", "defaulted"]),
  reason: z.string().min(5, "Reason must be at least 5 characters").max(500, "Reason must be less than 500 characters"),
  nextFollowUpDate: z.string(),
  notes: z.string().max(1000, "Notes must be less than 1000 characters"),
});

export type EscalationFormData = z.infer<typeof escalationSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Props Interface
// ═══════════════════════════════════════════════════════════════════════════

interface EscalationSheetProps {
  slip: {
    id: string;
    slipNumber: string;
    amountDue: number;
    escalationLevel: number;
    recoveryStatus: string | null;
    nextFollowUpDate: Date | null;
    customerName: string;
    customerMobile?: string | null;
    invoiceDate: Date;
    creditReturnDate: Date | null;
  };
  onEscalate: (data: EscalationFormData) => Promise<void>;
  onDeEscalate: () => Promise<void>;
  onUpdateStatus: (status: string) => Promise<void>;
  onSuccess: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Escalation Level Badge
// ═══════════════════════════════════════════════════════════════════════════

function EscalationBadge({ level }: { level: number }) {
  const colors = {
    0: "bg-gray-100 text-gray-700 border-gray-200",
    1: "bg-yellow-50 text-yellow-700 border-yellow-200",
    2: "bg-orange-50 text-orange-700 border-orange-200",
    3: "bg-red-50 text-red-700 border-red-200",
    4: "bg-red-100 text-red-800 border-red-300",
    5: "bg-red-200 text-red-900 border-red-400",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-semibold uppercase",
        colors[level as keyof typeof colors] || colors[5],
      )}
    >
      <AlertTriangle className="size-3 mr-1" />
      Level {level}
    </Badge>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Status Badge
// ═══════════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;

  const configs: Record<string, { label: string; class: string }> = {
    pending: { label: "Pending", class: "bg-amber-50 text-amber-700 border-amber-200" },
    in_progress: { label: "In Progress", class: "bg-blue-50 text-blue-700 border-blue-200" },
    partially_paid: { label: "Partially Paid", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    overdue: { label: "Overdue", class: "bg-red-50 text-red-700 border-red-200" },
    defaulted: { label: "Defaulted", class: "bg-gray-100 text-gray-700 border-gray-200" },
  };

  const config = configs[status] || configs.defaulted;

  return (
    <Badge variant="outline" className={cn("text-[10px]", config.class)}>
      {config.label}
    </Badge>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export function EscalationSheet({
  slip,
  onEscalate,
  onDeEscalate,
  onUpdateStatus,
  onSuccess,
}: EscalationSheetProps) {
  const form = useForm({
    defaultValues: {
      escalationLevel: slip.escalationLevel,
      recoveryStatus: (slip.recoveryStatus || "pending") as "pending" | "in_progress" | "partially_paid" | "overdue" | "defaulted",
      reason: "",
      nextFollowUpDate: slip.nextFollowUpDate
        ? new Date(slip.nextFollowUpDate).toISOString().split("T")[0]
        : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      notes: "",
    },
    validators: {
      onSubmit: escalationSchema,
    },
    onSubmit: async ({ value }) => {
      await onEscalate(value);
      toast.success("Escalation updated successfully");
      onSuccess();
    },
  });

  const handleDeEscalate = async () => {
    try {
      await onDeEscalate();
      toast.success("De-escalated successfully");
      onSuccess();
    } catch (err) {
      toast.error("Failed to de-escalate");
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await onUpdateStatus(status);
      toast.success(`Status updated to ${status}`);
      onSuccess();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      {/* Slip Summary Header */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">{slip.customerName}</h3>
            <p className="text-xs text-muted-foreground">
              Slip #{slip.slipNumber} · {slip.customerMobile || "No mobile"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-red-600 tabular-nums">
              {formatPKR(slip.amountDue, false)}
            </p>
            <p className="text-[10px] text-muted-foreground">Amount Due</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <EscalationBadge level={slip.escalationLevel} />
          <StatusBadge status={slip.recoveryStatus} />
          {slip.creditReturnDate && (
            <Badge variant="outline" className="text-[10px]">
              Due: {new Date(slip.creditReturnDate).toLocaleDateString()}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Invoice Date:</span>{" "}
            <span className="font-medium">{new Date(slip.invoiceDate).toLocaleDateString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Days Overdue:</span>{" "}
            <span className={cn(
              "font-medium",
              slip.creditReturnDate && new Date() > new Date(slip.creditReturnDate)
                ? "text-red-600"
                : "text-green-600",
            )}>
              {slip.creditReturnDate
                ? Math.max(0, Math.floor((new Date().getTime() - new Date(slip.creditReturnDate).getTime()) / (1000 * 60 * 60 * 24)))
                : 0} days
            </span>
          </div>
        </div>
      </div>

      {/* Escalation Form */}
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <FieldGroup>
          {/* Escalation Level */}
          <form.Field name="escalationLevel">
            {(field) => (
              <Field>
                <FieldLabel>Escalation Level (0-5)</FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={5}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                    className="w-24"
                  />
                  <EscalationBadge level={field.state.value} />
                </div>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          {/* Recovery Status */}
          <form.Field name="recoveryStatus">
            {(field) => (
              <Field>
                <FieldLabel>Recovery Status</FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={(value: "pending" | "in_progress" | "partially_paid" | "overdue" | "defaulted") => {
                    field.handleChange(value);
                    handleStatusChange(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="partially_paid">Partially Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="defaulted">Defaulted</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          {/* Reason */}
          <form.Field name="reason">
            {(field) => (
              <Field>
                <FieldLabel>Escalation Reason *</FieldLabel>
                <Textarea
                  placeholder="e.g. Customer promised payment 3 times but failed to deliver. Management approval needed for legal action."
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  rows={3}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          {/* Next Follow-up Date */}
          <form.Field name="nextFollowUpDate">
            {(field) => (
              <Field>
                <FieldLabel>Next Follow-up Date</FieldLabel>
                <Input
                  type="date"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          {/* Additional Notes */}
          <form.Field name="notes">
            {(field) => (
              <Field>
                <FieldLabel>Additional Notes</FieldLabel>
                <Textarea
                  placeholder="Any other relevant information about this escalation..."
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  rows={2}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={form.state.isSubmitting}
              className="flex-1"
            >
              {form.state.isSubmitting ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <TrendingUp className="size-4 mr-2" />
              )}
              Update Escalation
            </Button>

            {slip.escalationLevel > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDeEscalate}
                disabled={form.state.isSubmitting}
              >
                <TrendingDown className="size-4 mr-2" />
                De-escalate
              </Button>
            )}
          </div>
        </FieldGroup>
      </form>
    </div>
  );
}
