// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useForm, useStore } from "@tanstack/react-form";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createInvoiceSchema } from "@/db/zod_schemas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetAllCustomers } from "@/hooks/sales/use-customers";
import { useCreateInvoice, useUpdateInvoice } from "@/hooks/sales/use-invoices";
import { useWallets } from "@/hooks/finance/use-finance";
import { useGetRecipePrices } from "@/hooks/sales/use-sales-config";
import { getInventoryFn } from "@/server-functions/inventory/get-inventory-fn";
import { getCartonAvailabilityFn } from "@/server-functions/inventory/get-carton-availability-fn";
import { useGetDistributorDiscountRules } from "@/hooks/sales/use-discount-rules";
import {
    AlertCircle,
    BanknoteIcon,
    Building2Icon,
    ChevronRight,
    Info,
    Loader2,
    MapPin,
    Phone,
    Warehouse,
    BadgeCheck,
    Percent,
    FileText,
    Tag,
} from "lucide-react";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { ItemFormValue, StockItem } from "./create-invoice-form/utils";
import { PKR, findStock, Section, ModeToggle, DirtyStateNotifier, blankItem, safeEffectiveCPP } from "./create-invoice-form/utils";
import { InvoiceItemsSection } from "./create-invoice-form/invoice-items-section";
import { SettlementSection } from "./create-invoice-form/settlement-section";

type Props = {
    onSuccess: () => void;
    onCancel: () => void;
    onDirtyChange?: (isDirty: boolean) => void;
    initialData?: any;
    defaultCustomerType?: "distributor" | "retailer" | "wholesaler";
    lockedCustomerType?: boolean;
};

type InvoiceFormValues = {
    customerId: string;
    customerName: string;
    customerMobile: string;
    customerCnic: string;
    customerCity: string;
    customerState: string;
    customerBankAccount: string;
    customerType: "distributor" | "retailer" | "wholesaler";
    warehouseId: string;
    account: string;
    cash: number;
    credit: number;
    creditReturnDate: string;
    expenses: number;
    expensesDescription: string;
    remarks: string;
    items: ItemFormValue[];
};



