import type { GenericDataModel } from "convex/server";
import type { ObjectType, PropertyValidators } from "convex/values";
import type { ComponentApi } from "../component/_generated/component";
import TracerAPI from "./api";
import type {
  ArgsWithTraceContext,
  LogArgs,
  OptionalArgsObject,
  StrippedGenericFunctionContext,
  TraceContext,
  TracedFunctionOptions,
  TracedResult,
  TracerConfig,
  TracerHandler,
} from "./types";

function pick<T extends Record<string, any>, Keys extends (keyof T)[]>(
  obj: T,
  keys: Keys,
) {
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => keys.includes(k as Keys[number])),
  ) as {
    [K in Keys[number]]: T[K];
  };
}

export function extractTraceContext<Args extends Record<string, unknown>>(
  allArgs: ArgsWithTraceContext<Args>,
): { existingContext?: TraceContext; args: Args } {
  const existingContext = allArgs.__traceContext;
  const args = { ...allArgs };
  delete (args as ArgsWithTraceContext<Args>).__traceContext;
  return { existingContext, args };
}

export function prepareLogArgs<Args extends PropertyValidators>(
  args: ObjectType<Args>,
  logArgs: LogArgs<Args>,
): unknown | undefined {
  if (!logArgs) return undefined;
  if (logArgs === true) return args;
  if (Array.isArray(logArgs)) {
    return pick(args, logArgs);
  }
  return undefined;
}

export async function setupTraceContext(
  ctx: StrippedGenericFunctionContext<GenericDataModel>,
  component: ComponentApi,
  existingContext: TraceContext | undefined,
  startTime: number,
  functionName: string,
  sampleRate: number,
  retentionMinutes: number,
  preserveErrors: boolean,
  spanData: { functionName?: string; args?: unknown },
): Promise<{
  traceId: string;
  spanId: string;
  traceContext: TraceContext;
  isRoot: boolean;
}> {
  if (existingContext?.traceId) {
    const spanId = await ctx.runMutation(component.lib.createSpan, {
      traceId: existingContext.traceId,
      span: {
        parentSpanId: existingContext.spanId,
        spanName: functionName,
        source: "backend",
        startTime,
        status: "pending",
        functionName: spanData.functionName,
        args: spanData.args,
      },
    });

    return {
      traceId: existingContext.traceId,
      spanId,
      traceContext: {
        traceId: existingContext.traceId,
        spanId,
        sampleRate: existingContext.sampleRate,
        retentionMinutes: existingContext.retentionMinutes,
        preserveErrors: existingContext.preserveErrors,
      },
      isRoot: false,
    };
  }

  const traceId = await ctx.runMutation(component.lib.createTrace, {
    status: "pending",
    sampleRate,
    metadata: {},
    source: "backend",
  });

  const spanId = await ctx.runMutation(component.lib.createSpan, {
    traceId,
    span: {
      spanName: functionName,
      source: "backend",
      startTime: Date.now(),
      status: "pending",
      functionName: spanData.functionName,
      args: spanData.args,
    },
  });

  return {
    traceId,
    spanId,
    traceContext: {
      traceId,
      spanId,
      sampleRate,
      retentionMinutes,
      preserveErrors,
    },
    isRoot: true,
  };
}

export async function executeTracedHandler<
  Args extends PropertyValidators,
  Output,
  EnhancedCtx,
>(params: {
  ctx: StrippedGenericFunctionContext<GenericDataModel>;
  component: ComponentApi;
  traceId: string;
  spanId: string;
  startTime: number;
  config: TracedFunctionOptions<EnhancedCtx, Args, Output> & TracerConfig;
  args: OptionalArgsObject<Args>;
  handler: TracerHandler<EnhancedCtx, Args>;
  enhancedCtx: EnhancedCtx;
  isRoot: boolean;
}): Promise<TracedResult<Output>> {
  const {
    ctx,
    component,
    traceId,
    spanId,
    startTime,
    config,
    args,
    handler,
    enhancedCtx,
    isRoot,
  } = params;

  const defaultConfig = (enhancedCtx as any).tracer
    .config as Required<TracerConfig>;

  try {
    // Reject any functions that pass a traceId that doesn't exist
    // These params can be passed from the frontend to break tracing
    // Running a tracedFunction without passing ids will create a new trace
    if (traceId) {
      const traceExists = await ctx.runQuery(component.lib.verifyTrace, {
        traceId,
      });

      if (!traceExists)
        throw new Error("Cannot pass a traceId for a trace that doesn't exist");
    }

    // Reject any functions that pass a spanId that doesn't exist
    // These params can be passed from the frontend to break tracing
    if (spanId) {
      const spanExists = await ctx.runQuery(component.lib.verifySpan, {
        spanId,
      });

      if (!spanExists)
        throw new Error("Cannot pass a spanId for a span that doesn't exist");
    }

    if (config.onStart) {
      await config.onStart(enhancedCtx, args);
    }

    const result = await handler(enhancedCtx, args);

    console.log("at result return", Date.now());

    if (config.onSuccess) {
      await config.onSuccess(enhancedCtx, args, result);
    }

    const now = Date.now();

    await ctx
      .runMutation(component.lib.completeSpan, {
        spanId,
        endTime: now,
        duration: now - startTime,
        status: "success",
        result: config.logReturn ? result : undefined,
      })
      .catch((err) =>
        console.error("[Tracer] Failed to complete span with success:", err),
      );

    if (isRoot) {
      await ctx
        .runMutation(component.lib.updateTraceStatus, {
          traceId,
          status: "success",
        })
        .catch((err) =>
          console.error("[Tracer] Failed to update trace status:", err),
        );
    }

    return { success: true, data: result, error: undefined };
  } catch (e) {
    const error = e as unknown as Error;

    if (config.onError) {
      await config.onError(enhancedCtx, args, error);
    }

    const preserveErrors =
      config.preserveErrors ?? defaultConfig.preserveErrors;

    if (preserveErrors) {
      const tracerAPI = new TracerAPI(ctx, component, traceId, spanId, config);
      tracerAPI.preserve();
    }

    await ctx
      .runMutation(component.lib.completeSpan, {
        spanId,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        status: "error",
        error: error.message,
      })
      .catch((err) =>
        console.error("[Tracer] Failed to complete span with error:", err),
      );

    if (isRoot) {
      await ctx
        .runMutation(component.lib.updateTraceStatus, {
          traceId,
          status: "error",
        })
        .catch((err) =>
          console.error("[Tracer] Failed to update trace status:", err),
        );
    }

    return { success: false, data: undefined, error: error.message };
  } finally {
    const retMins = config.retentionMinutes ?? defaultConfig.retentionMinutes;

    if (!retMins) {
      console.error("[Tracer] retentionMinutes is not defined");
    }

    const sampleRate = config.sampleRate ?? defaultConfig.sampleRate;
    if (!sampleRate) {
      console.error("[Tracer] sampleRate is not defined");
    } else if (sampleRate && sampleRate < 1) {
      const MINUTE = 60 * 1000;
      const delayMins = retMins ?? 120;

      const delay = delayMins * MINUTE;

      await ctx.scheduler.runAfter(delay, component.lib.cleanupTrace, {
        traceId,
      });
    }
  }
}
