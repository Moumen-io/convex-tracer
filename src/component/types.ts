import { paginationResultValidator } from "convex/server";
import { v, type Infer } from "convex/values";
import schema from "./schema";

export const vTrace = schema.tables.traces.validator.extend({
  _id: v.string(),
  _creationTime: v.number(),
});

export const vPaginatedTraces = paginationResultValidator(vTrace);

export const vSpan = schema.tables.spans.validator
  .omit("parentSpanId")
  .omit("traceId")
  .extend({
    _id: v.string(),
    traceId: v.string(),
    parentSpanId: v.optional(v.string()),
    _creationTime: v.number(),
  });

export const vLog = schema.tables.logs.validator.omit("spanId").extend({
  _id: v.string(),
  spanId: v.string(),
  _creationTime: v.number(),
});

export const vSpanWithLogs = vSpan.extend({
  logs: v.optional(v.array(vLog)),
  children: v.optional(v.array(v.any())),
});

export const vCompleteTrace = vTrace.extend({
  spans: v.array(vSpanWithLogs),
});

export type Trace = Infer<typeof vTrace>;
export type Span = Infer<typeof vSpan>;
export type Log = Infer<typeof vLog>;
export type SpanWithLogs = Infer<typeof vSpanWithLogs>;
export type CompleteTrace = Infer<typeof vCompleteTrace>;
export type paginatedTraces = Infer<typeof vPaginatedTraces>;
