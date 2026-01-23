/**
 * Internal mutations for managing traces, spans, and logs.
 * These are called automatically by the tracing system to persist data immediately.
 */
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.js";
import { mutation, query, type MutationCtx } from "./_generated/server.js";
import {
  severityValidator,
  sourceValidator,
  statusValidator,
} from "./schema.js";
import { vCompleteTrace, vTrace } from "./types.js";

// ============================================================================
// Trace Operations
// ============================================================================

/**
 * Creates a new trace in the database.
 * Called automatically when a traced function is invoked without an existing trace context.
 */
export const createTrace = mutation({
  args: {
    status: statusValidator,
    sampleRate: v.number(),
    metadata: v.optional(v.record(v.string(), v.any())),
    source: sourceValidator,
    userId: v.union(v.literal("anonymous"), v.string()),
  },
  returns: v.id("traces"),
  handler: async (ctx, args): Promise<Id<"traces">> => {
    return await ctx.db.insert("traces", {
      status: args.status,
      sampleRate: args.sampleRate,
      updatedAt: Date.now(),
      metadata: args.metadata,
      userId: args.userId,
    });
  },
});

/**
 * Updates the status of an existing trace.
 * Called when a root traced function completes or errors.
 */
export const updateTraceStatus = mutation({
  args: {
    traceId: v.string(),
    status: statusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch("traces", args.traceId as Id<"traces">, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Updates the preserve flag on a trace.
 * Called when tracer.preserve(), tracer.discard(), or tracer.sample() is invoked.
 */
export const updateTracePreserve = mutation({
  args: {
    traceId: v.string(),
    preserve: v.optional(v.boolean()),
    sampleRate: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { sampleRate, traceId, preserve }): Promise<void> => {
    const srUpdate = {} as any;
    if (sampleRate) srUpdate.sampleRate = sampleRate;

    await ctx.db.patch("traces", traceId as Id<"traces">, {
      preserve: preserve,
      updatedAt: Date.now(),
      ...srUpdate,
    });
  },
});

/**
 * Updates the trace metadata.
 * Called when tracer.setMetadata() is invoked.
 */
export const updateTraceMetadata = mutation({
  args: {
    traceId: v.string(),
    metadata: v.record(v.string(), v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<void> => {
    const trace = await ctx.db.get("traces", args.traceId as Id<"traces">);
    if (!trace) throw new Error(`Trace not found: ${args.traceId}`);

    await ctx.db.patch("traces", args.traceId as Id<"traces">, {
      metadata: {
        ...trace.metadata,
        ...args.metadata,
      },
      updatedAt: Date.now(),
    });
  },
});

// ============================================================================
// Span Operations
// ============================================================================

/**
 * Creates a new span in the database.
 * Called automatically when a traced function starts or when withSpan() is called.
 */
export const createSpan = mutation({
  args: {
    traceId: v.string(),
    span: v.object({
      parentSpanId: v.optional(v.string()),
      spanName: v.string(),
      source: sourceValidator,
      startTime: v.number(),
      status: statusValidator,
      functionName: v.optional(v.string()),
      args: v.optional(v.any()),
    }),
  },
  returns: v.id("spans"),
  handler: async (ctx, args): Promise<Id<"spans">> => {
    return await ctx.db.insert("spans", {
      ...args.span,
      traceId: args.traceId as Id<"traces">,
      parentSpanId: args.span.parentSpanId
        ? (args.span.parentSpanId as Id<"spans">)
        : undefined,
    });
  },
});

/**
 * Completes a span by updating its end time, duration, status, and optional result/error.
 * Called automatically when a traced function completes or when withSpan() finishes.
 */
export const completeSpan = mutation({
  args: {
    spanId: v.string(),
    endTime: v.number(),
    duration: v.number(),
    status: v.union(v.literal("success"), v.literal("error")),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch("spans", args.spanId as Id<"spans">, {
      endTime: args.endTime,
      duration: args.duration,
      status: args.status,
      result: args.result,
      error: args.error,
    });
  },
});

/**
 * Updates the metadata of a span.
 * Called when span.setMetadata() is invoked within withSpan().
 */
export const updateSpanMetadata = mutation({
  args: {
    spanId: v.string(),
    metadata: v.record(v.string(), v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<void> => {
    const span = await ctx.db.get("spans", args.spanId as Id<"spans">);
    if (!span) throw new Error(`Span not found: ${args.spanId}`);

    await ctx.db.patch(span._id, {
      metadata: {
        ...span.metadata,
        ...args.metadata,
      },
    });
  },
});

// ============================================================================
// Log Operations
// ============================================================================

/**
 * Adds a log entry to a specific span.
 * Called when tracer.info(), tracer.warn(), or tracer.error() is invoked.
 */
export const addLog = mutation({
  args: {
    spanId: v.string(),
    log: v.object({
      timestamp: v.number(),
      severity: severityValidator,
      message: v.string(),
      metadata: v.optional(v.record(v.string(), v.any())),
    }),
  },
  returns: v.id("logs"),
  handler: async (ctx, args): Promise<Id<"logs">> => {
    const span = await ctx.db.get("spans", args.spanId as Id<"spans">);
    if (!span) throw new Error(`Span not found: ${args.spanId}`);

    return await ctx.db.insert("logs", {
      spanId: span._id,
      ...args.log,
    });
  },
});

// ============================================================================
// Query Operations
// ============================================================================

/**
 * Verify trace exists
 */
export const verifyTrace = query({
  args: { traceId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { traceId }) => {
    const trace = await ctx.db.get("traces", traceId as Id<"traces">);
    if (!trace) return false;

    return true;
  },
});

export const verifySpan = query({
  args: { spanId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { spanId }) => {
    const span = await ctx.db.get("spans", spanId as Id<"spans">);
    if (!span) return false;

    return true;
  },
});

/**
 * Retrieves a complete trace with all its spans and logs.
 */
export const getTrace = query({
  args: { traceId: v.string() },
  returns: v.union(v.null(), vCompleteTrace),
  handler: async (ctx, { traceId }) => {
    const trace = await ctx.db.get("traces", traceId as Id<"traces">);
    if (!trace) return null;

    const spans = await ctx.db
      .query("spans")
      .withIndex("by_traceId", (q) => q.eq("traceId", traceId as Id<"traces">))
      .collect();

    const spansWithLogs = await Promise.all(
      spans.map(async (span) => ({
        ...span,
        children: [],
        logs: await ctx.db
          .query("logs")
          .withIndex("by_spanId", (q) => q.eq("spanId", span._id))
          .collect(),
      })),
    );

    const spanMap = new Map(spansWithLogs.map((span) => [span._id, span]));

    spansWithLogs.forEach((span) => {
      if (span.parentSpanId) {
        const parentSpan = spanMap.get(span.parentSpanId);
        if (parentSpan) {
          (parentSpan.children as any[]).push(span);
        }
      }
    });

    const sortSpanChildren = (span: (typeof spansWithLogs)[0]) => {
      if (span.children.length > 0) {
        (span.children as any[]).sort(
          (a, b) => a._creationTime - b._creationTime,
        );
        span.children.forEach(sortSpanChildren);
      }
    };

    const rootSpans = spansWithLogs
      .filter((span) => !span.parentSpanId)
      .sort((a, b) => a._creationTime - b._creationTime);

    rootSpans.forEach(sortSpanChildren);

    return { ...trace, spans: rootSpans };
  },
});

/**
 * Lists traces with optional filtering by status.
 */
export const listTraces = query({
  args: {
    status: v.optional(statusValidator),
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(vTrace),
  handler: async (ctx, { status, userId, limit }) => {
    const query = ctx.db.query("traces");

    if (status && !userId) {
      const q = query
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc");

      if (limit) return await q.take(limit);
      else return await q.collect();
    } else if (!status && userId) {
      const q = query
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .order("desc");

      if (limit) return await q.take(limit);
      else return await q.collect();
    } else if (status && userId) {
      const q = query
        .withIndex("by_status_and_userId", (q) =>
          q.eq("status", status).eq("userId", userId),
        )
        .order("desc");

      if (limit) return await q.take(limit);
      else return await q.collect();
    }

    const q = query.order("desc");
    if (limit) return await q.take(limit);
    else return await q.collect();
  },
});

export const searchTraces = query({
  args: {
    functionName: v.string(),
    userId: v.optional(v.string()),
    status: v.optional(statusValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(vTrace),
  handler: async (ctx, { functionName, limit, userId, status }) => {
    const query = ctx.db.query("traces");

    if (userId && !status) {
      const q = query.withSearchIndex("by_function_name", (q) =>
        q.search("functionName", functionName).eq("userId", userId),
      );

      if (limit) return await q.take(limit);
      else return await q.collect();
    } else if (status && !userId) {
      const q = query.withSearchIndex("by_function_name", (q) =>
        q.search("functionName", functionName).eq("status", status),
      );

      if (limit) return await q.take(limit);
      else return await q.collect();
    } else if (userId && status) {
      const q = query.withSearchIndex("by_function_name", (q) =>
        q
          .search("functionName", functionName)
          .eq("userId", userId)
          .eq("status", status),
      );

      if (limit) return await q.take(limit);
      else return await q.collect();
    }

    const q = query.withSearchIndex("by_function_name", (q) =>
      q.search("functionName", functionName),
    );

    if (limit) return await q.take(limit);
    else return await q.collect();
  },
});

// ============================================================================
// Cleanup Operations
// ============================================================================

/**
 * Cleans up old traces based on retention policy and sampling.
 * Should be called periodically by a Convex scheduler.
 */
export const cleanupTrace = mutation({
  args: {
    traceId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const trace = await ctx.db.get("traces", args.traceId as Id<"traces">);

    if (!trace) return;

    // Always keep explicitly preserved traces
    if (trace.preserve === true) return;

    // Always delete explicitly discarded traces
    if (trace.preserve === false) {
      return await deleteTrace(ctx, trace._id);
    }

    // Apply sampling for undefined preserve status
    const random = Math.random();
    if (random >= trace.sampleRate) await deleteTrace(ctx, trace._id);
  },
});

/**
 * Deletes a trace and all its associated spans and logs.
 */
async function deleteTrace(
  ctx: MutationCtx,
  traceId: Id<"traces">,
): Promise<void> {
  const spans = await ctx.db
    .query("spans")
    .withIndex("by_traceId", (q) => q.eq("traceId", traceId))
    .collect();

  const logsRequest = spans.map((span) =>
    ctx.db
      .query("logs")
      .withIndex("by_spanId", (q) => q.eq("spanId", span._id))
      .collect(),
  );

  const logs = await Promise.all(logsRequest);

  const deletionRequests = [
    ...logs.flat().map((log) => ctx.db.delete(log._id)),
    ...spans.map((span) => ctx.db.delete(span._id)),
    ctx.db.delete(traceId),
  ];

  await Promise.all(deletionRequests);
}
