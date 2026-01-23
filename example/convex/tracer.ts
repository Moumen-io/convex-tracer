import { Tracer, statusValidator } from "convex-tracer";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";

export const {
  tracedQuery,
  tracedMutation,
  tracedAction,
  internalTracedQuery,
  internalTracedMutation,
  internalTracedAction,
  tracer,
} = new Tracer<DataModel>(components.tracer, {
  retentionMinutes: 0.167,
});

export const listTraces = query({
  args: {
    status: v.optional(statusValidator),
    userId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => await tracer.listTraces(ctx, args),
});

export const searchTraces = query({
  args: {
    functionName: v.string(),
    userId: v.optional(v.string()),
    status: v.optional(statusValidator),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => await tracer.searchTraces(ctx, args),
});

export const getTrace = query({
  args: {
    traceId: v.string(),
  },
  handler: async (ctx, args) => await tracer.getTrace(ctx, args.traceId),
});
