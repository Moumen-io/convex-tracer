import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../convex/_generated/api";
import { StatusBadge } from "./components/badges";
import { FunctionSidebar } from "./components/function-sidebar";
import { TraceModal } from "./components/trace-modal";
import { Badge } from "./components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { ScrollArea } from "./components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table";
import { cn, formatTimestamp } from "./lib/utils";

import type { Trace } from "convex-tracer";

export default function TraceDemoView() {
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  // There is probably a better way
  // I just wanted a visual effect to demonstrate sampling

  const ts = useQuery(api.tracer.listTraces, { limit: 100 });

  const [displayTraces, setDisplayTraces] = useState<
    (Trace & { flashColor?: "green" | "red" })[]
  >([]);
  const prevIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!ts) return;

    const currentIds = new Set(ts.map((t) => t._id));
    const prevIds = prevIdsRef.current;

    // Start with current traces, marking new ones green
    const updated = ts.map((trace) => ({
      ...trace,
      flashColor: !prevIds.has(trace._id) ? ("green" as const) : undefined,
    }));

    // Add deleted traces marked red (keep them in their original position)
    displayTraces.forEach((trace) => {
      if (!currentIds.has(trace._id)) {
        const index = displayTraces.findIndex((t) => t._id === trace._id);
        // @ts-expect-error idk
        updated.splice(index, 0, { ...trace, flashColor: "red" as const });
      }
    });

    setDisplayTraces(updated);

    // Clear flash colors and remove deleted traces after animation
    const timeoutId = setTimeout(() => {
      setDisplayTraces(ts.map((t) => ({ ...t })));
    }, 500);

    prevIdsRef.current = currentIds;

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ts]);

  return (
    <>
      <div className="flex h-screen">
        {/* Main Content - Traces Table */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Convex Trace Monitor</h1>
            <p className="text-muted-foreground">
              Real-time traces, spans, and logs
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Traces</CardTitle>
              <CardDescription>Retention: 10 Seconds</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-250px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trace ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sample Rate</TableHead>
                      <TableHead>Updated At</TableHead>
                      <TableHead>Preserved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayTraces?.map((trace: any) => (
                      <TableRow
                        key={trace._id}
                        className={cn(
                          "cursor-pointer hover:bg-muted/50",
                          trace.flashColor === "green"
                            ? "flash-green"
                            : trace.flashColor === "red"
                              ? "flash-red"
                              : "",
                        )}
                        onClick={() => setSelectedTraceId(trace._id)}
                      >
                        <TableCell className="font-mono text-xs">
                          {trace._id}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={trace.status} />
                        </TableCell>
                        <TableCell>{trace.sampleRate * 100}%</TableCell>
                        <TableCell>
                          {formatTimestamp(trace.updatedAt)}
                        </TableCell>
                        <TableCell>
                          {typeof trace.preserve === "boolean" ? (
                            <Badge variant="secondary">{`${trace.preserve}`}</Badge>
                          ) : (
                            <span className="text-muted-foreground">
                              Sample
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <FunctionSidebar />
      </div>

      <TraceModal
        traceId={selectedTraceId}
        onOpenChange={() => setSelectedTraceId(null)}
      />
    </>
  );
}
