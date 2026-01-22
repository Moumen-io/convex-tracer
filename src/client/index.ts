/**
 * Convex tracing system with component-based architecture.
 *
 * Usage:
 * ```typescript
 * import { components } from "./_generated/api";
 * import { mutation, action } from "./_generated/server";
 * import { Tracer } from "@convex-dev/tracer";
 *
 * const tracer = new Tracer(components.tracer, {
 *   sampleRate: 0.1,
 *   preserveErrors: true,
 * });
 *
 * export const myMutation = tracer.tracedMutation({
 *   args: { name: v.string() },
 *   handler: async (ctx, args) => {
 *     ctx.tracer.info("Processing...");
 *     // ... your logic
 *   },
 * });
 * ```
 */
import type { FunctionType } from "convex/server";
import {
  actionGeneric,
  type GenericActionCtx,
  type GenericDataModel,
  type GenericMutationCtx,
  internalActionGeneric,
  internalMutationGeneric,
  mutationGeneric,
  type RegisteredAction,
  type RegisteredMutation,
} from "convex/server";
import type { Infer, PropertyValidators } from "convex/values";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component";
import { statusValidator } from "../component/schema";
import type { CompleteTrace, Trace } from "../component/types";
import TracingAPI from "./api";
import {
  executeTracedHandler,
  extractTraceContext,
  prepareLogArgs,
  setupTraceContext,
} from "./helpers";
import type {
  ActionCtxWithTracer,
  AnyFunctionReference,
  ExtractOutput,
  GenericFunctionContext,
  MutationCtxWithTracer,
  QueryCtxWithTracer,
  TraceContext,
  TracedFunctionConfig,
  TracedFunctionContext,
  TracedFunctionTypes,
  TracedResult,
  TracerArgs,
  TracerConfig,
  TracerHandler,
} from "./types";

export * from "../component/types";

const DEFAULT_CONFIG: Required<TracerConfig> = {
  sampleRate: 0.1,
  preserveErrors: true,
  retentionMinutes: 120,
};

const __traceContext = v.optional(
  v.object({
    traceId: v.string(),
    spanId: v.string(),
    sampleRate: v.optional(v.number()),
    retentionMinutes: v.optional(v.number()),
    preserveErrors: v.optional(v.boolean()),
  }),
);

/**
 * @example
 * ```typescript
 * import { components } from "./_generated/api";
 * import { mutation, action } from "./_generated/server";
 * import { Tracer } from "@convex-dev/tracer";
 *
 * export const { tracedQuery, tracedMutation, tracedAction } = new Tracer(components.tracer, {
 *   sampleRate: 0.1,
 *   preserveErrors: true,
 * });
 *
 * export const createPost = tracedMutation({
 *   name: "createPost",
 *   args: { title: v.string() },
 *   handler: async (ctx, args) => {
 *     ctx.tracer.info("Creating post");
 *     return await ctx.db.insert("posts", args);
 *   },
 * });
 * ```
 */
export class Tracer<DataModel extends GenericDataModel> {
  public readonly sampleRate: number;
  public readonly preserveErrors: boolean;
  public readonly retentionMinutes: number;

  constructor(
    public readonly component: ComponentApi,
    config: TracerConfig = {},
  ) {
    this.sampleRate = config.sampleRate ?? DEFAULT_CONFIG.sampleRate;
    this.preserveErrors =
      config.preserveErrors ?? DEFAULT_CONFIG.preserveErrors;
    this.retentionMinutes =
      config.retentionMinutes ?? DEFAULT_CONFIG.retentionMinutes;
  }

  private createRunTracedFunction<
    Ctx extends GenericFunctionContext<DataModel>,
  >(ctx: Ctx, traceContext: TraceContext, type: TracedFunctionTypes) {
    return async <FuncRef extends AnyFunctionReference>(
      funcRef: FuncRef,
      args: Exclude<FuncRef["_args"], "__traceContext">,
    ): Promise<FuncRef["_returnType"]> => {
      const argsWithTrace = {
        ...args,
        __traceContext: traceContext,
      };

      if (type === "action") {
        return await (ctx as GenericActionCtx<DataModel>).runAction(
          funcRef,
          argsWithTrace,
        );
      }

      return await (ctx as GenericMutationCtx<DataModel>).runMutation(
        funcRef,
        argsWithTrace,
      );
    };
  }

