import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { useCreatePayment } from "@/hooks/sales/use-payments";
import { useWallets } from "@/hooks/finance/use-finance";
import { createPaymentSchema } from "@/db/zod_schemas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Loader2, Banknote, Building2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
};

export function RecordPaymentDialog({ open, onOpenChange, customerId }: Props) {
  const { mutateAsync: createPayment, isPending } = useCreatePayment();
  const { data: walletsData } = useWallets();
  const wallets = walletsData || [];

  const form = useForm({
    defaultValues: {
      customerId,
      amount: 0,
      method: "cash" as "cash" | "bank_transfer" | "expense_offset",
      reference: "",
      walletId: wallets[0]?.id || "",
      notes: "",
    },
    onSubmit: async ({ value }) => {
      if (value.amount <= 0) {
        toast.error("Amount must be greater than 0");
        return;
      }
      try {
        const payload = {
          ...value,
          walletId: value.method === "expense_offset" ? undefined : value.walletId,
        };
        const validated = createPaymentSchema.parse(payload);
        await createPayment(validated as any);
        toast.success("Payment recorded successfully");
        form.reset();
        onOpenChange(false);
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          toast.error("Validation error. Please check your inputs.");
        } else {
          toast.error(err.message || "Failed to record payment");
        }
      }
    },
  });

  useEffect(() => {
    if (open) {
      form.setFieldValue("customerId", customerId);
      if (wallets.length > 0 && !form.getFieldValue("walletId")) {
        form.setFieldValue("walletId", wallets[0].id);
      }
    }
  }, [open, customerId, wallets, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment received from this customer. This will update their ledger.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4 mt-2"
        >
          <form.Field name="amount">
            {(field) => (
              <Field>
                <FieldLabel>Amount (PKR)</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={field.state.value || ""}
                  onChange={(e) => field.handleChange(Number(e.target.value))}
                  autoComplete="off"
                  aria-label="Payment amount in PKR"
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="method">
            {(field) => (
              <Field>
                <FieldLabel>Payment Method</FieldLabel>
                <Select
                  value={field.state.value}
                  onValueChange={(val: any) => field.handleChange(val)}
                >
                  <SelectTrigger aria-label="Select payment method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="expense_offset">Expense Offset</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Subscribe selector={(s) => s.values.method}>
            {(method) => (
              method !== "expense_offset" && (
                <form.Field name="walletId">
                  {(field) => (
                    <Field>
                      <FieldLabel>Deposit Account</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={field.handleChange}
                      >
                        <SelectTrigger aria-label="Select deposit account">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {wallets.map((w: any) => (
                            <SelectItem key={w.id} value={w.id}>
                              <span className="flex items-center gap-2">
                                {w.type === "bank" ? (
                                  <Building2 className="size-3.5 text-blue-500" aria-hidden="true" />
                                ) : (
                                  <Banknote className="size-3.5 text-emerald-500" aria-hidden="true" />
                                )}
                                {w.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
              )
            )}
          </form.Subscribe>

          <form.Field name="reference">
            {(field) => (
              <Field>
                <FieldLabel>Reference (Optional)</FieldLabel>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g. Cheque No / Tx ID"
                />
              </Field>
            )}
          </form.Field>

          <form.Field name="notes">
            {(field) => (
              <Field>
                <FieldLabel>Notes (Optional)</FieldLabel>
                <Textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Add any extra details here…"
                  className="resize-none h-20"
                  aria-label="Payment notes"
                />
              </Field>
            )}
          </form.Field>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
