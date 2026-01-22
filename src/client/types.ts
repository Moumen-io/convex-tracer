import type {
  FunctionReference,
  FunctionType,
  FunctionVisibility,
  GenericActionCtx,
  GenericDatabaseReader,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
  RegisteredMutation,
  StorageReader,
} from "convex/server";
import type {
  ObjectType,
  OptionalProperty,
  PropertyValidators,
  Validator,
} from "convex/values";
import type { TraceAPI } from "./api/types";

export type AnyFunctionReference = FunctionReference<any, any>;

export type HasArgs<Args> = keyof Args extends never ? false : true;

export type OptionalArgsObject<Args extends PropertyValidators> =
  keyof Args extends never ? {} : ObjectType<Args>;

export type IfArgs<
  Args extends PropertyValidators,
  T,
  F,
> = keyof Args extends never ? F : T;

export type ExtractOutput<T> = T extends (
  ctx: any,
  args: any,
) => Promise<infer R>
  ? R
  : never;

export interface TraceContext extends Required<TracerConfig> {
  traceId: string; // Id<"traces"> from component
  spanId: string; // Id<"spans"> from component
}

export type ArgsWithTraceContext<Args> = Args & {
  __traceContext?: TraceContext;
};

export interface TracerConfig {
  /**
   * The sample rate for the trace.
   * This is used to determine whether to sample the trace or not.
   * @default - 0.1
   */
  sampleRate?: number;

  /**
   * Whether to preserve errors.
   * If true, the trace will be preserved on error.
   * If false, the trace will get sampled.
   * @default - true
   */
  preserveErrors?: boolean;

  /**
   * The amount of time to wait before sampling or deleting the trace.
   * This is used to prevent tracing of long-running functions.
   * @default - 120
   */
  retentionMinutes?: number;
}

export type LogArgs<Args extends PropertyValidators> = IfArgs<
  Args,
  boolean | Array<keyof ObjectType<Args>> | undefined,
  {}
>;

export interface TracedFunctionOptions<
  Ctx,
  Args extends PropertyValidators,
  Output,
> {
  /**
   * The name of the traced function.
   * This is used to identify the function in the DB or UI.
   * @default - anonymous_function
   */
  name?: string;

  /**
   * Whether to log the arguments of the function.
   * This can be a boolean or an array of argument names to log.
   * @default - false
   * @example
   * ```ts
   * logArgs: true, // Logs all arguments
   * logArgs: ["userId", "title"], // Logs only the userId and title arguments
   * ```
   */
  logArgs?: LogArgs<Args>;

  /**
   * Whether to log the return value of the function.
   * @default - false
   */
  logReturn?: boolean;

  /**
   * The sample rate for the trace.
   * This is used to determine whether to sample the trace or not.
   * If undefined, the Tracer config will be used
   * @default - 0.1
   */
  sampleRate?: number;

  /** The retention minutes for the trace.
   * This is used to determine how long to keep the trace.
   * If undefined, the Tracer config will be used
   * @default - 120
   */
  retentionMinutes?: number;

  /** Whether to preserve errors.
   * If true, the trace will be preserved on error.
   * If undefined, the Tracer config will be used
   * @default - undefined
   */
  preserveErrors?: boolean;

  /**
   * A callback to run before the function starts.
   * @param {any} ctx - The context object.
   * @param {ObjectType<Args>} args - The arguments object.
   * @returns {void | Promise<void>}
   * @example
   * ```ts
   * onStart: async (ctx, args) => {
   *   // do something before the function starts
   *   ctx.tracer.info("Starting Processing...");
   * }
   * ```
   */
  onStart?: (ctx: Ctx, args: OptionalArgsObject<Args>) => void | Promise<void>;

  /**
   * A callback to run after the function succeeds.
   * @param {any} ctx - The context object.
   * @param {ObjectType<Args>} args - The arguments object.
   * @param {unknown} result - The result of the function.
   * @returns {void | Promise<void>}
   * @example
   * ```ts
   * onSuccess: async (ctx, args, result) => {
   *   // do something with the result
   *   ctx.tracer.info("Successfully processed");
   * }
   * ```
   */
  onSuccess?: (
    ctx: Ctx,
    args: OptionalArgsObject<Args>,
    result: Output,
  ) => void | Promise<void>;

  /**
   * A callback to run after the function fails.
   * @param {any} ctx - The context object.
   * @param {ObjectType<Args>} args - The arguments object.
   * @param {Error} error - The error that occurred.
   * @returns {void | Promise<void>}
   * @example
   * ```ts
   * onError: async (ctx, args, error) => {
   *   // do something to handle the error
   *   ctx.tracer.error("Failed to process", { error: error.message });
   * }
   * ```
   */
  onError?: (
    ctx: Ctx,
    args: OptionalArgsObject<Args>,
    error: Error,
  ) => void | Promise<void>;
}

