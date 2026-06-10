import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBradfordSnapshotHistoryFn } from "@/server-functions/hr/payroll/bradford-snapshot-fn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Camera, AlertTriangle, CheckCircle } from "lucide-react";

interface BradfordSnapshotViewerProps {
  employeeId: string;
}

export function BradfordSnapshotViewer({ employeeId }: BradfordSnapshotViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: snapshots, isLoading } = useQuery({
    queryKey: ["bradford-snapshots", employeeId],
    queryFn: () => getBradfordSnapshotHistoryFn({ data: { employeeId } }),
    enabled: isOpen,
  });

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <Camera className="w-4 h-4 mr-2" />
        Bradford Archive
      </Button>
    );
  }

  const getBradfordColor = (score: number) => {
    if (score < 50) return "bg-emerald-600";
    if (score < 100) return "bg-amber-600";
    return "bg-red-600";
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Bradford Factor Snapshots</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          Close
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !snapshots || snapshots.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="w-4 h-4" />
            <span>No snapshots yet. Snapshots are created when a payroll is approved.</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Bradford</TableHead>
                <TableHead>Absences</TableHead>
                <TableHead>Sick</TableHead>
                <TableHead>Annual</TableHead>
                <TableHead>Late</TableHead>
                <TableHead>Early</TableHead>
                <TableHead>Unmarked</TableHead>
                <TableHead>Night</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((snap) => {
                const bradford = parseFloat(snap.bradfordFactor as string);
                return (
                  <TableRow key={snap.id}>
                    <TableCell className="text-xs font-medium">
                      {snap.snapshotYearMonth}
                      {snap.payroll?.status === "paid" && (
                        <CheckCircle className="w-3 h-3 inline ml-1 text-emerald-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${getBradfordColor(bradford)}`}>
                        {bradford.toFixed(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{snap.totalAbsences}</TableCell>
                    <TableCell className="text-xs">{snap.totalSickLeaves}</TableCell>
                    <TableCell className="text-xs">{snap.totalAnnualLeaves}</TableCell>
                    <TableCell className="text-xs">{snap.totalLateArrivals}</TableCell>
                    <TableCell className="text-xs">{snap.totalEarlyDepartures}</TableCell>
                    <TableCell className="text-xs text-amber-600">
                      {snap.unmarkedDaysAtClose > 0 ? snap.unmarkedDaysAtClose : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{snap.nightShiftsCount}</TableCell>
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