export const CreateInvoiceForm = ({ onSuccess, onCancel, onDirtyChange, initialData, defaultCustomerType, lockedCustomerType }: Props) => {
    const { data: customers } = useGetAllCustomers();
    const isDistributorLocked = lockedCustomerType && defaultCustomerType === "distributor";

    const filteredCustomers = useMemo(() => {
        if (!customers) return [];
        if (isDistributorLocked) {
            return customers.filter((c: any) => c.customerType === "distributor");
        }
        return customers.filter((c: any) => c.customerType !== "distributor");
    }, [customers, isDistributorLocked]);

    const selectedCustomer = useMemo(() => {
        const customerId = initialData ? (initialData.customerId || "") : "";
        if (!customerId || !customers) return null;
        return customers.find((c: any) => c.id === customerId) || null;
    }, [customers, initialData]);

    const { data: inventoryData } = useSuspenseQuery({
        queryKey: ["inventory"],
        queryFn: () => getInventoryFn(),
    });
    const { data: walletsData } = useWallets();
    const { data: recipePricesData } = useGetRecipePrices();

    const [customerMode, setCustomerMode] = useState<"existing" | "new">(isDistributorLocked ? "existing" : "existing");
    const [activeWarehouse, setActiveWarehouse] = useState<string>("");
    const [availableStock, setAvailableStock] = useState<StockItem[]>([]);

    const wallets = walletsData || [];
    const warehouses = inventoryData ?? [];

    const recipePriceMap = useMemo(() => {
        const map = new Map<string, { invoicePricePerPack: number; retailPricePerPack: number }>();
        if (!recipePricesData) return map;
        for (const rp of recipePricesData) {
            if (rp.invoicePricePerPack != null && rp.retailPricePerPack != null) {
                map.set(rp.recipeId, {
                    invoicePricePerPack: rp.invoicePricePerPack,
                    retailPricePerPack: rp.retailPricePerPack,
                });
            }
        }
        return map;
    }, [recipePricesData]);

    const { data: cartonAvailability } = useQuery({
        queryKey: ["carton-availability", activeWarehouse],
        queryFn: () => getCartonAvailabilityFn({ data: { warehouseId: activeWarehouse } }),
        enabled: !!activeWarehouse,
    });

    const getCartonInfo = useCallback((recipeId: string) => {
        const info = cartonAvailability?.find((c) => c.recipeId === recipeId);
        return info ?? { completeCartons: 0, partialCartons: 0, totalPacks: 0 };
    }, [cartonAvailability]);

    useEffect(() => {
        if (warehouses.length > 0 && !activeWarehouse) {
            setActiveWarehouse(warehouses[0].id);
        }
    }, [warehouses, activeWarehouse]);

    useEffect(() => {
        if (activeWarehouse) {
            const warehouse = warehouses.find((warehouse: { id: string }) => warehouse.id === activeWarehouse);
            setAvailableStock((warehouse?.finishedGoodsStock ?? []) as unknown as StockItem[]);
        }
    }, [activeWarehouse, warehouses]);

    const { mutateAsync: createInvoice, isPending: isCreating } = useCreateInvoice();
    const { mutateAsync: updateInvoice, isPending: isUpdating } = useUpdateInvoice();
    const isPending = isCreating || isUpdating;

    const form = useForm({
        defaultValues: initialData ? {
            customerId: initialData.customerId || "",
            customerName: "",
            customerMobile: "",
            customerCnic: "",
            customerCity: "",
            customerState: "",
            customerBankAccount: "",
            customerType: (initialData.customer?.customerType || defaultCustomerType || "retailer") as "distributor" | "retailer" | "wholesaler",
            warehouseId: initialData.warehouseId || "",
            account: initialData.account || (wallets[0]?.id || ""),
            cash: Number(initialData.cash) || 0,
            credit: Number(initialData.credit) || 0,
            creditReturnDate: initialData.creditReturnDate ? new Date(initialData.creditReturnDate).toISOString().split("T")[0] : "",
            expenses: Number(initialData.expenses) || 0,
            expensesDescription: initialData.expensesDescription || "",
            remarks: initialData.remarks || "",
            items: ((initialData?.items ?? []) as Array<Record<string, unknown>>).map((it): ItemFormValue => ({
                pack: String((it as any).pack || ""),
                recipeId: String((it as any).recipeId || ""),
                unitType: Number((it as any).numberOfCartons) > 0 ? "carton" : "units",
                numberOfCartons: Number((it as any).numberOfCartons) || 0,
                numberOfUnits: Number((it as any).numberOfUnits) || 0,
                discountCartons: Number((it as any).discountCartons) || 0,
                packsPerCarton: Number((it as any).packsPerCarton) || 0,
                hsnCode: String((it as any).hsnCode || ""),
                perCartonPrice: Number((it as any).perCartonPrice) || 0,
                retailPrice: Number((it as any).retailPrice) || 0,
            })),
        } : {
            customerId: "",
            customerName: "",
            customerMobile: "",
            customerCnic: "",
            customerCity: "",
            customerState: "",
            customerBankAccount: "",
            customerType: (defaultCustomerType || "retailer") as "distributor" | "retailer" | "wholesaler",
            warehouseId: "",
            account: wallets[0]?.id || "",
            cash: 0,
            credit: 0,
            creditReturnDate: "",
            expenses: 0,
            expensesDescription: "",
            remarks: "",
            items: [blankItem()],
        },
        onSubmit: async ({ value }) => {
            const unfilledItems = value.items.filter((item) => !item.recipeId);
            if (unfilledItems.length > 0) {
                toast.error("All invoice lines must have a product selected.");
                return;
            }

            const totalAmount = computeTotal(value.items, availableStock);
            const expenses = Number(value.expenses) || 0;
            const totalPayable = totalAmount + expenses;
            const cashPaid = Number(value.cash) || 0;

            if (cashPaid > totalPayable && totalPayable > 0) {
                toast.error(`Cash received (${PKR(cashPaid)}) cannot exceed total payable (${PKR(totalPayable)}).`);
                return;
            }

            const credit = Math.max(0, totalPayable - cashPaid);
            if (credit > 0 && !value.creditReturnDate) {
                toast.error("Please set a credit due date when credit remains.");
                return;
            }

            try {
                const payload = {
                    ...value,
                    customerName: customerMode === "existing" ? undefined : (value.customerName || undefined),
                    customerMobile: customerMode === "existing" ? undefined : (value.customerMobile || undefined),
                    customerCnic: customerMode === "existing" ? undefined : (value.customerCnic || undefined),
                    customerCity: customerMode === "existing" ? undefined : (value.customerCity || undefined),
                    customerState: customerMode === "existing" ? undefined : (value.customerState || undefined),
                    customerBankAccount: customerMode === "existing" ? undefined : (value.customerBankAccount || undefined),
                    customerId: customerMode === "existing" ? value.customerId : undefined,
                    warehouseId: activeWarehouse,
                    credit,
                    expenses,
                    expensesDescription: value.expensesDescription || undefined,
                    remarks: value.remarks || undefined,
                    creditReturnDate: value.creditReturnDate ? new Date(value.creditReturnDate) : undefined,
                };

                if (initialData) {
                    await updateInvoice({ ...payload, id: initialData.id } as never);
                } else {
                    const validatedData = createInvoiceSchema.parse(payload);
                    await createInvoice(validatedData as any);
                }
                form.reset();
                onSuccess();
            } catch (error: unknown) {
                if (error instanceof z.ZodError) {
                    const friendlyMessages = error.issues.map((issue) => {
                        const path = issue.path.join(".");
                        const fieldLabels: Record<string, string> = {
                            customerId: "Customer",
                            customerName: "Customer name",
                            warehouseId: "Warehouse",
                            account: "Payment account",
                            creditReturnDate: "Credit return date",
                        };
                        const itemMatch = path.match(/^items\[(\d+)\]\.(\w+)$/);
                        if (itemMatch) {
                            const itemNum = Number(itemMatch[1]) + 1;
                            const field = itemMatch[2];
                            const labelMap: Record<string, string> = {
                                recipeId: "Product",
                                hsnCode: "HSN code",
                                perCartonPrice: "Price per carton",
                                retailPrice: "Retail price (MRP)",
                                pack: "Product name",
                            };
                            return `Item #${itemNum}: ${labelMap[field] ?? field} — ${issue.message}`;
                        }
                        return `${fieldLabels[path] ?? path} — ${issue.message}`;
                    });
                    toast.error("Please fix the following:\n" + friendlyMessages.join("\n"));
                } else {
                    toast.error((error instanceof Error ? error.message : "Something went wrong. Please try again."));
                }
            }
        },
    });

    useEffect(() => {
        form.setFieldValue("warehouseId", activeWarehouse);
    }, [activeWarehouse, form]);

    useEffect(() => {
        if (wallets.length > 0 && !form.getFieldValue("account")) {
            form.setFieldValue("account", wallets[0].id);
        }
    }, [wallets, form]);

    useEffect(() => {
        if (isDistributorLocked) return;
        if (customerMode === "new") {
            form.setFieldValue("customerId", "");
        } else {
            form.setFieldValue("customerName", "");
            form.setFieldValue("customerMobile", "");
            form.setFieldValue("customerCnic", "");
            form.setFieldValue("customerCity", "");
            form.setFieldValue("customerState", "");
            form.setFieldValue("customerBankAccount", "");
            form.setFieldValue("customerType", defaultCustomerType || "retailer");
        }
    }, [customerMode, form, isDistributorLocked, defaultCustomerType]);

    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    }, []);

    const selectedCustomerId = useStore(form.store, (s) => s.values.customerId);
    const selectedCustomerData = useMemo(() => {
        if (!selectedCustomerId || !customers) return null;
        return customers.find((c: any) => c.id === selectedCustomerId) || null;
    }, [selectedCustomerId, customers]);

    const { data: distributorDiscountRules } = useGetDistributorDiscountRules(
        isDistributorLocked ? selectedCustomerId : "",
        isDistributorLocked && !!selectedCustomerId,
    );

    // Build a map of recipeId → discount rule for fast lookup
    const discountRuleMap = useMemo(() => {
        const map = new Map<string, any>();
        if (!distributorDiscountRules) return map;
        for (const rule of distributorDiscountRules) {
            map.set(rule.recipeId, rule);
        }
        return map;
    }, [distributorDiscountRules]);

    return (
        <form
            onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); form.handleSubmit(); }}
            className="space-y-5 pb-12 mt-2"
        >
            {onDirtyChange && <DirtyStateNotifier form={form} onDirtyChange={onDirtyChange} />}

            <FieldGroup>
                <Section icon={Warehouse} title={isDistributorLocked ? "Distributor" : "Customer"} subtitle={isDistributorLocked ? "Select a pre-configured distributor" : "Who is this invoice for?"} step={1}>
                    {!isDistributorLocked && <ModeToggle value={customerMode} onChange={setCustomerMode} />}
                    {customerMode === "existing" || isDistributorLocked ? (
                        <form.Field
                            name="customerId"
                            validators={{
                                onChange: z.string().min(1, isDistributorLocked ? "Please select a distributor" : "Please select a customer"),
                                onSubmit: z.string().min(1, isDistributorLocked ? "Please select a distributor" : "Please select a customer"),
                            }}
                        >
                            {(field) => (
                                <Field>
                                    <FieldLabel>{isDistributorLocked ? "Select Distributor" : "Select Customer"} <span className="text-destructive">*</span></FieldLabel>
                                    <Select value={field.state.value} onValueChange={field.handleChange}>
                                        <SelectTrigger className={cn("h-10", !field.state.value && field.state.meta.isTouched && "border-destructive")}>
                                            <SelectValue placeholder={isDistributorLocked ? "Choose a distributor…" : "Choose a customer…"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                             {filteredCustomers.map((customer: { id: string; name: string; customerType?: string; defaultMargin?: string | number | null }) => (
                                                <SelectItem key={customer.id} value={customer.id}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{customer.name}</span>
                                                        {isDistributorLocked && customer.defaultMargin != null && Number(customer.defaultMargin) > 0 && (
                                                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 gap-0.5">
                                                                <Percent className="size-2.5" />
                                                                {customer.defaultMargin}%
                                                            </Badge>
                                                        )}
                                                        {!isDistributorLocked && (
                                                            <Badge variant="secondary" className="text-[9px] capitalize px-1.5 py-0 h-4">{customer.customerType}</Badge>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FieldError errors={field.state.meta.errors} />
                                </Field>
                            )}
                        </form.Field>
                    ) : null}
                    {isDistributorLocked && selectedCustomerData && (
                        <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-border/60 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
                                <Info className="size-3.5" />
                                Distributor Pricing Info
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex items-center gap-1.5 text-xs">
                                    <Percent className="size-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Default Margin:</span>
                                    <span className="font-semibold">{selectedCustomerData.defaultMargin || 0}%</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs">
                                    <FileText className="size-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Discount Rules:</span>
                                    <span className="font-semibold">{distributorDiscountRules?.length || 0}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    {!isDistributorLocked && customerMode === "new" && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <form.Field name="customerName">
                                    {(field) => (
                                        <Field>
                                            <FieldLabel><Warehouse className="size-3 mr-1 inline" /> Name <span className="text-destructive">*</span></FieldLabel>
                                            <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="e.g. Hamza Traders" className={cn(field.state.meta.errors.length > 0 && "border-destructive")} />
                                            <FieldError errors={field.state.meta.errors} />
                                        </Field>
                                    )}
                                </form.Field>
                                <form.Field name="customerMobile">
                                    {(field) => (
                                        <Field>
                                            <FieldLabel><Phone className="size-3 mr-1 inline" /> Mobile <span className="ml-1 text-[10px] text-muted-foreground font-normal">(optional)</span></FieldLabel>
                                            <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="03xx-xxxxxxx" />
                                        </Field>
                                    )}
                                </form.Field>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <form.Field name="customerCnic">
                                    {(field) => (
                                        <Field>
                                            <FieldLabel><BadgeCheck className="size-3 mr-1 inline" /> CNIC <span className="ml-1 text-[10px] text-muted-foreground font-normal">(optional)</span></FieldLabel>
                                            <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="xxxxx-xxxxxxx-x" />
                                        </Field>
                                    )}
                                </form.Field>
                                <form.Field name="customerCity">
                                    {(field) => (
                                        <Field>
                                            <FieldLabel><MapPin className="size-3 mr-1 inline" /> City</FieldLabel>
                                            <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="Lahore" />
                                        </Field>
                                    )}
                                </form.Field>
                                <form.Field name="customerState">
                                    {(field) => (
                                        <Field>
                                            <FieldLabel>Province</FieldLabel>
                                            <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="Punjab" />
                                        </Field>
                                    )}
                                </form.Field>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <form.Field name="customerBankAccount">
                                    {(field) => (
                                        <Field>
                                            <FieldLabel><BanknoteIcon className="size-3 mr-1 inline" /> Bank / Wallet</FieldLabel>
                                            <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="IBAN or EasyPaisa / JazzCash" />
                                        </Field>
                                    )}
                                </form.Field>
                                <form.Field name="customerType">
                                    {(field) => (
                                        <Field>
                                            <FieldLabel>Customer Type</FieldLabel>
                                            <Select value={field.state.value} onValueChange={(v: any) => field.handleChange(v)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="retailer">Retailer</SelectItem>
                                                    <SelectItem value="wholesaler">Wholesaler</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                    )}
                                </form.Field>
                            </div>
                        </div>
                    )}
                </Section>

                <Section icon={Warehouse} title="Dispatch Settings" subtitle="Source warehouse and deposit account" step={2}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <form.Field name="warehouseId">
                            {(field) => (
                                <Field>
                                    <FieldLabel>Source Warehouse <span className="text-destructive">*</span></FieldLabel>
                                    <Select value={activeWarehouse} onValueChange={(val: any) => { setActiveWarehouse(val); field.handleChange(val); }}>
                                        <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                                        <SelectContent>
                                             {warehouses.map((warehouse: { id: string; name: string; finishedGoodsStock?: unknown[] }) => (
                                                <SelectItem key={warehouse.id} value={warehouse.id}>
                                                    <div className="flex items-center gap-2">
                                                        <Warehouse className="size-3 text-muted-foreground" />
                                                        <span>{warehouse.name}</span>
                                                        {(warehouse.finishedGoodsStock?.length ?? 0) > 0 && <Badge variant="secondary" className="text-[9px] px-1.5 h-4">{warehouse.finishedGoodsStock?.length ?? 0} SKUs</Badge>}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FieldDescription>Stock will be deducted from here.</FieldDescription>
                                    <FieldError errors={field.state.meta.errors} />
                                </Field>
                            )}
                        </form.Field>

                        <form.Field name="account">
                            {(field) => (
                                <Field>
                                    <FieldLabel>Deposit Account <span className="text-destructive">*</span></FieldLabel>
                                    <Select value={field.state.value} onValueChange={field.handleChange}>
                                        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                                        <SelectContent>
                                             {wallets.map((wallet: { id: string; name: string; type?: string }) => (
                                                <SelectItem key={wallet.id} value={wallet.id}>
                                                    <span className="flex items-center gap-2">
                                                        {wallet.type === "bank" ? <Building2Icon className="size-3.5 text-blue-500" /> : <BanknoteIcon className="size-3.5 text-emerald-500" />}
                                                        {wallet.name}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FieldDescription>Cash payments will be credited here.</FieldDescription>
                                    <FieldError errors={field.state.meta.errors} />
                                </Field>
                            )}
                        </form.Field>
                    </div>
                </Section>

                <form.Subscribe selector={(s) => s.values}>
                    {(values) => {
                        const items: ItemFormValue[] = values.items || [];
                        const expenses = Number(values.expenses) || 0;
                        const cashPaid = Number(values.cash) || 0;
                        const totalAmount = computeTotal(items, availableStock);
                        const totalPayable = totalAmount + expenses;
                        const totalCredit = Math.max(0, totalPayable - cashPaid);
                        const cashExceedsTotal = cashPaid > totalPayable && totalPayable > 0;
                        const isFullyPaid = totalCredit === 0 && cashPaid > 0;

                        return (
                            <div className="space-y-5">
                                <Section
                                    icon={AlertCircle}
                                    title="Invoice Items"
                                    subtitle="Products being sold in this invoice"
                                    step={3}
                                    action={!activeWarehouse ? <p className="text-[11px] text-amber-600 flex items-center gap-1"><AlertCircle className="size-3" /> Select a warehouse first</p> : null}
                                >
                                    <InvoiceItemsSection
                                        form={form}
                                        items={items}
                                        availableStock={availableStock}
                                        activeWarehouse={activeWarehouse}
                                        totalAmount={totalAmount}
                                        getCartonInfo={getCartonInfo}
                                        handleFocus={handleFocus}
                                        recipePriceMap={recipePriceMap}
                                        discountRuleMap={discountRuleMap}
                                        isDistributor={isDistributorLocked}
                                    />
                                </Section>

                                <SettlementSection
                                    form={form}
                                    totalAmount={totalAmount}
                                    expenses={expenses}
                                    totalPayable={totalPayable}
                                    cashPaid={cashPaid}
                                    totalCredit={totalCredit}
                                    cashExceedsTotal={cashExceedsTotal}
                                    isFullyPaid={isFullyPaid}
                                    handleFocus={handleFocus}
                                />
                            </div>
                        );
                    }}
                </form.Subscribe>

                <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
                    {([canSubmit, isSubmitting]: any) => (
                        <div className="sticky bottom-0 bg-background/90 backdrop-blur-md border-t px-4 py-3 -mx-1 rounded-b-xl">
                            {!canSubmit && !isSubmitting && (
                                <div className="mb-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                                    <p className="text-xs text-destructive font-medium flex items-center gap-1.5">
                                        <AlertCircle className="size-3.5 shrink-0" />
                                        Please fix validation errors above before generating the invoice.
                                    </p>
                                </div>
                            )}
                            <div className="flex items-center justify-between gap-3 max-w-full">
                                <p className="text-xs text-muted-foreground hidden sm:block">Please verify all entries before generating the invoice.</p>
                                <div className="flex gap-2.5 ml-auto">
                                    <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isPending} className="min-w-24">
                                        Cancel
                                    </Button>
                                    <Button type="submit" size="lg" disabled={isPending} className="min-w-40 gap-2 font-bold">
                                        {isPending ? <><Loader2 className="size-4 animate-spin" /> Processing…</> : <><ChevronRight className="size-4" /> Generate Invoice</>}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </form.Subscribe>
            </FieldGroup>
        </form>
    );
};

function computeTotal(items: ItemFormValue[], availableStock: StockItem[]): number {
    return items.reduce((acc, item) => {
        const stock = findStock(availableStock, item.recipeId);
        const recipeDefault = stock?.recipe?.containersPerCarton || 1;
        const eCPP = safeEffectiveCPP(recipeDefault);
        return acc + (item.unitType === "carton"
            ? (item.numberOfCartons || 0) * (item.perCartonPrice || 0)
            : (item.numberOfUnits || 0) * ((item.perCartonPrice || 0) / eCPP));
    }, 0);
}
