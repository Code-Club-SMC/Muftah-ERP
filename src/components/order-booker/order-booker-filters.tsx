import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/custom/date-range-picker";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

type FilterConfig = {
  showSearch?: boolean;
  showStatus?: boolean;
  showDateRange?: boolean;
  showVehicleType?: boolean;
  statusOptions?: { label: string; value: string }[];
  vehicleTypeOptions?: { label: string; value: string }[];
  searchPlaceholder?: string;
};

type Props = {
  config?: FilterConfig;
  search?: string;
  onSearchChange?: (value: string) => void;
  status?: string;
  onStatusChange?: (value: string) => void;
  dateRange?: DateRange | undefined;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  vehicleType?: string;
  onVehicleTypeChange?: (value: string) => void;
  onClear?: () => void;
  className?: string;
};

const defaultStatusOptions = [
  { label: "All Statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Delivered", value: "delivered" },
  { label: "Returned", value: "returned" },
];

const commissionStatusOptions = [
  { label: "All Statuses", value: "all" },
  { label: "Accrued", value: "accrued" },
  { label: "Paid", value: "paid" },
  { label: "Reversed", value: "reversed" },
];

const vehicleTypeOptions = [
  { label: "All Vehicles", value: "all" },
  { label: "Own Vehicle", value: "own" },
  { label: "Company Vehicle", value: "company" },
];

export const OrderBookerFilters = ({
  config = {},
  search,
  onSearchChange,
  status,
  onStatusChange,
  dateRange,
  onDateRangeChange,
  vehicleType,
  onVehicleTypeChange,
  onClear,
  className,
}: Props) => {
  const {
    showSearch = true,
    showStatus = true,
    showDateRange = true,
    showVehicleType = false,
    statusOptions = defaultStatusOptions,
    searchPlaceholder = "Search…",
  } = config;

  const hasActiveFilters =
    (search && search.length > 0) ||
    (status && status !== "all") ||
    (dateRange?.from || dateRange?.to) ||
    (vehicleType && vehicleType !== "all");

  return (
    <div className={cn("flex items-center gap-3 flex-wrap", className)}>
      {showSearch && onSearchChange && (
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 pl-8 text-xs"
          />
        </div>
      )}

      {showStatus && onStatusChange && (
        <Select
          value={status || "all"}
          onValueChange={onStatusChange}
        >
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showVehicleType && onVehicleTypeChange && (
        <Select
          value={vehicleType || "all"}
          onValueChange={onVehicleTypeChange}
        >
          <SelectTrigger className="h-9 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {vehicleTypeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showDateRange && onDateRangeChange && (
        <DatePickerWithRange
          date={dateRange}
          onDateChange={onDateRangeChange}
          className="h-9"
        />
      )}

      {hasActiveFilters && onClear && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-9 text-xs text-muted-foreground"
        >
          <X className="size-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
};

export { defaultStatusOptions, commissionStatusOptions, vehicleTypeOptions };
export type { FilterConfig };
