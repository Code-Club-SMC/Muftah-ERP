import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSalesPerformanceLogsFn } from "@/server-functions/hr/payroll/sales-performance-fn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPKR } from "@/lib/currency-format";
import { BarChart3, Trophy, Package, ShoppingCart } from "lucide-react";

interface SalesPerformanceDashboardProps {
  employeeId: string;
}

export function SalesPerformanceDashboard({ employeeId }: SalesPerformanceDashboardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: logs, isLoading } = useQuery({
    queryKey: ["sales-performance", employeeId],
    queryFn: () => getSalesPerformanceLogsFn({ data: { employeeId, limit: 24 } }),
    enabled: isOpen,
  });

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <BarChart3 className="w-4 h-4 mr-2" />
        Performance
      </Button>
    );
  }

  const latest = logs?.[0];

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Sales Performance</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          Close
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !logs || logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No performance data yet. Data is logged during payroll creation.</p>
        ) : (
          <>
            {latest && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <ShoppingCart className="w-3 h-3" />
                    Orders
                  </div>
                  <div className="text-lg font-bold">{latest.fulfilledOrders}/{latest.totalOrders}</div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Package className="w-3 h-3" />
                    Invoices
                  </div>
                  <div className="text-lg font-bold">{latest.totalInvoices}</div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Trophy className="w-3 h-3" />
                    Commission
                  </div>
                  <div className="text-lg font-bold">{formatPKR(parseFloat(latest.totalCommission as string))}</div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <BarChart3 className="w-3 h-3" />
                    Achievement
                  </div>
                  <div className="text-lg font-bold">{parseFloat(latest.achievementRate as string).toFixed(0)}%</div>
                </div>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Invoices</TableHead>
                  <TableHead>Sales Value</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Achievement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-medium">{log.yearMonth}</TableCell>
                    <TableCell className="text-xs">{log.fulfilledOrders}/{log.totalOrders}</TableCell>
                    <TableCell className="text-xs">{log.totalInvoices}</TableCell>
                    <TableCell className="text-xs">{formatPKR(parseFloat(log.totalSalesValue as string))}</TableCell>
                    <TableCell className="text-xs">{formatPKR(parseFloat(log.totalCommission as string))}</TableCell>
                    <TableCell>
                      <Badge variant={parseFloat(log.achievementRate as string) >= 100 ? "default" : "secondary"} className="text-xs">
                        {parseFloat(log.achievementRate as string).toFixed(0)}%
                      </Badge>
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
