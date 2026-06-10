import { useForm } from "@tanstack/react-form";
import { format, parseISO } from "date-fns";
import { useCreateEmployee } from "@/hooks/hr/use-create-employee";
import { createEmployeeSchema } from "@/lib/validators/hr-validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";
import type { AnyFieldApi } from "@tanstack/react-form";
import { Loader2, UserPlus, Briefcase, Wallet, Plus } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/custom/date-picker";
import {
  STANDARD_ALLOWANCES,
  type AllowanceConfig,
} from "@/lib/types/hr-types";
import {
  AllowanceCard,
  DEDUCTION_OCCASIONS,
} from "@/components/hr/employees/allowance-card";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

// ── Rest days config ────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

interface Props {
  onSuccess: () => void;
}

const newCustomAllowance = (): AllowanceConfig => ({
  id: `custom_${Date.now()}`,
  name: "New Allowance",
  amount: 0,
  deductions: {
    absent: false,
    annualLeave: false,
    sickLeave: false,
    specialLeave: false,
    lateArrival: false,
    earlyLeaving: false,
  },
});

// ── Component ────────────────────────────────────────────────────────────────

export const AddEmployeeForm = ({ onSuccess }: Props) => {
  const mutate = useCreateEmployee();

  const form = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      employeeCode: "",
      designation: "",
      department: "",
      joiningDate: "",
      status: "active" as "active" | "on_leave" | "terminated" | "resigned",
      employmentType: "full_time" as
        | "full_time"
        | "part_time"
        | "contract"
        | "intern",
      phone: "",
      cnic: "",
      address: "",
      bankName: "",
      bankAccountNumber: "",
      standardDutyHours: 8,
      basicSalary: "",
      isOrderBooker: false,
      isSalesman: false,
      /**
       * Days of the week that are rest days (non-working).
       * 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat.
       * Default: [0] → Sunday off only.
       * For Sat+Sun: [0, 6].
       */
      restDays: [0] as number[],
      // Deep clone so mutations don't affect the STANDARD_ALLOWANCES constant
      allowanceConfig: JSON.parse(
        JSON.stringify(STANDARD_ALLOWANCES),
      ) as AllowanceConfig[],
    },
    validators: {
      onSubmit: createEmployeeSchema,
    },
    onSubmit: async ({ value }) => {
      await mutate.mutateAsync(
        { data: value },
        {
          onSuccess: () => {
            onSuccess();
            // form.reset();
          },
          onError: () => {
            toast.error("Failed to register employee. Please try again.");
          },
        },
      );
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-8"
    >
      <FieldGroup>
        {/* ── SECTION: Identity & Personal ───────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <UserPlus className="size-4" />
            <span className="text-sm uppercase tracking-wider">
              Identity & Personal
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="firstName">
              {(field: AnyFieldApi) => (
                <Field>
                  <FieldLabel>First Name</FieldLabel>
                  <Input
                    placeholder="e.g. John"
                    value={field.state.value as string}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="lastName">
              {(field: AnyFieldApi) => (
                <Field>
                  <FieldLabel>Last Name</FieldLabel>
                  <Input
                    placeholder="e.g. Doe"
                    value={field.state.value as string}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="employeeCode">
              {(field: AnyFieldApi) => (
                <Field>
                  <FieldLabel>Employee Code</FieldLabel>
                  <Input
                    placeholder="e.g. EMP-11005"
                    value={field.state.value as string}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="cnic">
              {(field: AnyFieldApi) => (
                <Field>
                  <FieldLabel>CNIC / ID Number</FieldLabel>
                  <Input
                    placeholder="42101-XXXXXXX-X"
                    value={field.state.value as string}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="phone">
              {(field: AnyFieldApi) => (
                <Field>
                  <FieldLabel>Phone Number</FieldLabel>
                  <Input
                    placeholder="+92 XXX XXXXXXX"
                    value={field.state.value as string}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="joiningDate">
              {(field: AnyFieldApi) => (
                <Field>
                  <FieldLabel>Joining Date</FieldLabel>
                  <DatePicker
                    date={
                      field.state.value
                        ? parseISO(field.state.value as string)
                        : undefined
                    }
                    onChange={(date) =>
                      field.handleChange(date ? format(date, "yyyy-MM-dd") : "")
                    }
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </div>

          <form.Field name="address">
            {(field: AnyFieldApi) => (
              <Field>
                <FieldLabel>Full Address</FieldLabel>
                <Textarea
                  placeholder="House #, Street, Area, City"
                  value={field.state.value as string}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="min-h-[80px]"
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="bankName">
              {(field: AnyFieldApi) => (
                <Field>
                  <FieldLabel>Bank Name / Wallet (Optional)</FieldLabel>
                  <Input
                    placeholder="e.g. HBL, JazzCash, Meezan Bank"
                    value={(field.state.value as string) || ""}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="bankAccountNumber">
              {(field: AnyFieldApi) => (
                <Field>
                  <FieldLabel>Account Number (Optional)</FieldLabel>
                  <Input
                    placeholder="IBAN or Mobile Number"
                    value={(field.state.value as string) || ""}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </div>
        </div>

        <Separator className="opacity-50" />

        {/* ── SECTION: Job Role & Status ──────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Briefcase className="size-4" />
            <span className="text-sm uppercase tracking-wider">
              Job Role & Status
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="designation">
              {(field: AnyFieldApi) => (
                <Field>
                  <FieldLabel>Designation</FieldLabel>
                  <Input
                    placeholder="e.g. Production Manager"
                    value={field.state.value as string}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="department">
              {(field: AnyFieldApi) => (
                <Field>
                  <FieldLabel>Department</FieldLabel>
                  <Input
                    placeholder="e.g. Finance"
                    value={field.state.value as string}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="employmentType">
              {(field: AnyFieldApi) => (
                <Field>
                  <FieldLabel>Employment Type</FieldLabel>
                  <Select
                    value={field.state.value as string}
                    onValueChange={(val) => field.handleChange(val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full Time</SelectItem>
                      <SelectItem value="part_time">Part Time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="intern">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
            <form.Field name="standardDutyHours">
              {(field: AnyFieldApi) => (
                <Field>
                  <FieldLabel>Daily Duty Hours</FieldLabel>
                  <Input
                    type="number"
                    placeholder="e.g. 8"
                    value={field.state.value as number}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </div>

          {/* ── Rest Days Picker ────────────────────────────────────────── */}
          <form.Field name="restDays">
            {(field: AnyFieldApi) => {
              const currentRestDays = field.state.value as number[];

              const toggleDay = (dayValue: number) => {
                const isRest = currentRestDays.includes(dayValue);
                const next = isRest
                  ? currentRestDays.filter((d) => d !== dayValue)
                  : [...currentRestDays, dayValue].sort((a, b) => a - b);
                field.handleChange(next);
              };

              // Summary label
              const restLabels = DAYS_OF_WEEK.filter((d) =>
                currentRestDays.includes(d.value),
              ).map((d) => d.label);

              const summaryText =
                restLabels.length === 0
                  ? "No rest days — employee works every day of the week."
                  : restLabels.length === 7
                    ? "All days selected — employee has no working days."
                    : `Off on: ${restLabels.join(", ")}`;

              return (
                <Field>
                  <FieldLabel className="flex items-center justify-between">
                    <span>Weekly Rest Days</span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      Highlighted = off day
                    </span>
                  </FieldLabel>

                  {/* Day toggle row */}
                  <div className="flex gap-1.5">
                    {DAYS_OF_WEEK.map((day) => {
                      const isRest = currentRestDays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          className={cn(
                            "flex-1 h-9 rounded-lg text-[12px] font-semibold border transition-all duration-150",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                            isRest
                              ? "bg-rose-50 border-rose-200 text-rose-700  dark:bg-rose-950/30 dark:border-rose-800/60 dark:text-rose-400"
                              : "bg-background border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                          )}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Live summary */}
                  <p
                    className={cn(
                      "text-[11.5px] font-medium mt-1 transition-colors",
                      restLabels.length === 0
                        ? "text-muted-foreground/60"
                        : restLabels.length === 7
                          ? "text-destructive"
                          : "text-muted-foreground",
                    )}
                  >
                    {summaryText}
                  </p>

                  {/* Deduction note */}
                  <p className="text-[11px] text-muted-foreground/50 leading-relaxed mt-0.5">
                    Rest days are excluded from Total Job Days, per-day salary
                    rates, and unmarked-day alarms in payroll.
                  </p>

                  <FieldError errors={field.state.meta.errors} />
                </Field>
              );
            }}
          </form.Field>

          {/* ── Sales Role Toggles ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <form.Field name="isSalesman">
              {(field: AnyFieldApi) => (
                <label
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 select-none",
                    field.state.value
                      ? "bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/60"
                      : "bg-background border-border/60 hover:bg-muted/30",
                  )}
                >
                  <Checkbox
                    checked={field.state.value}
                    onCheckedChange={(c) => field.handleChange(!!c)}
                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <div className="space-y-0.5">
                    <p className={cn("text-[13px] font-medium", field.state.value ? "text-blue-700 dark:text-blue-400" : "text-foreground")}>
                      Is this employee a Salesman?
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      Creates a linked salesman record. Excluded from attendance.
                    </p>
                  </div>
                </label>
              )}
            </form.Field>

            <form.Field name="isOrderBooker">
              {(field: AnyFieldApi) => (
                <label
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 select-none",
                    field.state.value
                      ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/60"
                      : "bg-background border-border/60 hover:bg-muted/30",
                  )}
                >
                  <Checkbox
                    checked={field.state.value}
                    onCheckedChange={(c) => field.handleChange(!!c)}
                    className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  />
                  <div className="space-y-0.5">
                    <p className={cn("text-[13px] font-medium", field.state.value ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>
                      Is this employee an Order Booker?
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      Creates a linked order booker record. Excluded from attendance.
                    </p>
                  </div>
                </label>
              )}
            </form.Field>
          </div>

        </div>

        <Separator className="opacity-50" />

        {/* ── SECTION: Compensation & Allowances ─────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Wallet className="size-4" />
            <span className="text-sm uppercase tracking-wider">
              Compensation & Allowances
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="basicSalary">
              {(field: AnyFieldApi) => (
                <Field>
                  <FieldLabel className="text-muted-foreground font-medium">
                    Basic Salary (Monthly)
                  </FieldLabel>
                  <div className="relative group max-w-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-xs font-bold text-muted-foreground/70 group-focus-within:text-yellow-600 transition-colors">
                        PKR
                      </span>
                    </div>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={field.state.value as string}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="pl-12 bg-yellow-50/30 border-yellow-200 dark:bg-yellow-500/10 dark:border-yellow-500/30 focus-visible:ring-yellow-500 font-mono text-lg h-12 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </div>

          <p className="text-[11px] text-muted-foreground/60 mt-2">
            <strong>Basic Salary:</strong> On absent days, a full day's worth is cut.
          </p>

          {/* ── Allowances ─────────────────────────────────────────────── */}
          <div className="pt-2">
            <div className="flex justify-between items-center mb-1">
              <div>
                <h4 className="text-sm font-semibold tracking-wide text-muted-foreground">
                  ALLOWANCES
                </h4>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5 w-3/4">
                  Toggle the icons on each card to configure when that allowance
                  is deducted.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  form.pushFieldValue("allowanceConfig", newCustomAllowance())
                }
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Custom
              </Button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 py-3 px-1 mb-3 border-b border-dashed">
              {DEDUCTION_OCCASIONS.map((o) => (
                <div key={o.id} className="flex items-center gap-1.5">
                  <div className={`size-2 rounded-full ${o.legendColor}`} />
                  <span className="text-[10px] text-muted-foreground/70 font-medium">
                    {o.label}
                  </span>
                </div>
              ))}
              <span className="text-[10px] text-muted-foreground/40 ml-auto">
                hover icons for details
              </span>
            </div>

            <form.Field name="allowanceConfig">
              {(field: AnyFieldApi) => (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(field.state.value as AllowanceConfig[]).map(
                    (allowance, index) => (
                      <AllowanceCard
                        key={allowance.id}
                        form={form}
                        index={index}
                        allowanceId={allowance.id}
                        onRemove={() =>
                          form.removeFieldValue("allowanceConfig", index)
                        }
                      />
                    ),
                  )}
                </div>
              )}
            </form.Field>
          </div>
        </div>

        {/* ── Submit ──────────────────────────────────────────────────────── */}
        <div className="pt-4">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  "Register Employee"
                )}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </FieldGroup>
    </form>
  );
};
