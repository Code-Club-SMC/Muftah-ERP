import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, Truck } from "lucide-react";

type Props = {
  status: string;
  className?: string;
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; variant: any; label: string }> = {
  pending: { icon: <Clock className="size-3 mr-1" />, variant: "outline", label: "Pending" },
  confirmed: { icon: <CheckCircle2 className="size-3 mr-1" />, variant: "secondary", label: "Confirmed" },
  delivered: { icon: <Truck className="size-3 mr-1" />, variant: "default", label: "Delivered" },
  returned: { icon: <AlertCircle className="size-3 mr-1" />, variant: "destructive", label: "Returned" },
  accrued: { icon: <Clock className="size-3 mr-1" />, variant: "outline", label: "Accrued" },
  paid: { icon: <CheckCircle2 className="size-3 mr-1" />, variant: "default", label: "Paid" },
  reversed: { icon: <AlertCircle className="size-3 mr-1" />, variant: "destructive", label: "Reversed" },
};

export const OrderStatusBadge = ({ status, className }: Props) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <Badge variant={config.variant} className={`text-[10px] gap-0.5 capitalize ${className || ""}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
};
