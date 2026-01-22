import { Badge } from "./ui/badge";

type BadgeTypes = "default" | "destructive" | "secondary";

type Status = "success" | "error" | "pending";
export function StatusBadge({ status }: { status: Status }) {
  const variants: Record<Status, BadgeTypes> = {
    success: "default",
    error: "destructive",
    pending: "secondary",
  };
  return <Badge variant={variants[status]}>{status}</Badge>;
}

type Severity = "info" | "warn" | "error";
export function SeverityBadge({ severity }: { severity: Severity }) {
  const variants: Record<Severity, BadgeTypes> = {
    info: "default",
    warn: "secondary",
    error: "destructive",
  };
  return <Badge variant={variants[severity]}>{severity}</Badge>;
}
