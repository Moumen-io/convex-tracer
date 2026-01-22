import { CompleteTrace } from "convex-tracer";
import { StatusBadge } from "./badges";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";

interface SpanCardProps {
  span: CompleteTrace["spans"][number];
  onClick: () => void;
}

export function SpanCard({ span, onClick }: SpanCardProps) {
  const childrenLength = span.children?.length ?? 0;

  const getErrorMessage = (error: any) => {
    try {
      return JSON.stringify(JSON.parse(error), null, 2);
    } catch (e) {
      return error;
    }
  };

  return (
    <Card
      key={span._id}
      className="cursor-pointer hover:bg-muted/50"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="font-semibold">{span.spanName}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{span.source}</Badge>
              <StatusBadge status={span.status} />
              <span>{span.duration ?? 0}ms</span>
              <span className="text-xs text-muted-foreground">
                {`${childrenLength} child${childrenLength !== 1 ? "ren" : ""}`}
              </span>
            </div>
            {span.functionName && (
              <div className="text-xs font-mono text-muted-foreground">
                {span.functionName}
              </div>
            )}
            {span.error && (
              <div className="text-xs text-destructive mt-1">
                {getErrorMessage(span.error)}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
