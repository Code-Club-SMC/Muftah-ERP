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
import { useCreateMyTrip } from "@/hooks/sales/use-order-booker-self-service";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Loader2, Truck } from "lucide-react";
import { format } from "date-fns";

const createTripSchema = z.object({
  date: z.string().min(1, "Date is required"),
  areaVisited: z.string().min(1, "Area visited is required"),
  distanceKm: z.number().positive("Distance must be greater than 0"),
  vehicleType: z.enum(["own", "company"], { message: "Select a vehicle type" }),
  fuelCost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const CreateTripDialog = ({ open, onOpenChange }: Props) => {
  const mutation = useCreateMyTrip();
  const [vehicleType, setVehicleType] = useState<"own" | "company">("own");

  const form = useForm({
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      areaVisited: "",
      distanceKm: 0,
      vehicleType: "own" as "own" | "company",
      fuelCost: 0,
      notes: "",
    },
    validators: {},
    onSubmit: async ({ value }) => {
      const result = createTripSchema.safeParse(value);
      if (!result.success) {
        toast.error(result.error.issues[0].message);
        return;
      }
      try {
        await mutation.mutateAsync({
          data: {
            date: result.data.date,
            areaVisited: result.data.areaVisited,
            distanceKm: result.data.distanceKm,
            vehicleType: result.data.vehicleType,
            fuelCost: result.data.vehicleType === "own" ? result.data.fuelCost : undefined,
            notes: result.data.notes || undefined,
          },
        });
        onOpenChange(false);
      } catch (err: any) {
        toast.error(err.message || "Failed to log trip");
      }
    },
  });

  useEffect(() => {
    if (open) {
      form.reset();
      form.setFieldValue("date", format(new Date(), "yyyy-MM-dd"));
      form.setFieldValue("vehicleType", "own");
      setVehicleType("own");
    }
  }, [open, form]);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Log Trip"
      description="Record a field trip for TADA and expense tracking"
      icon={Truck}
      className="max-w-md"
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
            name="date"
            validators={{
              onChange: z.string().min(1, "Date is required"),
            }}
          >
            {(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel>Date *</FieldLabel>
                <Input
                  type="date"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field
            name="areaVisited"
            validators={{
              onChange: z.string().min(1, "Area visited is required"),
            }}
          >
            {(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel>Area Visited *</FieldLabel>
                <Input
                  placeholder="e.g. Gulberg, Lahore"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field
              name="distanceKm"
              validators={{
                onChange: ({ value }) => {
                  if (!value || Number(value) <= 0) return "Must be > 0 km";
                  return undefined;
                },
              }}
            >
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel>Distance (km) *</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                    onBlur={field.handleBlur}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <form.Field name="vehicleType">
              {(field) => (
                <Field>
                  <FieldLabel>Vehicle *</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(v: any) => {
                      field.handleChange(v);
                      setVehicleType(v as "own" | "company");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="own">Own Vehicle</SelectItem>
                      <SelectItem value="company">Company Vehicle</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
          </div>

          {vehicleType === "own" && (
            <form.Field name="fuelCost">
              {(field) => (
                <Field>
                  <FieldLabel>Fuel Cost (PKR)</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                  />
                </Field>
              )}
            </form.Field>
          )}

          <form.Field name="notes">
            {(field) => (
              <Field>
                <FieldLabel>Notes</FieldLabel>
                <Textarea
                  placeholder="Trip details…"
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
                Log Trip
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </ResponsiveDialog>
  );
};
