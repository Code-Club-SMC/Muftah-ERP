import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSalaryRevisionHistoryFn } from "@/server-functions/hr/payroll/salary-revisions-fn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Minus, History } from "lucide-react";

interface SalaryRevisionHistoryProps {
  employeeId: string;
}

export function SalaryRevisionHistory({ employeeId }: SalaryRevisionHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: revisions, isLoading } = useQuery({
    queryKey: ["salary-revisions", employeeId],
    queryFn: () => getSalaryRevisionHistoryFn({ data: { employeeId, limit: 50 } }),
    enabled: isOpen,
  });

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <History className="w-4 h-4 mr-2" />
        Salary History
      </Button>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Salary Revision History</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          Close
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !revisions || revisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No salary revisions recorded.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Allowances</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revisions.map((rev, idx) => {
                const prev = revisions[idx + 1];
                const currentSalary = parseFloat(rev.basicSalary as string);
                const prevSalary = prev ? parseFloat(prev.basicSalary as string) : currentSalary;
                const diff = currentSalary - prevSalary;
                const diffPercent = prevSalary > 0 ? ((diff / prevSalary) * 100).toFixed(1) : "0";

                return (
                  <TableRow key={rev.id}>
                    <TableCell className="text-xs">
                      {format(new Date(rev.revisionDate), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">
                      PKR {Math.round(currentSalary).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {diff === 0 ? (
                        <Badge variant="secondary" className="text-xs">
                          <Minus className="w-3 h-3 mr-1" />0%
                        </Badge>
                      ) : diff > 0 ? (
                        <Badge variant="default" className="text-xs bg-emerald-600">
                          <TrendingUp className="w-3 h-3 mr-1" />+{diffPercent}%
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          <TrendingDown className="w-3 h-3 mr-1" />{diffPercent}%
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {rev.allowanceConfig?.length
                        ? rev.allowanceConfig.map((a: any) => `${a.name}: PKR ${Math.round(a.amount).toLocaleString()}`).join(", ")
                        : "None"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={rev.reason}>
                      {rev.reason}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {rev.changedBy?.name || "System"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
