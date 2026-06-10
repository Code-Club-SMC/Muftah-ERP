import { useForm, useStore } from "@tanstack/react-form";
import { Loader2, Plus, Trash2, AlertCircle, Calculator, Info, Building2, BanknoteIcon, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { usePreviewPayslip } from "@/hooks/hr/use-preview-payslip";
import { useSavePayslip } from "@/hooks/hr/use-save-payslip";
import { useWallets } from "@/hooks/finance/use-finance";
import { format, parseISO } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import React, { useEffect, useState, type ChangeEvent } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { STANDARD_ALLOWANCES } from "@/lib/types/hr-types";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { getCycleForPayoutMonth } from "@/lib/payroll-cycle";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// ── Allowance display name resolver ──────────────────────────────────────────
const ALLOWANCE_LABELS: Record<string, string> = Object.fromEntries(
    STANDARD_ALLOWANCES.map((a) => [a.id, a.name]),
);

function getAllowanceLabel(id: string): string {
    if (id === "basicSalary") return "Basic Salary";
    return (
        ALLOWANCE_LABELS[id] ??
        id.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())
    );
}

const NON_DEDUCTIBLE_IDS = new Set(["fuel", "special", "nightShift"]);

type SalaryCalculatorFormProps = {
    employeeId: string;
    month: string;
    onSuccess: () => void;
    isOpen: boolean;
};

