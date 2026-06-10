import { useNavigate } from "@tanstack/react-router";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2, HandCoins, AlertTriangle, ShieldAlert, Undo2, Ban } from "lucide-react";
import { DataTable } from "@/components/custom/data-table";
import { getEmployeesFn } from "@/server-functions/hr/employees/get-employees-fn";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { EditEmployeeDialog } from "./edit-employee-dialog";
import {
  useDeleteEmployee,
  useApproveEmployeeDeletion,
  useCancelEmployeeDeletion
} from "@/hooks/hr/use-delete-employee";
import { RequestAdvanceDialog } from "@/components/hr/advances/request-advance-dialog";
import { ResponsiveDialog } from "@/components/custom/responsive-dialog";

type Employee = Awaited<ReturnType<typeof getEmployeesFn>>[0];

type Props = {
  data: Employee[];
};

export const EmployeesTable = ({ data }: Props) => {
  const navigate = useNavigate();
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [advanceEmployeeId, setAdvanceEmployeeId] = useState<string | null>(null);

  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  const deleteMutate = useDeleteEmployee();
  const cancelMutate = useCancelEmployeeDeletion();

  const columns: ColumnDef<Employee>[] = [
    {
      accessorKey: "employeeCode",
      header: "Code",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.employeeCode}</span>
      ),
    },
    {
      accessorKey: "firstName",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.firstName} {row.original.lastName}
        </span>
      ),
    },
    {
      accessorKey: "designation",
      header: "Job Title",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{row.original.designation}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.department}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "basicSalary",
      header: "Basic Salary",
      cell: ({ row }) => (
        <div className="text-right font-medium">
          PKR {parseFloat(row.original.basicSalary || "0").toLocaleString()}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status as
          | "active"
          | "on_leave"
          | "terminated"
          | "resigned"
          | "pending_deletion";

        const statusStyles = {
          active: {
            label: "Active",
            class:
              "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 font-bold",
          },
          on_leave: {
            label: "On Leave",
            class:
              "bg-indigo-500/15 text-indigo-700 border-indigo-500/30 font-bold",
          },
          terminated: {
            label: "Terminated",
            class: "bg-rose-500/15 text-rose-700 border-rose-500/30 font-bold",
          },
          resigned: {
            label: "Resigned",
            class:
              "bg-amber-500/15 text-amber-700 border-amber-500/30 font-bold",
          },
          pending_deletion: {
            label: "Pending Deletion",
            class: "bg-rose-500/20 text-rose-600 border-rose-500/40 font-black animate-pulse",
          }
        };

        const config = statusStyles[status] || { label: status, class: "" };

        return (
          <Badge
            variant="outline"
            className={`px-2 py-0.5 text-[10px] uppercase tracking-wider ${config.class}`}
          >
            {config.label}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const employee = row.original;
        const isPendingDeletion = employee.status === "pending_deletion";

        return (
          <div
            className="flex justify-end gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              title="View Highlights"
              onClick={() => navigate({ to: `/hr/employees/${employee.id}` })}
            >
              <Eye className="size-4" />
            </Button>

            {!isPendingDeletion ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Request Advance"
                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-950/50"
                  onClick={() => setAdvanceEmployeeId(employee.id)}
                >
                  <HandCoins className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Edit Profile"
                  className="text-primary hover:text-primary hover:bg-primary/10"
                  onClick={() => setEditingEmployee(employee)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Mark for Deletion"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteConfirmationId(employee.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Restore Employee"
                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 underline decoration-dotted"
                  onClick={() => cancelMutate.mutate({ data: { id: employee.id } })}
                >
                  <Undo2 className="size-4" />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  const employeeToRequestDeletion = data.find(e => e.id === deleteConfirmationId);

  return (
    <>
      <DataTable
        pageSize={20}
        columns={columns}
        data={data}
        searchKey="firstName"
        searchPlaceholder="Filter employees..."
      />

      {editingEmployee && (
        <EditEmployeeDialog
          open={!!editingEmployee}
          onOpenChange={(open) => !open && setEditingEmployee(null)}
          employee={editingEmployee}
        />
      )}

      {!!advanceEmployeeId && (
        <RequestAdvanceDialog
          open={!!advanceEmployeeId}
          onOpenChange={(open) => !open && setAdvanceEmployeeId(null)}
          defaultEmployeeId={advanceEmployeeId}
        />
      )}

      {/* REQUEST DELETION DIALOG */}
      <ResponsiveDialog
        open={!!deleteConfirmationId}
        onOpenChange={(open) => !open && setDeleteConfirmationId(null)}
        title="Request Employee Deletion"
        description="Are you sure you want to request deletion for this employee?"
        icon={Trash2}
      >
        <div className="space-y-6 pt-2">
          <div className="p-4 bg-muted border rounded-lg flex items-center gap-4">
            <div className="bg-destructive/10 p-3 rounded-full">
              <ShieldAlert className="size-6 text-destructive" />
            </div>
            <div>
              <p className="font-bold text-sm">{employeeToRequestDeletion?.firstName} {employeeToRequestDeletion?.lastName}</p>
              <p className="text-xs text-muted-foreground">{employeeToRequestDeletion?.designation}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded text-xs text-amber-800 dark:text-amber-200">
            <p className="font-bold flex items-center gap-1.5 uppercase tracking-tight text-[10px]">
              <AlertTriangle className="size-3.5" /> Administrative Protocol
            </p>
            <p>This will move the employee to the <strong>Approval Center</strong>. A senior administrator must review and permanently wipe the data from there.</p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setDeleteConfirmationId(null)} disabled={deleteMutate.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmationId && deleteMutate.mutate({ data: { id: deleteConfirmationId } }, { onSuccess: () => setDeleteConfirmationId(null) })}
              disabled={deleteMutate.isPending}
            >
              Request Removal
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </>
  );
};

