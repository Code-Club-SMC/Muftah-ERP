import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { GenericLoader } from "@/components/custom/generic-loader";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  useGetSalesmen,
  useGetOrderBookers,
  useGetDistributors,
  useGetRetailers,
} from "@/hooks/sales/use-sales-people";
import { CustomerPagination } from "@/components/sales/customer-pagination";
import { BookOpen, Plus } from "lucide-react";
import { CreateDistributorDialog } from "@/components/sales/create-distributor-dialog";

const PKR = (v: number) =>
  `PKR ${v.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`;

export const Route = createFileRoute("/_protected/sales/people/")({
  component: SalesPeoplePage,
});

function SalesPeoplePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Sales People</h2>
        <p className="text-muted-foreground mt-1">
          Manage distributors, retailers, salesmen, and order bookers.
        </p>
      </div>
      <Separator />
      <Suspense fallback={<GenericLoader title="Loading Sales People" description="Fetching data..." />}>
        <SalesPeopleContent />
      </Suspense>
    </div>
  );
}

function SalesPeopleContent() {
  return (
    <Tabs defaultValue="distributors" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="distributors">Distributors</TabsTrigger>
        <TabsTrigger value="retailers">Retailers</TabsTrigger>
        <TabsTrigger value="salesmen">Salesmen</TabsTrigger>
        <TabsTrigger value="order-bookers">Order Bookers</TabsTrigger>
      </TabsList>

      <TabsContent value="distributors">
        <DistributorsTab />
      </TabsContent>

      <TabsContent value="retailers">
        <RetailersTab />
      </TabsContent>

      <TabsContent value="salesmen">
        <SalesmenTab />
      </TabsContent>

      <TabsContent value="order-bookers">
        <OrderBookersTab />
      </TabsContent>
    </Tabs>
  );
}

// ── Distributors Tab ──
function DistributorsTab() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const { data } = useGetDistributors(page, 20);
  const navigate = useNavigate();

  const distributors = data?.data || [];
  const total = data?.total || 0;
  const pageCount = data?.pageCount || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Distributors</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-1.5" />
          Add Distributor
        </Button>
      </div>

      <CreateDistributorDialog open={createOpen} onOpenChange={setCreateOpen} />

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Name</TableHead>
              <TableHead className="text-[11px]">Mobile</TableHead>
              <TableHead className="text-[11px]">City</TableHead>
              <TableHead className="text-[11px] text-right">Default Margin</TableHead>
              <TableHead className="text-[11px] text-right">Outstanding</TableHead>
              <TableHead className="text-[11px] w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!distributors.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-sm">
                  No distributors found.
                </TableCell>
              </TableRow>
            ) : (
              distributors.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm font-medium">{d.name}</TableCell>
                  <TableCell className="text-sm">{d.mobileNumber || "—"}</TableCell>
                  <TableCell className="text-sm">{d.city || "—"}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {Number(d.defaultMargin) > 0 ? `${d.defaultMargin}%` : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-right">
                    {Number(d.credit) > 0 ? (
                      <Badge variant="destructive" className="text-[10px] tabular-nums">
                        {PKR(Number(d.credit))}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-600 border-green-200 text-[10px]">
                        Clear
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() =>
                        navigate({ to: "/sales/people/distributors/$customerId", params: { customerId: d.id } })
                      }
                    >
                      <BookOpen className="size-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CustomerPagination
        page={page}
        pageCount={pageCount}
        total={total}
        limit={20}
        onPageChange={setPage}
      />
    </div>
  );
}

// ── Retailers Tab ──
function RetailersTab() {
  const [page, setPage] = useState(1);
  const { data } = useGetRetailers(page, 20);
  const navigate = useNavigate();

  const retailers = data?.data || [];
  const total = data?.total || 0;
  const pageCount = data?.pageCount || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Retailers</h3>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Name</TableHead>
              <TableHead className="text-[11px]">Mobile</TableHead>
              <TableHead className="text-[11px]">City</TableHead>
              <TableHead className="text-[11px] text-right">Total Sales</TableHead>
              <TableHead className="text-[11px] text-right">Outstanding</TableHead>
              <TableHead className="text-[11px] w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!retailers.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-sm">
                  No retailers found.
                </TableCell>
              </TableRow>
            ) : (
              retailers.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm font-medium">{r.name}</TableCell>
                  <TableCell className="text-sm">{r.mobileNumber || "—"}</TableCell>
                  <TableCell className="text-sm">{r.city || "—"}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">{PKR(Number(r.totalSale))}</TableCell>
                  <TableCell className="text-sm text-right">
                    {Number(r.credit) > 0 ? (
                      <Badge variant="destructive" className="text-[10px] tabular-nums">
                        {PKR(Number(r.credit))}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-600 border-green-200 text-[10px]">
                        Clear
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() =>
                        navigate({ to: "/sales/customers/$customerId", params: { customerId: r.id }, search: { page: 1 } })
                      }
                    >
                      <BookOpen className="size-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CustomerPagination
        page={page}
        pageCount={pageCount}
        total={total}
        limit={20}
        onPageChange={setPage}
      />
    </div>
  );
}

// ── Salesmen Tab ──
function SalesmenTab() {
  const { data: salesmen } = useGetSalesmen();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Salesmen</h3>
        <p className="text-sm text-muted-foreground">
          Create salesmen from <span className="font-medium text-foreground">HR → Employees → Add Employee</span> by checking "Is this employee a Salesman?"
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Name</TableHead>
              <TableHead className="text-[11px]">Phone</TableHead>
              <TableHead className="text-[11px]">Status</TableHead>
              <TableHead className="text-[11px] w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!salesmen?.length ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-10 text-sm">
                  No salesmen found.
                </TableCell>
              </TableRow>
            ) : (
              salesmen.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="text-sm font-medium">{s.name}</TableCell>
                  <TableCell className="text-sm">{s.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "active" ? "default" : "outline"} className="text-[10px]">
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() =>
                        navigate({ to: "/sales/people/salesmen/$salesmanId", params: { salesmanId: s.id } })
                      }
                    >
                      <BookOpen className="size-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Order Bookers Tab ──
function OrderBookersTab() {
  const { data: orderBookers } = useGetOrderBookers();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Order Bookers</h3>
        <p className="text-sm text-muted-foreground">
          Create order bookers from <span className="font-medium text-foreground">HR → Employees → Add Employee</span> by checking "Is this employee an Order Booker?"
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px]">Name</TableHead>
              <TableHead className="text-[11px]">Phone</TableHead>
              <TableHead className="text-[11px]">Area</TableHead>
              <TableHead className="text-[11px] text-right">Commission</TableHead>
              <TableHead className="text-[11px]">Status</TableHead>
              <TableHead className="text-[11px] w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!orderBookers?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-sm">
                  No order bookers found.
                </TableCell>
              </TableRow>
            ) : (
              orderBookers.map((ob: any) => (
                <TableRow key={ob.id}>
                  <TableCell className="text-sm font-medium">{ob.name}</TableCell>
                  <TableCell className="text-sm">{ob.phone || "—"}</TableCell>
                  <TableCell className="text-sm">{ob.assignedArea || "—"}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {Number(ob.commissionRate) > 0 ? `${ob.commissionRate}%` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ob.status === "active" ? "default" : "outline"} className="text-[10px]">
                      {ob.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() =>
                        navigate({ to: "/sales/people/order-bookers/$orderBookerId", params: { orderBookerId: ob.id } })
                      }
                    >
                      <BookOpen className="size-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
