import { AlertCircle, ArrowRight, Calendar, CheckCircle2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Field, FieldError, FieldLabel, FieldDescription } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/custom/date-picker";
import { PKR, Section } from "./utils";
import { z } from "zod";

type SettlementSectionProps = {
    form: any;
    totalAmount: number;
    expenses: number;
    totalPayable: number;
    cashPaid: number;
    totalCredit: number;
    cashExceedsTotal: boolean;
    isFullyPaid: boolean;
    handleFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
};

export const SettlementSection = ({
    form,
    totalAmount,
    expenses,
    totalPayable,
    cashPaid,
    totalCredit,
    cashExceedsTotal,
    isFullyPaid,
    handleFocus,
}: SettlementSectionProps) => (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Expenses & Notes */}
        <div className="lg:col-span-2">
            <Section icon={CreditCard} title="Expenses & Notes" step={4}>
                <div className="space-y-4">
                    <form.Field
                        name="expenses"
                        validators={{
                            onChange: z.number().min(0, "Invalid amount"),
                            onSubmit: z.number().min(0, "Invalid amount"),
                        }}
                    >
                        {(field: any) => (
                            <Field>
                                <FieldLabel>Expense Amount</FieldLabel>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        className="pl-7"
                                        onFocus={handleFocus}
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value === "" ? 0 : Number(e.target.value))}
                                        placeholder="0"
                                        aria-label="Expense amount"
                                        autoComplete="off"
                                    />
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold pointer-events-none">₨</span>
                                </div>
                                <FieldDescription>Shipping, loading charges, etc.</FieldDescription>
                            </Field>
                        )}
                    </form.Field>

                    <form.Field name="expensesDescription">
                        {(field: any) => (
                            <Field>
                                <FieldLabel>
                                    Expense Details
                                    <span className="ml-1 text-[10px] text-muted-foreground font-normal">(optional)</span>
                                </FieldLabel>
                                <Textarea
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    rows={2}
                                    placeholder="e.g. Loading charges, freight"
                                    className="resize-none"
                                    aria-label="Expense details"
                                />
                            </Field>
                        )}
                    </form.Field>

                    <form.Field name="remarks">
                        {(field: any) => (
                            <Field>
                                <FieldLabel>
                                    Remarks
                                    <span className="ml-1 text-[10px] text-muted-foreground font-normal">(optional)</span>
                                </FieldLabel>
                                <Textarea
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    rows={2}
                                    placeholder="Any special instructions or notes…"
                                    className="resize-none"
                                    aria-label="Invoice remarks"
                                />
                            </Field>
                        )}
                    </form.Field>
                </div>
            </Section>
        </div>

        {/* Settlement */}
        <div className="lg:col-span-3">
            <Section icon={CreditCard} title="Settlement" subtitle="How is this invoice being paid?" step={5}>
                <div className="space-y-4">

                    {/* Breakdown */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Items Total</span>
                            <span className="font-semibold tabular-nums">{PKR(totalAmount)}</span>
                        </div>
                        {expenses > 0 && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <ArrowRight className="size-3" /> + Expenses
                                </span>
                                <span className="font-semibold tabular-nums text-amber-600">{PKR(expenses)}</span>
                            </div>
                        )}
                        <Separator />
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-base">Total Payable</span>
                            <span className="font-extrabold text-lg text-primary tabular-nums">{PKR(totalPayable)}</span>
                        </div>
                    </div>

                    {/* Cash received */}
                    <form.Field
                        name="cash"
                        validators={{
                            onChange: z.number().min(0, "Invalid amount"),
                            onSubmit: z.number().min(0, "Invalid amount"),
                        }}
                    >
                        {(field: any) => (
                            <div className="space-y-2">
                                <Label className="text-sm font-bold flex items-center gap-1.5">
                                    Cash Received <span className="text-destructive">*</span>
                                </Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        className={cn(
                                            "h-12 text-xl font-black tabular-nums pl-9",
                                            cashExceedsTotal && "border-destructive focus-visible:ring-destructive",
                                        )}
                                        onFocus={handleFocus}
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(Number(e.target.value))}
                                        aria-label="Cash received amount"
                                        autoComplete="off"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-bold pointer-events-none">₨</span>
                                </div>
                                {cashExceedsTotal && (
                                    <p className="text-xs text-destructive flex items-center gap-1.5 bg-destructive/10 px-3 py-2 rounded-md">
                                        <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                                        Cash cannot exceed total payable of {PKR(totalPayable)}
                                    </p>
                                )}
                                <FieldError errors={field.state.meta.errors} />
                            </div>
                        )}
                    </form.Field>

                    {/* Quick-fill */}
                    {totalPayable > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400"
                                onClick={() => form.setFieldValue("cash", totalPayable)}
                            >
                                <CheckCircle2 className="size-3.5" aria-hidden="true" /> Paid in Full
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-400"
                                onClick={() => form.setFieldValue("cash", 0)}
                            >
                                <CreditCard className="size-3.5" aria-hidden="true" /> Full Credit
                            </Button>
                        </div>
                    )}

                    {/* Credit indicator */}
                    <div className={cn(
                        "flex justify-between items-center p-3.5 rounded-xl text-sm font-bold border",
                        totalCredit > 0
                            ? "bg-destructive/8 text-destructive border-destructive/20"
                            : isFullyPaid
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-muted/30 text-muted-foreground border-transparent",
                    )}>
                        <span className="flex items-center gap-1.5">
                            {totalCredit > 0 ? (
                                <><AlertCircle className="size-4" /> Credit Remaining</>
                            ) : isFullyPaid ? (
                                <><CheckCircle2 className="size-4" /> Fully Paid</>
                            ) : "—"}
                        </span>
                        <span className="tabular-nums text-base">{PKR(totalCredit)}</span>
                    </div>

                    {/* Credit due date */}
                    {totalCredit > 0 && (
                        <form.Field name="creditReturnDate">
                            {(field: any) => (
                                <Field>
                                    <FieldLabel className="flex items-center gap-1.5 text-destructive">
                                        <Calendar className="size-3.5" />
                                        Credit Due Date <span className="text-destructive">*</span>
                                    </FieldLabel>
                                    <DatePicker
                                        date={field.state.value ? new Date(field.state.value) : undefined}
                                        onChange={(d) => {
                                            if (!d) { field.handleChange(""); return; }
                                            const year = d.getFullYear();
                                            const month = String(d.getMonth() + 1).padStart(2, "0");
                                            const day = String(d.getDate()).padStart(2, "0");
                                            field.handleChange(`${year}-${month}-${day}`);
                                        }}
                                        placeholder="Select due date"
                                        className={cn(
                                            "w-full",
                                            !field.state.value && field.state.meta.isTouched ? "border-destructive" : "",
                                        )}
                                    />
                                    <FieldDescription>
                                        When the customer is expected to repay {PKR(totalCredit)}.
                                    </FieldDescription>
                                </Field>
                            )}
                        </form.Field>
                    )}
                </div>
            </Section>
        </div>
    </div>
);
