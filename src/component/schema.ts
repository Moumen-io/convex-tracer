import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const statusValidator = v.union(
  v.literal("pending"),
  v.literal("success"),
  v.literal("error"),
);

export const sourceValidator = v.union(
  v.literal("frontend"),
  v.literal("backend"),
);

export const severityValidator = v.union(
  v.literal("info"),
  v.literal("warn"),
  v.literal("error"),
);

export default defineSchema({
  traces: defineTable({
    status: statusValidator,
    sampleRate: v.number(),
    preserve: v.optional(v.boolean()),
    updatedAt: v.number(),
    metadata: v.optional(v.record(v.string(), v.any())),
    userId: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_userId", ["userId"])
    .index("by_status_and_userId", ["status", "userId"]),

  spans: defineTable({
    traceId: v.id("traces"),
    parentSpanId: v.optional(v.id("spans")),
    spanName: v.string(),
    source: sourceValidator,
    startTime: v.number(),
    endTime: v.optional(v.number()),
    duration: v.optional(v.number()),
    status: statusValidator,
    functionName: v.optional(v.string()),
    args: v.optional(v.any()),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
  })
    .index("by_traceId", ["traceId"])
    .index("by_parentSpanId", ["parentSpanId"])
    .index("by_status", ["status"]),

  logs: defineTable({
    spanId: v.id("spans"),
    timestamp: v.number(),
    severity: severityValidator,
    message: v.string(),
    metadata: v.optional(v.record(v.string(), v.any())),
  })
    .index("by_spanId", ["spanId"])
    .index("by_severity", ["severity"]),
});