  private createRestrictedQueryContext(
    ctx: GenericMutationCtx<DataModel>,
    traceContext: TraceContext,
  ): QueryCtxWithTracer<DataModel> {
    const tracerConfig: Required<TracerConfig> = {
      sampleRate: this.sampleRate,
      preserveErrors: this.preserveErrors,
      retentionMinutes: this.retentionMinutes,
    };

    const { runMutation, scheduler, db, storage, ...restOfCtx } = ctx;

    const { get, query, normalizeId, system } = db;
    const { getUrl, getMetadata } = storage;

    const queryCtx = {
      ...restOfCtx,
      db: { get, query, normalizeId, system },
      storage: { getUrl, getMetadata },
    };

    return {
      ...queryCtx,
      tracer: new TracingAPI(
        ctx as any,
        this.component,
        traceContext.traceId,
        traceContext.spanId,
        tracerConfig,
      ),
      runTracedQuery: this.createRunTracedFunction(
        ctx,
        traceContext,
        "mutation",
      ),
    } as QueryCtxWithTracer<DataModel>;
  }

  private createEnhancedContext(
    ctx: GenericFunctionContext<DataModel>,
    traceContext: TraceContext,
    type: FunctionType,
  ): TracedFunctionContext<DataModel> {
    const tracerConfig: Required<TracerConfig> = {
      sampleRate: this.sampleRate,
      preserveErrors: this.preserveErrors,
      retentionMinutes: this.retentionMinutes,
    };

    if (type === "query") {
      return this.createRestrictedQueryContext(
        ctx as GenericMutationCtx<DataModel>,
        traceContext,
      );
    }

    const baseCtx = {
      ...ctx,
      tracer: new TracingAPI(
        ctx as any,
        this.component,
        traceContext.traceId,
        traceContext.spanId,
        tracerConfig,
      ),
      runTracedQuery: this.createRunTracedFunction(
        ctx,
        traceContext,
        "mutation",
      ),
      runTracedMutation: this.createRunTracedFunction(
        ctx,
        traceContext,
        "mutation",
      ),
    };

    if (type === "mutation") {
      return baseCtx as MutationCtxWithTracer<DataModel>;
    }

    if (type === "action") {
      return {
        ...baseCtx,
        runTracedAction: this.createRunTracedFunction(
          ctx,
          traceContext,
          "action",
        ),
      } as ActionCtxWithTracer<DataModel>;
    }

    throw new Error(`Unexpected function type: ${type}`);
  }

  private createTracedHandler<
    EnhancedCtx extends TracedFunctionContext<DataModel>,
    Args extends PropertyValidators,
    Handler extends TracerHandler<EnhancedCtx, Args>,
    Output extends ExtractOutput<Handler>,
  >(
    tConfig: TracedFunctionConfig<EnhancedCtx, Args, Handler, Output>,
    functionType: FunctionType,
    defaultName: string,
  ) {
    const functionName = tConfig.name || defaultName;

    return async (
      ctx: GenericFunctionContext<DataModel>,
      allArgs: any,
    ): Promise<TracedResult<Output>> => {
      const startTime = Date.now();
      const { existingContext, args } = extractTraceContext(allArgs);

      const { traceId, spanId, traceContext, isRoot } = await setupTraceContext(
        ctx as any,
        this.component,
        existingContext,
        startTime,
        functionName,
        tConfig.sampleRate ?? this.sampleRate,
        tConfig.retentionMinutes ?? this.retentionMinutes,
        tConfig.preserveErrors ?? this.preserveErrors,
        {
          functionName,
          args: prepareLogArgs(args, tConfig.logArgs as any),
        },
      );

      const enhancedCtx = this.createEnhancedContext(
        ctx,
        traceContext,
        functionType,
      ) as EnhancedCtx;

      return await executeTracedHandler<Args, Output, EnhancedCtx>({
        ctx: ctx as any,
        component: this.component,
        traceId,
        spanId,
        startTime,
        config: tConfig,
        args,
        handler: tConfig.handler,
        enhancedCtx,
        isRoot,
      });
    };
  }

