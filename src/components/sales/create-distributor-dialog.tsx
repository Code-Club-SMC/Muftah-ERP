import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { useCreateCustomer } from "@/hooks/sales/use-sales-people";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateDistributorDialog({ open, onOpenChange }: Props) {
  const { mutateAsync: createCustomer, isPending } = useCreateCustomer();

  const form = useForm({
    defaultValues: {
      name: "",
      mobileNumber: "",
      cnic: "",
      address: "",
      city: "",
      state: "",
      bankAccount: "",
      defaultMargin: "",
    },
    onSubmit: async ({ value }) => {
      if (!value.name.trim()) {
        toast.error("Name is required");
        return;
      }
      try {
        await createCustomer({
          data: {
            name: value.name.trim(),
            mobileNumber: value.mobileNumber || undefined,
            cnic: value.cnic || undefined,
            address: value.address || undefined,
            city: value.city || undefined,
            state: value.state || undefined,
            bankAccount: value.bankAccount || undefined,
            customerType: "distributor" as const,
            defaultMargin: value.defaultMargin || undefined,
          },
        });
        toast.success("Distributor created successfully");
        form.reset();
        onOpenChange(false);
      } catch (err: any) {
        toast.error(err.message || "Failed to create distributor");
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Distributor</DialogTitle>
          <DialogDescription>
            Create a new distributor. You can configure price agreements and discount rules from their profile page.
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
          <form.Field
            name="name"
            validators={{
              onSubmit: ({ value }) =>
                !value.trim() ? "Name is required" : undefined,
            }}
          >
            {(field) => (
              <Field>
                <FieldLabel>Name *</FieldLabel>
                <Input
                  placeholder="Distributor name"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="mobileNumber">
              {(field) => (
                <Field>
                  <FieldLabel>Mobile Number</FieldLabel>
                  <Input
                    placeholder="03XX-XXXXXXX"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="cnic">
              {(field) => (
                <Field>
                  <FieldLabel>CNIC</FieldLabel>
                  <Input
                    placeholder="XXXXX-XXXXXXX-X"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>
          </div>

          <form.Field name="address">
            {(field) => (
              <Field>
                <FieldLabel>Address</FieldLabel>
                <Input
                  placeholder="Full address"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </Field>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="city">
              {(field) => (
                <Field>
                  <FieldLabel>City</FieldLabel>
                  <Input
                    placeholder="City"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="state">
              {(field) => (
                <Field>
                  <FieldLabel>State / Province</FieldLabel>
                  <Input
                    placeholder="State"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="bankAccount">
              {(field) => (
                <Field>
                  <FieldLabel>Bank Account</FieldLabel>
                  <Input
                    placeholder="Account number"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="defaultMargin">
              {(field) => (
                <Field>
                  <FieldLabel>Default Margin %</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="0.00"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            </form.Field>
          </div>

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
              Create Distributor
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
