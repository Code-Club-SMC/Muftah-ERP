import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { simulatePayrollFn } from "@/server-functions/hr/payroll/payroll-fn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPKR } from "@/lib/currency-format";
import { Eye, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface PayrollSimulationPreviewProps {
  payrollId?: string;
  month?: string;
  onConfirm?: () => void;
}

export function PayrollSimulationPreview({ 
  payrollId, 
  month, 
  onConfirm 
}: PayrollSimulationPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  const simulationMutation = useMutation({
    mutationFn: () => simulatePayrollFn({ data: { payrollId, month } }),
  });

  const handleSimulate = () => {
    setIsOpen(true);
    simulationMutation.mutate();
  };

  const data = simulationMutation.data;

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleSimulate}>
        <Eye className="w-4 h-4 mr-2" />
        Preview Payroll
      </Button>

      {isOpen && (
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Payroll Simulation Preview</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </CardHeader>
          <CardContent>
            {simulationMutation.isPending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running simulation...</span>
              </div>
            ) : simulationMutation.isError ? (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4" />
                <span>Simulation failed: {simulationMutation.error.message}</span>
              </div>
            ) : data ? (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Employees</div>
                    <div className="text-lg font-bold">{data.successfulCount}/{data.totalEmployees}</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Total Net</div>
                    <div className="text-lg font-bold">{formatPKR(data.totalNetSalary)}</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Deficit</div>
                    <div className="text-lg font-bold text-amber-600">
                      {formatPKR(data.totalCarriedForwardDeficit)}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Errors</div>
                    <div className="text-lg font-bold text-red-600">{data.failedCount}</div>
                  </div>
                </div>

                {/* Simulation Results Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Basic</TableHead>
                      <TableHead>Gross</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.simulations.map((sim) => (
                      <TableRow key={sim.employee.id}>
                        <TableCell className="text-xs font-medium">
                          {sim.employee.firstName} {sim.employee.lastName}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatPKR(parseFloat(sim.calculation.basicSalary.toString()))}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatPKR(sim.calculation.grossSalary)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatPKR(sim.calculation.totalDeductions)}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {formatPKR(sim.totalNetWithArrears)}
                        </TableCell>
                        <TableCell>
                          {sim.carriedForwardDeficit > 0 ? (
                            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                              Deficit: {formatPKR(sim.carriedForwardDeficit)}
                            </Badge>
                          ) : (
                            <Badge variant="default" className="text-xs bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              OK
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.errors.map((err) => (
                      <TableRow key={err.employeeId} className="bg-red-50">
                        <TableCell className="text-xs font-medium">{err.employeeName}</TableCell>
                        <TableCell colSpan={4} className="text-xs text-red-600">
                          {err.error}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Error
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Confirm Button */}
                {onConfirm && data.successfulCount > 0 && (
                  <div className="mt-4 flex justify-end">
                    <Button onClick={onConfirm}>
                      Confirm & Generate Payslips
                    </Button>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      )}
    </>
  );
}
