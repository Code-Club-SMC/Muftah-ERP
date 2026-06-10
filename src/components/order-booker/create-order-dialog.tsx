import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/custom/responsive-dialog";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import {
  Field,
  FieldGroup,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { getProductsFn } from "@/server-functions/sales/sales-config-fn";
import { useCreateMyOrder } from "@/hooks/sales/use-order-booker-self-service";
import { z } from "zod";
import { useEffect } from "react";
import { Loader2, ShoppingCart, Plus, Trash2 } from "lucide-react";

const orderItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  unitType: z.enum(["full_carton", "half_carton", "pack", "shopper"]).default("full_carton"),
  quantity: z.number().int().positive("Quantity must be greater than 0"),
  rate: z.number().nonnegative("Rate must be non-negative"),
});

const createOrderFormSchema = z.object({
  shopkeeperName: z.string().min(1, "Shopkeeper name is required"),
  shopkeeperMobile: z.string().optional(),
  shopkeeperAddress: z.string().optional(),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const CreateOrderDialog = ({ open, onOpenChange }: Props) => {
  const mutation = useCreateMyOrder();

  const { data: products } = useQuery({
    queryKey: ["products", "select"],
    queryFn: () => getProductsFn(),
    staleTime: 5 * 60_000,
  });

  const form = useForm({
    defaultValues: {
      shopkeeperName: "",
      shopkeeperMobile: "",
      shopkeeperAddress: "",
      items: [
        { productId: "", unitType: "full_carton" as const, quantity: 1, rate: 0 },
      ],
      notes: "",
    },
    validators: {},
    onSubmit: async ({ value }) => {
      const result = createOrderFormSchema.safeParse(value);
      if (!result.success) {
        const firstError = result.error.issues[0];
        toast.error(firstError.message);
        return;
      }
      try {
        await mutation.mutateAsync({
          data: {
            orderBookerId: "",
            shopkeeperName: result.data.shopkeeperName,
            shopkeeperMobile: result.data.shopkeeperMobile || undefined,
            shopkeeperAddress: result.data.shopkeeperAddress || undefined,
            items: result.data.items.map((item) => ({
              productId: item.productId,
              unitType: item.unitType,
              quantity: item.quantity,
              rate: item.rate,
            })),
            notes: result.data.notes || undefined,
          },
        });
        onOpenChange(false);
      } catch (err: any) {
        toast.error(err.message || "Failed to create order");
      }
    },
  });

  const itemCount = form.getFieldValue("items")?.length ?? 1;

  useEffect(() => {
    if (open) {
      form.reset();
    }
  }, [open, form]);

  const addItem = () => {
    if (itemCount >= 10) return;
    form.pushFieldValue("items", { productId: "", unitType: "full_carton", quantity: 1, rate: 0 });
  };

  const removeItem = (index: number) => {
    form.removeFieldValue("items", index);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create Order"
      description="Place a new order for a shopkeeper"
      icon={ShoppingCart}
      className="max-w-lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="pt-2"
      >
        <FieldGroup>
          <form.Field
            name="shopkeeperName"
            validators={{
              onChange: z.string().min(1, "Shopkeeper name is required"),
            }}
          >
            {(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel>Shopkeeper Name *</FieldLabel>
                <Input
                  placeholder="e.g. Hamza Traders"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="shopkeeperMobile">
              {(field) => (
                <Field>
                  <FieldLabel>Mobile</FieldLabel>
                  <Input
                    placeholder="03xx-xxxxxxx"
                    value={field.state.value || ""}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="shopkeeperAddress">
              {(field) => (
                <Field>
                  <FieldLabel>Address</FieldLabel>
                  <Input
                    placeholder="City, Area"
                    value={field.state.value || ""}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Order Items
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                disabled={itemCount >= 10}
                className="h-7 text-xs"
              >
                <Plus className="size-3 mr-1" />
                Add Item
              </Button>
            </div>

            {Array.from({ length: itemCount }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">
                    Item #{index + 1}
                  </span>
                  {itemCount > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      className="size-6 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>

                <form.Field
                  name={`items[${index}].productId`}
                  validators={{
                    onChange: z.string().min(1, "Select a product"),
                  }}
                >
                  {(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0}>
                      <FieldLabel>Product *</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={field.handleChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product…" />
                        </SelectTrigger>
                        <SelectContent>
                          {(products || []).map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>

                <div className="grid grid-cols-3 gap-3">
                  <form.Field name={`items[${index}].unitType`}>
                    {(field) => (
                      <Field>
                        <FieldLabel>Unit Type</FieldLabel>
                        <Select
                          value={field.state.value}
                          onValueChange={(v: any) => field.handleChange(v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full_carton">Full Carton</SelectItem>
                            <SelectItem value="half_carton">Half Carton</SelectItem>
                            <SelectItem value="pack">Pack</SelectItem>
                            <SelectItem value="shopper">Shopper</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  </form.Field>

                  <form.Field
                    name={`items[${index}].quantity`}
                    validators={{
                      onChange: ({ value }) => {
                        if (!value || Number(value) < 1) return "Min 1";
                        return undefined;
                      },
                    }}
                  >
                    {(field) => (
                      <Field data-invalid={field.state.meta.errors.length > 0}>
                        <FieldLabel>Qty *</FieldLabel>
                        <Input
                          type="number"
                          min={1}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(Number(e.target.value))}
                        />
                        <FieldError errors={field.state.meta.errors} />
                      </Field>
                    )}
                  </form.Field>

                  <form.Field
                    name={`items[${index}].rate`}
                    validators={{
                      onChange: ({ value }) => {
                        if (Number(value) < 0) return "Must be >= 0";
                        return undefined;
                      },
                    }}
                  >
                    {(field) => (
                      <Field data-invalid={field.state.meta.errors.length > 0}>
                        <FieldLabel>Rate (PKR) *</FieldLabel>
                        <div className="relative">
                          <Input
                            type="number"
                            min={0}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(Number(e.target.value))}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
                            ₨
                          </span>
                        </div>
                        <FieldError errors={field.state.meta.errors} />
                      </Field>
                    )}
                  </form.Field>
                </div>
              </div>
            ))}
          </div>

          <form.Field name="notes">
            {(field) => (
              <Field>
                <FieldLabel>Notes</FieldLabel>
                <Textarea
                  placeholder="Additional notes…"
                  value={field.state.value || ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="min-h-[80px]"
                />
              </Field>
            )}
          </form.Field>
        </FieldGroup>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                disabled={!canSubmit || isSubmitting || mutation.isPending}
              >
                {(isSubmitting || mutation.isPending) && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Create Order
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </ResponsiveDialog>
  );
};
