import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { batchReimburseTadaFn, listPendingTadaReimbursementsFn } from "@/server-functions/hr/payroll/tada-reimbursement-fn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPKR } from "@/lib/currency-format";
import { format } from "date-fns";
import { Receipt, Wallet, CheckCircle2 } from "lucide-react";

interface TadaReimbursementBatchProps {
  expenseCategoryId: string;
  walletId: string;
}

export function TadaReimbursementBatch({ expenseCategoryId, walletId }: TadaReimbursementBatchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: pendingLogs } = useQuery({
    queryKey: ["pending-tada"],
    queryFn: () => listPendingTadaReimbursementsFn({ data: {} }),
    enabled: isOpen,
  });

  const reimburseMutation = useMutation({
    mutationFn: (payload: { travelLogIds: string[]; walletId: string; expenseCategoryId: string }) =>
      batchReimburseTadaFn({ data: payload }),
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["pending-tada"] });
    },
  });

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleReimburse = async () => {
    if (selectedIds.length === 0) return;
    reimburseMutation.mutate({
      travelLogIds: selectedIds,
      walletId,
      expenseCategoryId,
    });
  };

  const selectedTotal =
    pendingLogs
      ?.filter((log) => selectedIds.includes(log.id))
      .reduce((sum, log) => sum + parseFloat(log.totalAmount || "0"), 0) || 0;

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <Receipt className="w-4 h-4 mr-2" />
        TA/DA Reimbursement
      </Button>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">TA/DA Batch Reimbursement</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          Close
        </Button>
      </CardHeader>
      <CardContent>
        {!pendingLogs || pendingLogs.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>No pending TA/DA reimbursements. All approved travel logs have been reimbursed.</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm">
                <span className="font-medium">{selectedIds.length}</span> selected
                {selectedTotal > 0 && (
                  <span className="ml-2 text-muted-foreground">
                    Total: {formatPKR(selectedTotal)}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                disabled={selectedIds.length === 0 || reimburseMutation.isPending}
                onClick={handleReimburse}
              >
                <Wallet className="w-4 h-4 mr-2" />
                {reimburseMutation.isPending ? "Processing..." : "Reimburse Selected"}
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={
                        pendingLogs.length > 0 && selectedIds.length === pendingLogs.length
                      }
                      onCheckedChange={(checked) => {
                        setSelectedIds(checked ? pendingLogs.map((l) => l.id) : []);
                      }}
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>KM</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(log.id)}
                        onCheckedChange={() => toggleSelection(log.id)}
                      />
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(log.date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.employee?.firstName} {log.employee?.lastName}
                    </TableCell>
                    <TableCell className="text-xs">{log.destination}</TableCell>
                    <TableCell className="text-xs">{log.roundTripKm}</TableCell>
                    <TableCell className="text-xs">{log.rateApplied}</TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      {formatPKR(parseFloat(log.totalAmount || "0"))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