  /**
   * Creates a traced query (runs as mutation internally).
   * @example
   * ```ts
   * export const getUser = tracedQuery({
   *   name: "getUser",
   *   args: { userId: v.id("users") },
   *   onSuccess: async (ctx, args, result) => {
   *     ctx.tracer.info("Succeeded user fetch", { userId: args.userId });
   *   },
   *   handler: async (ctx, args) => {
   *     ctx.tracer.info("fetching user", { title: args.userId });
   *     const user = await ctx.db.get(args.userId);
   *     ctx.tracer.info("user fetched", { userId: args.userId });
   *     return user;
   *   },
   * });
   * ```
   */
  tracedQuery = <
    Ctx extends QueryCtxWithTracer<DataModel>,
    Args extends PropertyValidators | {},
    Handler extends TracerHandler<Ctx, Args>,
    Output extends ExtractOutput<Handler>,
  >(
    tConfig: TracedFunctionConfig<Ctx, Args, Handler, Output>,
  ): RegisteredMutation<
    "public",
    TracerArgs<Args>,
    TracedResult<ExtractOutput<Handler>>
  > => {
    return mutationGeneric({
      args: {
        ...tConfig.args,
        __traceContext,
      },
      handler: this.createTracedHandler<Ctx, Args, Handler, Output>(
        tConfig,
        "query",
        "anonymous-query",
      ),
    });
  };

  /**
   * Creates a traced query (runs as mutation internally).
   * @example
   * ```ts
   * export const getUser = internalTracedQuery({
   *   name: "getUser",
   *   args: { userId: v.id("users") },
   *   onSuccess: async (ctx, args, result) => {
   *     ctx.tracer.info("Succeeded user fetch", { userId: args.userId });
   *   },
   *   handler: async (ctx, args) => {
   *     ctx.tracer.info("fetching user", { title: args.userId });
   *     const user = await ctx.db.get(args.userId);
   *     ctx.tracer.info("user fetched", { userId: args.userId });
   *     return user;
   *   },
   * });
   * ```
   */
  internalTracedQuery = <
    Ctx extends QueryCtxWithTracer<DataModel>,
    Args extends PropertyValidators | {},
    Handler extends TracerHandler<Ctx, Args>,
    Output extends ExtractOutput<Handler>,
  >(
    tConfig: TracedFunctionConfig<Ctx, Args, Handler, Output>,
  ): RegisteredMutation<
    "internal",
    TracerArgs<Args>,
    TracedResult<ExtractOutput<Handler>>
  > => {
    return internalMutationGeneric({
      args: {
        ...tConfig.args,
        __traceContext,
      },
      handler: this.createTracedHandler<Ctx, Args, Handler, Output>(
        tConfig,
        "query",
        "anonymous-internal-query",
      ),
    });
  };

  /**
   * Creates a traced mutation.
   * @example
   * ```ts
   * export const createUser = tracedMutation({
   *   name: "createUser",
   *   args: { user: v.object({ name: v.string(), email: v.string() }) },
   *   handler: async (ctx, args) => {
   *     const existing = await ctx.db
   *       .query("users")
   *       .withIndex("by_email", (q) => q.eq("email", args.user.email))
   *       .first();
   *
   *     if (existing) {
   *       ctx.tracer.info("User already exists", { user: args.user });
   *       return existing._id;
   *     }
   *
   *     ctx.tracer.info("Adding user", { ...args.user });
   *
   *     const userId = await ctx.db.insert("users", { ...args.user });
   *     ctx.tracer.info("User added", { userId });
   *
   *     ctx.tracer.withSpan("syncUser", async (span) => {
   *       span.info("Syncing user");
   *       // do something
   *       span.info("User synced");
   *     });
   *
   *     return userId;
   *   },
   * });
   * ```
   */
  tracedMutation = <
    Ctx extends MutationCtxWithTracer<DataModel>,
    Args extends PropertyValidators | {},
    Handler extends TracerHandler<Ctx, Args>,
    Output extends ExtractOutput<Handler>,
  >(
    tConfig: TracedFunctionConfig<Ctx, Args, Handler, Output>,
  ): RegisteredMutation<
    "public",
    TracerArgs<Args>,
    TracedResult<ExtractOutput<Handler>>
  > => {
    return mutationGeneric({
      args: {
        ...tConfig.args,
        __traceContext,
      },
      handler: this.createTracedHandler<Ctx, Args, Handler, Output>(
        tConfig,
        "mutation",
        "anonymous-mutation",
      ),
    });
  };