export const SalaryCalculatorForm = ({ employeeId, month, onSuccess, isOpen }: SalaryCalculatorFormProps) => {
    const [activeTab, setActiveTab] = useState("overview");
    const [selectedWalletId, setSelectedWalletId] = useState<string>("");
    const [selectedArrearsKeys, setSelectedArrearsKeys] = useState<Set<string>>(new Set());
    const [earlyCutoffDate, setEarlyCutoffDate] = useState<string | undefined>();
    const [ignorePastUnmarkedDays, setIgnorePastUnmarkedDays] = useState(false);
    const [showUnmarkedModal, setShowUnmarkedModal] = useState<{ count: number } | null>(null);

    const saveMutation = useSavePayslip(onSuccess);
    const { data: wallets = [] } = useWallets();

    const [cyYear, cyMonth] = month.split("-").map(Number);
    const cycle = getCycleForPayoutMonth(cyYear, cyMonth);
    const today = format(new Date(), "yyyy-MM-dd");
    const isEarlyProcessing = cycle && today < cycle.cycleEnd;

    const form = useForm({
        defaultValues: {
            bonus: "",
            incentive: "",
            tax: "",
            advance: "",
            overtimeMultiplier: "1.0",
            manualDeductions: [] as { description: string; amount: string }[],
        },
        onSubmit: async () => { },
    });

    const formValues = useStore(form.store, (state: any) => state.values);

    const { data: calculation, isFetching, isLoading, isError, error } = usePreviewPayslip({
        employeeId,
        month,
        manualDeductions: formValues.manualDeductions.map((d: any) => ({
            description: d.description,
            amount: parseFloat(d.amount) || 0,
        })),
        additionalAmounts: {
            bonusAmount: parseFloat(formValues.bonus) || 0,
            incentiveAmount: parseFloat(formValues.incentive) || 0,
            taxDeduction: parseFloat(formValues.tax) || 0,
            advanceDeduction: formValues.advance === "" ? undefined : (parseFloat(formValues.advance) || 0),
            overtimeMultiplier: parseFloat(formValues.overtimeMultiplier) || 1.0,
        },
        arrears: selectedArrearsKeys.size > 0 ? {
            arrearsFromMonths: Array.from(selectedArrearsKeys),
            arrearsAmount: Array.from(selectedArrearsKeys).reduce((sum, key) => {
                const missed = calculation?.missedCycles?.find(m => m.monthKey === key);
                return sum + (missed?.amount || 0);
            }, 0),
        } : undefined,
        earlyCutoffDate,
    }, isOpen);

    // Smart wallet suggestion: match employee's bank name to a wallet
    useEffect(() => {
        if (!selectedWalletId && wallets.length > 0 && calculation?.bankName) {
            const bankName = calculation.bankName.toLowerCase();
            const matched = wallets.find((w) =>
                bankName && w.name.toLowerCase().includes(bankName),
            );
            setSelectedWalletId(matched?.id ?? "");
        }
    }, [wallets, calculation?.bankName]);

    const handleToggleArrears = (monthKey: string) => {
        setSelectedArrearsKeys(prev => {
            const next = new Set(prev);
            if (next.has(monthKey)) next.delete(monthKey);
            else next.add(monthKey);
            return next;
        });
    };

    // ── Wallet derived values ─────────────────────────────────────────────────
    const selectedWallet = wallets.find((w) => w.id === selectedWalletId);
    const walletBalance = parseFloat(selectedWallet?.balance || "0");
    const netSalary = Math.round(calculation?.netSalary ?? 0);
    const insufficientFunds = !!selectedWallet && walletBalance < netSalary;
    const afterBalance = walletBalance - netSalary;

    const handleSave = (customIgnore?: boolean) => {
        if (!calculation) return;

        if (!selectedWalletId) {
            toast.error("Please select a payment account before finalizing.");
            return;
        }

        if (insufficientFunds) {
            toast.error(
                `Insufficient balance in "${selectedWallet?.name}". ` +
                `Available: PKR ${Math.round(walletBalance).toLocaleString()}, ` +
                `Required: PKR ${netSalary.toLocaleString()}.`,
            );
            return;
        }

        saveMutation.mutate({
            employeeId,
            month,
            walletId: selectedWalletId,
            deductionConfig: {
                manualDeductions: formValues.manualDeductions.map((d: any) => ({
                    description: d.description,
                    amount: parseFloat(d.amount) || 0,
                })),
                deductConveyanceOnLeave: true,
            },
            additionalAmounts: {
                bonusAmount: Math.round(parseFloat(formValues.bonus) || 0),
                incentiveAmount: Math.round(parseFloat(formValues.incentive) || 0),
                taxDeduction: Math.round(parseFloat(formValues.tax) || 0),
                advanceDeduction: formValues.advance === "" ? undefined : (parseFloat(formValues.advance) || 0),
                overtimeMultiplier: parseFloat(formValues.overtimeMultiplier) || 1.0,
            },
            arrears: selectedArrearsKeys.size > 0 ? {
                arrearsFromMonths: Array.from(selectedArrearsKeys),
                arrearsAmount: Array.from(selectedArrearsKeys).reduce((sum, key) => {
                    const missed = calculation?.missedCycles?.find(m => m.monthKey === key);
                    return sum + (missed?.amount || 0);
                }, 0),
            } : undefined,
            earlyCutoffDate,
            ignorePastUnmarkedDays: customIgnore ?? ignorePastUnmarkedDays,
        }, {
            onError: (err: Error) => {
                if (err.message.includes("PAST_UNMARKED_DAYS")) {
                    const days = parseInt(err.message.split(":")[1] || "0", 10);
                    setShowUnmarkedModal({ count: days });
                }
            }
        });
    };

    if (isLoading && !calculation) {
        return (
            <div className="flex flex-1 items-center justify-center min-h-[400px]">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="p-4 bg-destructive/10 text-destructive rounded-md flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="size-4" />
                Error: {error?.message}
            </div>
        );
    }

    if (!calculation) return null;

    const totalAttendanceDeduction = calculation.absentDeduction + calculation.leaveDeduction;

    return (
        <div className="space-y-6 pb-4 relative">
            {/* Refetch spinner */}
            {isFetching && calculation && (
                <div className="absolute top-0 right-0 p-2 z-50">
                    <Loader2 className="size-4 animate-spin text-primary opacity-70" />
                </div>
            )}

            {isEarlyProcessing && !earlyCutoffDate && cycle && (
                <Alert className="bg-amber-50 border-amber-200">
                    <AlertCircle className="size-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">Early Payroll Generation</AlertTitle>
                    <AlertDescription className="text-amber-700 flex flex-col gap-3 mt-2">
                        <p>
                            The payroll cycle ends on <strong>{format(parseISO(cycle.cycleEnd), "MMM d, yyyy")}</strong>, but today is <strong>{format(parseISO(today), "MMM d, yyyy")}</strong>.
                            <br/>Would you like to generate a pro-rated payslip strictly for the evaluated days up to today?
                        </p>
                        <Button size="sm" variant="outline" className="w-fit border-amber-300 text-amber-800 hover:bg-amber-100 bg-white" onClick={() => setEarlyCutoffDate(today)}>
                            Yes, Generate Pro-rated Slip till Today
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {earlyCutoffDate && (
                <Alert className="bg-blue-50 border-blue-200">
                    <Info className="size-4 text-blue-600" />
                    <AlertTitle className="text-blue-800">Pro-rated Evaluation Active</AlertTitle>
                    <AlertDescription className="text-blue-700 flex items-center justify-between mt-1">
                        <span>Generating evaluated payslip strictly up to <strong>{format(parseISO(earlyCutoffDate), "dd MMM yyyy")}</strong>.</span>
                        <Button size="sm" variant="ghost" onClick={() => {
                            setEarlyCutoffDate(undefined);
                            setIgnorePastUnmarkedDays(false);
                        }} className="h-7 text-blue-700 hover:bg-blue-100 hover:text-blue-800 bg-white">
                            Revert to Full Cycle
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* Header / Employee Summary */}
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4 border rounded-lg p-4 bg-muted/40">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase">Employee</p>
                        <p className="font-semibold text-sm">{calculation.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{calculation.designation}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Cycle</p>
                        <p className="font-semibold text-sm">{format(parseISO(calculation.startDate), "dd MMM")} - {format(parseISO(calculation.endDate), "dd MMM")}</p>
                        <p className="text-xs text-muted-foreground">{calculation.employeeCode}</p>
                    </div>
                </div>

                {/* Arrears Alert */}
                {calculation.missedCycles && calculation.missedCycles.length > 0 && (
                    <Alert className="bg-amber-50 border-amber-200">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-800 font-semibold mb-1">Unpaid Cycles Detected</AlertTitle>
                        <AlertDescription className="text-amber-700 flex flex-col gap-3">
                            <p className="text-xs">The following historical cycles for this employee are still unpaid. You can roll them forward into this payslip.</p>
                            <div className="flex flex-wrap gap-2">
                                {calculation.missedCycles.map((cycle) => {
                                    const isSelected = selectedArrearsKeys.has(cycle.monthKey);
                                    return (
                                        <Button
                                            key={cycle.monthKey}
                                            size="sm"
                                            variant={isSelected ? "default" : "outline"}
                                            className={cn(
                                                "h-8 text-xs shrink-0",
                                                isSelected
                                                    ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
                                                    : "bg-white border-amber-300 text-amber-900 hover:bg-amber-100"
                                            )}
                                            onClick={() => handleToggleArrears(cycle.monthKey)}
                                        >
                                            {isSelected ? <CheckCircle2 className="size-3 mr-1" /> : <Plus className="size-3 mr-1" />}
                                            {cycle.label}
                                        </Button>
                                    );
                                })}
                            </div>
                            {selectedArrearsKeys.size > 0 && (
                                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">
                                    + PKR {Math.round(Array.from(selectedArrearsKeys).reduce((sum, key) => sum + (calculation.missedCycles?.find(m => m.monthKey === key)?.amount || 0), 0)).toLocaleString()} Total Arrears
                                </p>
                            )}
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid grid-cols-4 mb-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="attendance">Attendance</TabsTrigger>
                    <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
                    <TabsTrigger value="calculations">Calculations</TabsTrigger>
                </TabsList>

                {/* OVERVIEW TAB */}
                <TabsContent value="overview" className="space-y-6">
                    <Card>
                        <CardHeader className="py-2 px-4 border-b bg-muted/30">
                            <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Earnings Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableBody>
                                    <SummaryRow
                                        label="Monthly Base Salary"
                                        value={Object.values(calculation.standardBreakdown).reduce((a, b) => a + b, 0)}
                                        tooltip="Sum of all fixed salary components"
                                    />
                                    {(() => {
                                        const nonDeductibleTotal = Object.entries(calculation.allowanceBreakdown)
                                            .filter(([id]) => NON_DEDUCTIBLE_IDS.has(id))
                                            .reduce((sum, [, val]) => sum + val, 0);
                                        return nonDeductibleTotal > 0 ? (
                                            <SummaryRow label="Fixed Allowances (non-deductible)" value={nonDeductibleTotal} />
                                        ) : null;
                                    })()}
                                    <SummaryRow label="Overtime Pay" value={calculation.overtimeAmount} highlight />
                                    <SummaryRow label="Incentives & TA/DA" value={calculation.incentiveAmount} highlight />
                                    <SummaryRow label="Commission" value={calculation.commissionAmount} highlight />
                                    <SummaryRow label="Bonus & Eid Allowance" value={calculation.bonusAmount} highlight />
                                    <TableRow className="bg-muted/10 font-semibold">
                                        <TableCell className="py-2.5">Total Gross Earnings</TableCell>
                                        <TableCell className="text-right py-2.5 text-emerald-700">PKR {Math.round(calculation.grossSalary + totalAttendanceDeduction).toLocaleString()}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="py-2 px-4 border-b bg-muted/30">
                            <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Deductions Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableBody>
                                    <SummaryRow
                                        label="Absents & Short Sessions"
                                        value={totalAttendanceDeduction}
                                        isDeduction
                                        tooltip="Loss of pay due to missing days or short hours"
                                    />
                                    <SummaryRow label="Income Tax" value={calculation.taxDeduction} isDeduction />
                                    <SummaryRow
                                        label={formValues.advance === "" ? "Salary Advance Recovery (Auto)" : "Salary Advance Recovery"}
                                        value={calculation.advanceDeduction}
                                        isDeduction
                                        tooltip={calculation.advanceProcessRecords?.length > 0 ? (
                                            calculation.advanceProcessRecords.map((a: any) => 
                                                `Inst. ${a.installmentNo}/${a.totalInstallments} (Remaining: PKR ${Math.round(a.remainingBalance).toLocaleString()})`
                                            ).join(", ")
                                        ) : undefined}
                                    />
                                    {formValues.advance === "" && calculation.advanceProcessRecords?.map((a: any, i: number) => (
                                        <TableRow key={`adv-detail-${i}`} className="hover:bg-transparent border-0 opacity-60">
                                            <TableCell className="py-0 pl-8 text-[10px] text-muted-foreground italic">
                                                ↳ Installment {a.installmentNo} of {a.totalInstallments} (Balance: PKR {Math.round(a.remainingBalance).toLocaleString()})
                                            </TableCell>
                                            <TableCell className="text-right py-0 text-[10px] font-mono text-rose-600">
                                                - {Math.round(a.installmentAmount).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <SummaryRow label="Other Manual Deductions" value={calculation.otherDeduction} isDeduction />
                                    <TableRow className="bg-muted/10 font-semibold border-t">
                                        <TableCell className="py-2.5">Total Deductions</TableCell>
                                        <TableCell className="text-right py-2.5 text-rose-600">
                                            - PKR {Math.round(calculation.totalDeductions + totalAttendanceDeduction).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Net Pay */}
                    <div className="flex items-center justify-between p-5 bg-primary/5 border border-primary/20 rounded-xl ">
                        <div className="space-y-0.5">
                            <p className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wide">
                                Net Payable Amount
                            </p>
                            <p className="text-xs text-muted-foreground">Final amount to be credited to employee</p>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-extrabold text-primary tracking-tight">PKR {Math.round(calculation.netSalary).toLocaleString()}</p>
                        </div>
                    </div>
                </TabsContent>

                {/* ATTENDANCE TAB */}
                <TabsContent value="attendance" className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <StatCard
                            label="Total Job Days"
                            value={calculation.totalWorkingDays}
                            tooltip="Calendar days minus holidays in this cycle"
                        />
                        <StatCard
                            label="Present"
                            value={calculation.daysPresent}
                            className={cn(
                                "bg-emerald-50 border-emerald-100 text-emerald-700",
                                calculation.daysPresent > calculation.totalWorkingDays && "ring-2 ring-emerald-500 ring-offset-2"
                            )}
                            tooltip={calculation.daysPresent > calculation.totalWorkingDays ? "Includes working on weekends/holidays" : undefined}
                        />
                        <StatCard label="Absent" value={calculation.daysAbsent} className="bg-rose-50 border-rose-100 text-rose-700" />
                        <StatCard
                            label="Unmarked Days"
                            value={calculation.unmarkedDays}
                            className={calculation.unmarkedDays > 0 ? "bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500 animate-pulse" : ""}
                            tooltip="Days with no attendance records! Please fix in Attendance."
                        />
                        <StatCard label="Annual Leave" value={calculation.daysAnnualLeave} className="bg-amber-50 border-amber-100 text-amber-700" />
                        <StatCard label="Sick Leave" value={calculation.daysSickLeave} className="bg-amber-50 border-amber-100 text-amber-700" />
                        <StatCard label="Special Leave" value={calculation.daysSpecialLeave} className="bg-amber-50 border-amber-100 text-amber-700" />
                        <StatCard label="Unapproved Leave" value={calculation.daysUnapprovedLeave} className="bg-rose-50 border-rose-100 text-rose-700" tooltip="Conveyance deducted" />
                        <StatCard
                            label="Undertime (Hrs)"
                            value={calculation.totalUndertimeHours}
                            className={calculation.totalUndertimeHours > 0 ? "bg-amber-50 border-amber-100 text-amber-700" : ""}
                        />
                        <StatCard label="Overtime (Hrs)" value={calculation.totalOvertimeHours} className="bg-blue-50 border-blue-100 text-blue-700" />
                    </div>

                    {calculation.daysPresent > calculation.totalWorkingDays && (
                        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs flex items-center gap-2">
                            <Info className="size-4 shrink-0" />
                            Employee worked {calculation.daysPresent - calculation.totalWorkingDays} extra day(s) beyond the standard job cycle.
                        </div>
                    )}

                    {/* Bradford Factor */}
                    <Card>
                        <CardHeader className="py-2 px-4 border-b bg-muted/30">
                            <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                                <ShieldAlert className="size-3.5" />
                                Bradford Factor
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Absence pattern score (B = S² × D)</p>
                                    <p className="text-xs text-muted-foreground">Period: {calculation.bradfordFactorPeriod}</p>
                                </div>
                                <div className="text-right">
                                    <p className={cn(
                                        "text-3xl font-extrabold tracking-tight",
                                        calculation.bradfordFactorScore === 0 && "text-emerald-600",
                                        calculation.bradfordFactorScore > 0 && calculation.bradfordFactorScore < 50 && "text-amber-600",
                                        calculation.bradfordFactorScore >= 50 && calculation.bradfordFactorScore < 250 && "text-orange-600",
                                        calculation.bradfordFactorScore >= 250 && "text-rose-600",
                                    )}>
                                        {calculation.bradfordFactorScore}
                                    </p>
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "text-[10px] mt-1",
                                            calculation.bradfordFactorScore === 0 && "border-emerald-200 text-emerald-700 bg-emerald-50",
                                            calculation.bradfordFactorScore > 0 && calculation.bradfordFactorScore < 50 && "border-amber-200 text-amber-700 bg-amber-50",
                                            calculation.bradfordFactorScore >= 50 && calculation.bradfordFactorScore < 250 && "border-orange-200 text-orange-700 bg-orange-50",
                                            calculation.bradfordFactorScore >= 250 && "border-rose-200 text-rose-700 bg-rose-50",
                                        )}
                                    >
                                        {calculation.bradfordFactorScore === 0 ? "Excellent" : calculation.bradfordFactorScore < 50 ? "Acceptable" : calculation.bradfordFactorScore < 250 ? "Concerning" : "Critical"}
                                    </Badge>
                                </div>
                            </div>
                            <div className="mt-3 pt-3 border-t text-[10px] text-muted-foreground space-y-0.5">
                                <p><strong>S</strong> = number of separate absence spells (consecutive absents count as 1 spell)</p>
                                <p><strong>D</strong> = total absent-equivalent days (half-days count as 0.5)</p>
                                <p>Thresholds: 0 = Excellent, &lt;50 = Acceptable, &lt;250 = Concerning, 250+ = Critical</p>
                            </div>
                        </CardContent>
                    </Card>

                    <p className="text-[10px] text-center text-muted-foreground border-t pt-2 uppercase font-medium ">
                        Verified Attendance Records
                    </p>
                </TabsContent>

                {/* ADJUSTMENTS TAB */}
                <TabsContent value="adjustments" className="space-y-6">
                    <FieldGroup>
                        <form.Field name="overtimeMultiplier">
                            {(field) => (
                                <Field className="mb-4">
                                    <FieldLabel className="flex items-center gap-2">
                                        Overtime Multiplier Rate
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Info className="size-3 text-muted-foreground" />
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-[200px] text-xs">
                                                    Standard is 1.0x of hourly basic rate. Change here if overtime payout should be at 1.5x or 2.0x.
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </FieldLabel>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={field.state.value}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) => field.handleChange(e.target.value)}
                                        placeholder="1.0"
                                        className="w-24 border-primary/30"
                                    />
                                </Field>
                            )}
                        </form.Field>

                        <Separator className="my-4" />

                        <div className="grid grid-cols-2 gap-4">
                            <form.Field name="bonus">
                                {(field) => (
                                    <Field>
                                        <FieldLabel>Bonus Amount</FieldLabel>
                                        <Input
                                            type="number"
                                            value={field.state.value}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => field.handleChange(e.target.value)}
                                            placeholder="0"
                                        />
                                    </Field>
                                )}
                            </form.Field>
                            <form.Field name="incentive">
                                {(field) => (
                                    <Field>
                                        <FieldLabel>Incentive / Arrears</FieldLabel>
                                        <Input
                                            type="number"
                                            value={field.state.value}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => field.handleChange(e.target.value)}
                                            placeholder="0"
                                        />
                                    </Field>
                                )}
                            </form.Field>
                            <form.Field name="tax">
                                {(field) => (
                                    <Field>
                                        <FieldLabel>Income Tax</FieldLabel>
                                        <Input
                                            type="number"
                                            value={field.state.value}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => field.handleChange(e.target.value)}
                                            placeholder="0"
                                        />
                                    </Field>
                                )}
                            </form.Field>
                            <form.Field name="advance">
                                {(field) => (
                                    <Field>
                                        <FieldLabel>Salary Advance Deduction</FieldLabel>
                                        <Input
                                            type="number"
                                            value={field.state.value}
                                            onChange={(e: ChangeEvent<HTMLInputElement>) => field.handleChange(e.target.value)}
                                            placeholder="0"
                                        />
                                    </Field>
                                )}
                            </form.Field>
                        </div>

                        <Separator className="my-2" />

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium">Other Manual Deductions</h3>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => form.pushFieldValue("manualDeductions", { description: "", amount: "" })}
                                    className="h-8 text-xs"
                                >
                                    <Plus className="size-3 mr-1" /> Add
                                </Button>
                            </div>

                            <form.Field name="manualDeductions">
                                {(field) => (
                                    <div className="space-y-3">
                                        {field.state.value.map((_, i) => (
                                            <div key={i} className="flex gap-2 items-start">
                                                <form.Field name={`manualDeductions[${i}].description`}>
                                                    {(subField) => (
                                                        <Input
                                                            placeholder="Description"
                                                            value={subField.state.value}
                                                            onChange={(e: ChangeEvent<HTMLInputElement>) => subField.handleChange(e.target.value)}
                                                            className="flex-1"
                                                        />
                                                    )}
                                                </form.Field>
                                                <form.Field name={`manualDeductions[${i}].amount`}>
                                                    {(subField) => (
                                                        <Input
                                                            type="number"
                                                            placeholder="Amount"
                                                            value={subField.state.value}
                                                            onChange={(e: ChangeEvent<HTMLInputElement>) => subField.handleChange(e.target.value)}
                                                            className="w-24"
                                                        />
                                                    )}
                                                </form.Field>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="shrink-0 text-muted-foreground hover:text-destructive"
                                                    onClick={() => form.removeFieldValue("manualDeductions", i)}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        {field.state.value.length === 0 && (
                                            <p className="text-xs text-muted-foreground italic">No manual deductions added.</p>
                                        )}
                                    </div>
                                )}
                            </form.Field>
                        </div>
                    </FieldGroup>
                </TabsContent>

                {/* CALCULATIONS TAB */}
                <TabsContent value="calculations" className="space-y-5 text-sm">
                    <CalcSection step="Step 1" title="Base Rates" color="blue">
                        <CalcRow
                            label="Standard Salary (Contract)"
                            formula="All components combined"
                            result={`PKR ${Math.round(Object.values(calculation.standardBreakdown).reduce((a, b) => a + b, 0)).toLocaleString()}`}
                        />
                        <CalcRow
                            label="Total Working Days (this cycle)"
                            formula={`Mon–Fri days between ${format(parseISO(calculation.startDate), "dd MMM")} – ${format(parseISO(calculation.endDate), "dd MMM")}`}
                            result={`${calculation.totalWorkingDays} days`}
                        />
                        <CalcRow
                            label="Standard Duty Hours / Day"
                            formula="Configured per employee"
                            result={`${calculation.calculationMeta.standardDutyHours} hrs`}
                        />
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-1 font-mono text-xs">
                            <p className="text-blue-800 font-semibold mb-1">Derived Rates:</p>
                            <p>Per Day Basic = {Math.round(calculation.standardBreakdown.basicSalary).toLocaleString()} ÷ {calculation.totalWorkingDays} = <span className="font-bold">{calculation.calculationMeta.perDayBasic.toFixed(2)}</span></p>
                            <p>Per Hour Basic = {calculation.calculationMeta.perDayBasic.toFixed(2)} ÷ {calculation.calculationMeta.standardDutyHours} = <span className="font-bold">{calculation.calculationMeta.perHourBasic.toFixed(2)}</span></p>
                        </div>
                    </CalcSection>

                    <CalcSection step="Step 2" title="Salary Component Breakdown" color="slate">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-muted/40 text-muted-foreground">
                                        <th className="text-left py-1.5 px-2 font-semibold">Component</th>
                                        <th className="text-right py-1.5 px-2 font-semibold">Standard</th>
                                        <th className="text-right py-1.5 px-2 font-semibold text-rose-600">Deducted</th>
                                        <th className="text-right py-1.5 px-2 font-semibold text-emerald-700">Adjusted</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {Object.entries(calculation.standardBreakdown)
                                        .filter(([, stdVal]) => stdVal > 0)
                                        .map(([id, stdVal]) => {
                                            const adjVal = calculation.allowanceBreakdown[id] ?? stdVal;
                                            const deducted = stdVal - adjVal;
                                            const isFixed = NON_DEDUCTIBLE_IDS.has(id);
                                            return (
                                                <tr key={id} className="hover:bg-muted/20">
                                                    <td className="py-1.5 px-2 text-muted-foreground">
                                                        {getAllowanceLabel(id)}
                                                        {isFixed && (
                                                            <span className="ml-1.5 text-[9px] text-muted-foreground/60 italic">(non-deductible)</span>
                                                        )}
                                                    </td>
                                                    <td className="py-1.5 px-2 text-right font-mono">{Math.round(stdVal).toLocaleString()}</td>
                                                    <td className={`py-1.5 px-2 text-right font-mono ${deducted > 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                                                        {deducted > 0 ? `- ${Math.round(deducted).toLocaleString()}` : "—"}
                                                    </td>
                                                    <td className="py-1.5 px-2 text-right font-mono font-semibold text-emerald-700">{Math.round(adjVal).toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </CalcSection>

                    <CalcSection step="Step 3" title="Attendance Deduction Rules Applied" color="rose">
                        <div className="space-y-3 text-xs">
                            {calculation.daysNotEmployed > 0 && (
                                <div className="p-3 rounded-lg border border-orange-100 bg-orange-50/50 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-orange-800">Pre-Joining / Cutoff Proration</span>
                                        <Badge variant="outline" className="text-[10px] border-orange-200 text-orange-700 bg-white">{calculation.daysNotEmployed} day(s)</Badge>
                                    </div>
                                    <p className="text-muted-foreground font-mono leading-relaxed">
                                        {calculation.daysNotEmployed} × Per Day Rate (Basic + allowances)
                                    </p>
                                </div>
                            )}
                            {calculation.daysAbsent > 0 && (
                                <div className="p-3 rounded-lg border border-rose-100 bg-rose-50/50 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-rose-800">Full Day Absent</span>
                                        <Badge variant="outline" className="text-[10px] border-rose-200 text-rose-700 bg-white">{calculation.daysAbsent} day(s)</Badge>
                                    </div>
                                    <p className="text-muted-foreground font-mono leading-relaxed">
                                        {calculation.daysAbsent} × Per Day Rate (Basic + all allowances except Fuel & Special)
                                    </p>
                                </div>
                            )}
                            {calculation.totalUndertimeHours > 0 && (
                                <div className="p-3 rounded-lg border border-amber-100 bg-amber-50/50 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-amber-800">Undertime (Short Hours)</span>
                                        <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-700 bg-white">{calculation.totalUndertimeHours} hrs</Badge>
                                    </div>
                                    <p className="text-muted-foreground font-mono leading-relaxed">
                                        {calculation.totalUndertimeHours} hrs × PKR {calculation.calculationMeta.perHourBasic.toFixed(2)} per hour (Basic salary only)
                                    </p>
                                </div>
                            )}
                            {calculation.daysUnapprovedLeave > 0 && (
                                <div className="p-3 rounded-lg border border-violet-100 bg-violet-50/50 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-violet-800">Unpaid / Unapproved Leave</span>
                                        <Badge variant="outline" className="text-[10px] border-violet-200 text-violet-700 bg-white">{calculation.daysUnapprovedLeave} day(s)</Badge>
                                    </div>
                                    <p className="text-muted-foreground font-mono leading-relaxed">
                                        {calculation.daysUnapprovedLeave} × Per Day Conveyance only
                                    </p>
                                </div>
                            )}
                            {calculation.daysNotEmployed === 0 && calculation.daysAbsent === 0 && calculation.totalUndertimeHours === 0 && calculation.daysUnapprovedLeave === 0 && (
                                <p className="text-muted-foreground italic py-2 text-center">No attendance deductions this cycle. 🎉</p>
                            )}
                        </div>
                        <div className="mt-3 flex items-center justify-between p-2.5 bg-rose-50 border border-rose-100 rounded-lg">
                            <span className="text-xs font-semibold text-rose-800">Total Attendance & Proration Deduction</span>
                            <span className="text-sm font-bold font-mono text-rose-700">- PKR {Math.round(calculation.absentDeduction + calculation.leaveDeduction + calculation.notEmployedDeduction).toLocaleString()}</span>
                        </div>
                    </CalcSection>

                    {calculation.totalOvertimeHours > 0 && (
                        <CalcSection step="Step 4" title="Overtime Calculation" color="blue">
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg font-mono text-xs space-y-1 text-blue-900">
                                <p>OT Rate = Per Hour Basic × Multiplier</p>
                                <p className="font-bold">OT Rate = {calculation.calculationMeta.perHourBasic.toFixed(2)} × {calculation.calculationMeta.overtimeMultiplier} = {calculation.calculationMeta.overtimeRatePerHour.toFixed(2)} / hr</p>
                                <Separator className="my-1.5 bg-blue-200" />
                                <p>OT Pay = OT Rate × Total OT Hours</p>
                                <p className="font-bold">OT Pay = {calculation.calculationMeta.overtimeRatePerHour.toFixed(2)} × {calculation.totalOvertimeHours} hrs = PKR {Math.round(calculation.overtimeAmount).toLocaleString()}</p>
                            </div>
                            {calculation.calculationMeta.overtimeMultiplier !== 1.5 && (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">
                                    ⚠ Custom multiplier ({calculation.calculationMeta.overtimeMultiplier}×) applied — standard is 1.5×
                                </p>
                            )}
                        </CalcSection>
                    )}

                    <CalcSection step={calculation.totalOvertimeHours > 0 ? "Step 5" : "Step 4"} title="Gross Salary Build-up" color="emerald">
                        <div className="space-y-1 text-xs font-mono">
                            {Object.entries(calculation.allowanceBreakdown)
                                .filter(([id]) => id !== "nightShift")
                                .map(([id, val]) => (
                                    <div key={id} className="flex justify-between py-0.5 border-b border-dashed border-border/40">
                                        <span className={`${(val as number) <= 0 ? "text-rose-400 line-through" : "text-muted-foreground"}`}>
                                            {id === "basicSalary" ? "+" : "+"} {getAllowanceLabel(id)}
                                        </span>
                                        <span className={(val as number) <= 0 ? "text-rose-400" : ""}>{Math.round(val as number).toLocaleString()}</span>
                                    </div>
                                ))}
                            {[
                                { label: "Overtime Pay", val: calculation.overtimeAmount },
                                { label: "Night Shift Allowance", val: calculation.nightShiftAllowanceAmount },
                                { label: "Incentive / Arrears", val: calculation.incentiveAmount },
                                { label: "Bonus", val: calculation.bonusAmount },
                            ].filter(r => r.val > 0).map(({ label, val }) => (
                                <div key={label} className="flex justify-between py-0.5 border-b border-dashed border-border/40">
                                    <span className="text-muted-foreground">+ {label}</span>
                                    <span>{Math.round(val).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <span className="text-xs font-bold text-emerald-800">= GROSS SALARY</span>
                            <span className="text-base font-extrabold font-mono text-emerald-700">PKR {Math.round(calculation.grossSalary).toLocaleString()}</span>
                        </div>
                    </CalcSection>

                    <CalcSection step={calculation.totalOvertimeHours > 0 ? "Step 6" : "Step 5"} title="Flat Deductions (from Gross)" color="rose">
                        <div className="space-y-1 text-xs font-mono">
                            {calculation.taxDeduction > 0 && (
                                <div className="flex justify-between py-0.5 border-b border-dashed border-border/40">
                                    <span className="text-muted-foreground">− Income Tax</span>
                                    <span className="text-rose-600">{Math.round(calculation.taxDeduction).toLocaleString()}</span>
                                </div>
                            )}
                            {calculation.advanceDeduction > 0 && (
                                <div className="space-y-1">
                                    <div className="flex justify-between py-0.5 border-b border-dashed border-border/40">
                                        <span className="text-muted-foreground">− Salary Advance Recovery</span>
                                        <span className="text-rose-600">{Math.round(calculation.advanceDeduction).toLocaleString()}</span>
                                    </div>
                                    {calculation.advanceProcessRecords?.map((a: any, i: number) => (
                                        <div key={i} className="flex justify-between pl-4 py-0.5 text-[10px] opacity-70 italic border-l-2 ml-1 border-rose-200">
                                            <span>↳ Inst. {a.installmentNo}/{a.totalInstallments} (Remaining PKR {Math.round(a.remainingBalance).toLocaleString()})</span>
                                            <span>{Math.round(a.installmentAmount).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {calculation.manualDeductions.map((d, i) => (
                                <div key={i} className="flex justify-between py-0.5 border-b border-dashed border-border/40">
                                    <span className="text-muted-foreground">− {d.description || "Manual Deduction"}</span>
                                    <span className="text-rose-600">{Math.round(d.amount).toLocaleString()}</span>
                                </div>
                            ))}
                            {calculation.totalDeductions === 0 && (
                                <p className="text-muted-foreground italic py-1">No flat deductions applied.</p>
                            )}
                        </div>
                        {calculation.totalDeductions > 0 && (
                            <div className="mt-2 flex items-center justify-between p-2.5 bg-rose-50 border border-rose-100 rounded-lg">
                                <span className="text-xs font-semibold text-rose-800">Total Flat Deductions</span>
                                <span className="text-sm font-bold font-mono text-rose-700">- PKR {Math.round(calculation.totalDeductions).toLocaleString()}</span>
                            </div>
                        )}
                    </CalcSection>

                    <div className="p-4 bg-primary/5 border-2 border-primary/30 rounded-xl space-y-2">
                        <p className="text-xs font-bold uppercase  text-primary">{calculation.totalOvertimeHours > 0 ? "Step 7" : "Step 6"}: Net Salary</p>
                        <div className="font-mono text-xs text-muted-foreground space-y-0.5">
                            <p>Net = Gross − Flat Deductions</p>
                            <p className="font-semibold text-foreground">
                                Net = {Math.round(calculation.grossSalary).toLocaleString()} − {Math.round(calculation.totalDeductions).toLocaleString()} = <span className="text-primary text-base font-extrabold">PKR {Math.round(calculation.netSalary).toLocaleString()}</span>
                            </p>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Net salary cannot go below PKR 0.</p>
                    </div>
                </TabsContent>
            </Tabs>

            {/* ── Payment Account + Footer ───────────────────────────────────── */}
            <div className="space-y-4 pt-4 border-t sticky bottom-0 bg-background/95 backdrop-blur-sm pb-4">
                {/* Wallet selector */}
                <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                    <p className="text-[11px] font-black uppercase  text-muted-foreground">
                        Payment Account <span className="text-destructive">*</span>
                    </p>

                    <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
                        <SelectTrigger className={cn("h-11 bg-background", insufficientFunds && "border-destructive focus-visible:ring-destructive")}>
                            <SelectValue placeholder="Select account to debit salary from…" />
                        </SelectTrigger>
                        <SelectContent>
                            {wallets.length === 0 && (
                                <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                                    No accounts found. Create one in Finance.
                                </div>
                            )}
                            {wallets.map((w) => {
                                const bal = parseFloat(w.balance || "0");
                                const low = bal < netSalary;
                                return (
                                    <SelectItem key={w.id} value={w.id}>
                                        <div className="flex items-center gap-2 w-full min-w-[220px]">
                                            {w.type === "bank"
                                                ? <Building2 className="size-3.5 text-blue-600 shrink-0" />
                                                : <BanknoteIcon className="size-3.5 text-violet-600 shrink-0" />}
                                            <span className="font-medium flex-1">{w.name}</span>
                                            <span className={cn("text-[11px] tabular-nums ml-2", low ? "text-destructive font-bold" : "text-muted-foreground")}>
                                                PKR {Math.round(bal).toLocaleString()}
                                            </span>
                                            {low && (
                                                <span className="text-[9px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-bold uppercase ml-1">
                                                    Low
                                                </span>
                                            )}
                                        </div>
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>

                    {/* Balance feedback */}
                    {selectedWallet && (
                        <div className={cn(
                            "flex items-center justify-between p-2.5 rounded-lg border text-[12px]",
                            insufficientFunds
                                ? "bg-destructive/5 border-destructive/30"
                                : "bg-emerald-50/50 border-emerald-200/50 dark:bg-emerald-950/20 dark:border-emerald-900/30",
                        )}>
                            <span className="font-medium text-muted-foreground">
                                {insufficientFunds ? "Shortfall" : "Balance after deduction"}
                            </span>
                            <span className={cn("font-black tabular-nums", insufficientFunds ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}>
                                {insufficientFunds
                                    ? `PKR ${Math.round(netSalary - walletBalance).toLocaleString()} needed`
                                    : `PKR ${Math.round(afterBalance).toLocaleString()}`}
                            </span>
                        </div>
                    )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2.5">
                    <Button variant="outline" className="flex-1" onClick={onSuccess} disabled={saveMutation.isPending}>
                        Cancel
                    </Button>
                    <Button
                        className="flex-1"
                        onClick={() => handleSave()}
                        disabled={saveMutation.isPending || !calculation || !selectedWalletId || insufficientFunds}
                    >
                    {saveMutation.isPending
                            ? <><Loader2 className="mr-2 size-4 animate-spin" /> Processing…</>
                            : <><Calculator className="mr-2 size-4" /> Finalize & Generate Slip</>}
                    </Button>
                </div>
            </div>

            <AlertDialog open={!!showUnmarkedModal} onOpenChange={(o) => (!o && !saveMutation.isPending) && setShowUnmarkedModal(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                            <AlertCircle className="size-5" />
                            Missing Attendance Data
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm mt-3">
                            You are requesting to finalize a slip, but there are <strong className="text-red-600">{showUnmarkedModal?.count} days</strong> of missing attendance data in the evaluation period.
                            <br/><br/>
                            Generating a slip without reviewing and marking all past days will lead to incorrect salary allocations because the system calculates presence using available records.
                            <br/><br/>
                            Do you still want to proceed and finalize the slip despite missing data?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={saveMutation.isPending}>Cancel</AlertDialogCancel>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={saveMutation.isPending}
                            onClick={() => {
                                setIgnorePastUnmarkedDays(true);
                                setShowUnmarkedModal(null);
                                // Queue the next save with skip validation true
                                setTimeout(() => {
                                    handleSave(true);
                                }, 50);
                            }}
                        >
                            {saveMutation.isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                            Proceed Anyway
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

// ── Helper Components ─────────────────────────────────────────────────────────

function SummaryRow({ label, value, isDeduction, highlight, tooltip }: { label: string; value: number; isDeduction?: boolean; highlight?: boolean; tooltip?: string }) {
    if (value === 0 && !highlight) return null;
    return (
        <TableRow className="hover:bg-transparent border-0 group">
            <TableCell className="py-2 text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    {label}
                    {tooltip && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="size-3.5 opacity-0 group-hover:opacity-50 transition-opacity cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right"><p className="text-xs">{tooltip}</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </TableCell>
            <TableCell className={`text-right py-2 font-mono ${isDeduction ? "text-rose-600" : ""} ${highlight ? "font-bold text-emerald-600" : ""}`}>
                {isDeduction ? "- " : ""}{Math.round(value).toLocaleString()}
            </TableCell>
        </TableRow>
    );
}

function StatCard({ label, value, className, tooltip }: { label: string; value: number | string; className?: string; tooltip?: string }) {
    const content = (
        <div className={cn("p-4 rounded-lg border text-center transition-all duration-200 hover:shadow-md cursor-default", className || "bg-card")}>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <p className="text-[10px] text-muted-foreground uppercase mt-1 font-bold tracking-wider">{label}</p>
        </div>
    );
    if (tooltip) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent><p className="text-xs">{tooltip}</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }
    return content;
}

type CalcColor = "blue" | "rose" | "emerald" | "slate";
const calcColorMap: Record<CalcColor, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    rose: "bg-rose-50 border-rose-200 text-rose-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    slate: "bg-muted/40 border-border text-muted-foreground",
};

function CalcSection({ step, title, color, children }: { step: string; title: string; color: CalcColor; children: React.ReactNode }) {
    return (
        <div className="border rounded-xl overflow-hidden">
            <div className={cn("px-4 py-2.5 flex items-center gap-2 border-b", calcColorMap[color])}>
                <span className="text-[10px] font-extrabold uppercase  opacity-70">{step}</span>
                <span className="text-xs font-bold">{title}</span>
            </div>
            <div className="p-4 space-y-2 bg-card">{children}</div>
        </div>
    );
}

function CalcRow({ label, formula, result }: { label: string; formula: string; result: string }) {
    return (
        <div className="flex items-start justify-between gap-4 text-xs py-1 border-b border-dashed border-border/40 last:border-0">
            <div>
                <p className="font-medium text-foreground">{label}</p>
                <p className="text-muted-foreground font-mono">{formula}</p>
            </div>
            <p className="font-bold font-mono text-right shrink-0">{result}</p>
        </div>
    );
}