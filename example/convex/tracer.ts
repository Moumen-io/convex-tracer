import { Tracer } from "convex-tracer";
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
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => await tracer.listTraces(ctx, args),
});

export const getTrace = query({
  args: {
    traceId: v.string(),
  },
  handler: async (ctx, args) => await tracer.getTrace(ctx, args.traceId),
});
