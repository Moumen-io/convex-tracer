import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { formatTimestamp } from "../lib/utils";
import { SeverityBadge, StatusBadge } from "./badges";
import { SpanTree } from "./span-tree";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export function TraceModal({
  traceId,
  onOpenChange,
}: {
  traceId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedSpan, setSelectedSpan] = useState<any | null>(null);

  const selectedTrace = useQuery(
    api.tracer.getTrace,
    traceId ? { traceId } : "skip",
  );

  if (!selectedTrace) return null;

  return (
    <>
      <Dialog open={!!traceId} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Trace Details</DialogTitle>
          </DialogHeader>

          {selectedTrace && (
            <Tabs defaultValue="spans" className="overflow-auto">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="spans">Spans</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
              </TabsList>

              <TabsContent value="spans" className="mt-4">
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-2">
                    {selectedTrace.spans?.map((span) => (
                      <SpanTree
                        key={span._id}
                        span={span}
                        depth={0}
                        onSpanClick={setSelectedSpan}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="metadata" className="mt-4">
                <Card className="p-0">
                  <CardContent className="p-0 w-full ">
                    <div className="h-[400px] w-full p-4 overflow-x-scroll">
                      <pre className="text-xs">
                        {JSON.stringify(selectedTrace, null, 2)}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedSpan} onOpenChange={() => setSelectedSpan(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Span Details</DialogTitle>
          </DialogHeader>

          {selectedSpan && (
            <div className="space-y-4 overflow-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Span Name</label>
                  <div className="text-sm text-muted-foreground">
                    {selectedSpan.spanName}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <div>
                    <StatusBadge status={selectedSpan.status} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Source</label>
                  <div>
                    <Badge variant="outline">{selectedSpan.source}</Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Duration</label>
                  <div className="text-sm text-muted-foreground">
                    {selectedSpan.duration
                      ? `${selectedSpan.duration}ms`
                      : "N/A"}
                  </div>
                </div>
              </div>

              <Separator />

              <Tabs defaultValue="logs" className="overflow-auto">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="logs">Logs</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                </TabsList>

                <TabsContent value="logs" className="mt-4">
                  <ScrollArea className="h-[380px]">
                    <div className="space-y-2">
                      {selectedSpan.logs?.map((log: any) => (
                        <Card key={log._id}>
                          <CardContent className="p-3">
                            <div className="flex gap-2 items-start">
                              <SeverityBadge severity={log.severity} />
                              <div className="flex-1">
                                <div className="text-sm">{log.message}</div>
                                <div className="text-xs text-muted-foreground">
                                  {formatTimestamp(log.timestamp)}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="details" className="mt-4 max-h-full">
                  <Card className="p-0">
                    <CardContent className="p-0 w-full ">
                      <div className="h-[380px] p-4 overflow-scroll">
                        <pre className="text-xs">
                          {JSON.stringify(selectedSpan, null, 2)}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