export type TracerHandler<Ctx, Args extends PropertyValidators> = (
  ctx: Ctx,
  args: OptionalArgsObject<Args>,
) => Promise<any>;

export type TracedFunctionConfig<
  Ctx,
  Args extends PropertyValidators,
  Handler extends TracerHandler<Ctx, Args>,
  Output extends ExtractOutput<Handler>,
> = TracedFunctionOptions<Ctx, Args, Output> & {
  args?: Args;
  handler: Handler;
  returns?: Validator<Output, OptionalProperty, any>;
};

export type TracerArgs<Args extends PropertyValidators> = ObjectType<
  Args & { __traceContext?: TraceContext }
>;

export type TracedFunctionTypes = Exclude<FunctionType, "query">;

export type TracedFunction<Type extends TracedFunctionTypes> = <
  FuncRef extends FunctionReference<Type, any, any, any>,
>(
  funcRef: FuncRef,
  args?: Omit<FuncRef["_args"], "__traceContext">,
) => Promise<FuncRef["_returnType"]>;

type RestrictedQueryContext<DataModel extends GenericDataModel> = Omit<
  GenericMutationCtx<DataModel>,
  "runMutation" | "scheduler" | "db" | "storage"
> & {
  db: GenericDatabaseReader<DataModel>;
  storage: StorageReader;
};

export type QueryCtxWithTracer<DataModel extends GenericDataModel> =
  RestrictedQueryContext<DataModel> & {
    tracer: TraceAPI;
    runTracedQuery: TracedFunction<"mutation">;
  };

export type MutationCtxWithTracer<DataModel extends GenericDataModel> =
  GenericMutationCtx<DataModel> & {
    tracer: TraceAPI;
    runTracedQuery: TracedFunction<"action">;
    runTracedMutation: TracedFunction<"mutation">;
  };

export type ActionCtxWithTracer<DataModel extends GenericDataModel> =
  GenericActionCtx<DataModel> & {
    tracer: TraceAPI;
    runTracedQuery: TracedFunction<"mutation">;
    runTracedMutation: TracedFunction<"mutation">;
    runTracedAction: TracedFunction<"action">;
  };

export type TracedFunctionContext<DataModel extends GenericDataModel> =
  | QueryCtxWithTracer<DataModel>
  | MutationCtxWithTracer<DataModel>
  | ActionCtxWithTracer<DataModel>;

export type StrippedGenericFunctionContext<DataModel extends GenericDataModel> =
  GenericMutationCtx<DataModel> | GenericActionCtx<DataModel>;

export type GenericFunctionContext<DataModel extends GenericDataModel> =
  | GenericQueryCtx<DataModel>
  | StrippedGenericFunctionContext<DataModel>;

export type TracedResult<Output> =
  | { success: true; data: Output; error: undefined }
  | { success: false; data: undefined; error: string };

export type RegisteredTracedMutation<
  Visibility extends FunctionVisibility,
  Args extends PropertyValidators,
  Output,
> = RegisteredMutation<
  Visibility,
  ArgsWithTraceContext<Args>,
  TracedResult<Output>
>;