  /**
   * Creates a traced mutation.
   * @example
   * ```ts
   * export const createUser = internalTracedMutation({
   *   name: "createUser",
   *   args: { user: v.object({ name: v.string(), email: v.string() }) },
   *   handler: async (ctx, args) => {
   *     const existing = await ctx.db
   *       .query("users")
   *       .withIndex("by_email", (q) => q.eq("email", args.user.email))
   *       .first();
   *
   *     if (existing) {
   *       ctx.tracer.info("User already exists", { user: args.user });
   *       return existing._id;
   *     }
   *
   *     ctx.tracer.info("Adding user", { ...args.user });
   *
   *     const userId = await ctx.db.insert("users", { ...args.user });
   *     ctx.tracer.info("User added", { userId });
   *
   *     ctx.tracer.withSpan("syncUser", async (span) => {
   *       span.info("Syncing user");
   *       // do something
   *       span.info("User synced");
   *     });
   *
   *     return userId;
   *   },
   * });
   * ```
   */
  internalTracedMutation = <
    Ctx extends MutationCtxWithTracer<DataModel>,
    Args extends PropertyValidators | {},
    Handler extends TracerHandler<Ctx, Args>,
    Output extends ExtractOutput<Handler>,
  >(
    tConfig: TracedFunctionConfig<Ctx, Args, Handler, Output>,
  ): RegisteredMutation<
    "internal",
    TracerArgs<Args>,
    TracedResult<ExtractOutput<Handler>>
  > => {
    return internalMutationGeneric({
      args: {
        ...tConfig.args,
        __traceContext,
      },
      handler: this.createTracedHandler<Ctx, Args, Handler, Output>(
        tConfig,
        "mutation",
        "anonymous-internal-mutation",
      ),
    });
  };

  /**
   * Creates a traced action.
   * @example
   * ```ts
   * export const someAction = tracedAction({
   *   name: "someAction",
   *   args: { userId: v.id("users") },
   *   handler: async (ctx, args) => {
   *     // do something
   *   },
   * });
   * ```
   */
  tracedAction = <
    Ctx extends ActionCtxWithTracer<DataModel>,
    Args extends PropertyValidators | {},
    Handler extends TracerHandler<Ctx, Args>,
    Output extends ExtractOutput<Handler>,
  >(
    tConfig: TracedFunctionConfig<Ctx, Args, Handler, Output>,
  ): RegisteredAction<"public", TracerArgs<Args>, TracedResult<Output>> => {
    return actionGeneric({
      args: {
        ...tConfig.args,
        __traceContext,
      },
      handler: this.createTracedHandler<Ctx, Args, Handler, Output>(
        tConfig,
        "action",
        "anonymous-action",
      ),
    });
  };

  /**
   * Creates a traced action.
   * @example
   * ```ts
   * export const someAction = internalTracedAction({
   *   name: "someAction",
   *   args: { userId: v.id("users") },
   *   handler: async (ctx, args) => {
   *     // do something
   *   },
   * });
   * ```
   */
  internalTracedAction = <
    Ctx extends ActionCtxWithTracer<DataModel>,
    Args extends PropertyValidators | {},
    Handler extends TracerHandler<Ctx, Args>,
    Output extends ExtractOutput<Handler>,
  >(
    tConfig: TracedFunctionConfig<Ctx, Args, Handler, Output>,
  ): RegisteredAction<"internal", TracerArgs<Args>, TracedResult<Output>> => {
    return internalActionGeneric({
      args: {
        ...tConfig.args,
        __traceContext,
      },
      handler: this.createTracedHandler<Ctx, Args, Handler, Output>(
        tConfig,
        "action",
        "anonymous-internal-action",
      ),
    });
  };

  get tracer() {
    return {
      /**
       * Retrieves a trace by its ID.
       * @param traceId - The ID of the trace to retrieve.
       * @example
       * ```ts
       * // In a convex function (query, mutation, or action)
       * // Or in a traced function
       * const trace = await tracer.getTrace("123")
       * ```
       */
      getTrace: async (
        ctx: GenericFunctionContext<DataModel>,
        traceId: string,
      ): Promise<CompleteTrace | null> => {
        return await ctx.runQuery(this.component.lib.getTrace, { traceId });
      },

      /**
       * Lists traces with optional filtering by status.
       * @param status - The status of the traces to retrieve.
       * @param limit - The maximum number of traces to retrieve.
       * @param userId - The ID of the user to retrieve traces for.
       * @example
       * ```ts
       * // In a convex function (query, mutation, or action)
       * // Or in a traced function
       * const traces = await tracer.listTraces({ status: "success", limit: 10 })
       * ```
       */
      listTraces: async (
        ctx: GenericFunctionContext<DataModel>,
        args?: {
          status?: Infer<typeof statusValidator>;
          limit?: number;
          userId?: string;
        },
      ): Promise<Trace[]> => {
        return await ctx.runQuery(this.component.lib.listTraces, { ...args });
      },
    };
  }
}
