import { sourceValidator, statusValidator } from "../../component/schema";

export interface SpanAPI {
  /**
   * Adds an info log to the current span.
   * @param {string} message - The message to log.
   * @param {Record<string, any>} metadata - Optional metadata to include with the log.
   * @returns {Promise<void>}
   * @example
   * ```ts
   * ctx.tracer.info("User created", { userId: user._id });
   * ```
   */
  info(message: string, metadata?: Record<string, any>): Promise<void>;

  /**
   * Adds a warning log to the current span.
   * @param {string} message - The message to log.
   * @param {Record<string, any>} metadata - Optional metadata to include with the log.
   * @returns {Promise<void>}
   * @example
   * ```ts
   * ctx.tracer.warn("User not found", { userId: user._id });
   * ```
   */
  warn(message: string, metadata?: Record<string, any>): Promise<void>;

  /**
   * Adds an error log to the current span.
   * @param {string} message - The message to log.
   * @param {Record<string, any>} metadata - Optional metadata to include with the log.
   * @returns {Promise<void>}
   * @example
   * ```ts
   * ctx.tracer.error("User not found", { userId: user._id });
   * ```
   */
  error(message: string, metadata?: Record<string, any>): Promise<void>;

  /**
   * Sets the metadata for the current span.
   * @param {Record<string, any>} metadata - The metadata to set.
   * @returns {Promise<void>}
   * @example
   * ```ts
   * ctx.tracer.updateMetadata({ userId: user._id });
   * ```
   */
  updateMetadata(metadata: Record<string, any>): Promise<void>;

  /**
   * Creates a new span within the current trace.
   * @param {string} name - The name of the span.
   * @param {(span: SpanAPI) => Promise<T>} fn - The function to run within the span.
   * @returns {Promise<T>} The result of the function.
   * @example
   * ```ts
   * const result = await span.withSpan("createPost", async (span) => {
   *   await span.info("Creating post");
   *   return await ctx.db.insert("posts", args);
   * });
   * ```
   */
  withSpan<T>(name: string, fn: (span: SpanAPI) => Promise<T>): Promise<T>;
}

export interface TraceAPI extends SpanAPI {
  /**
   * Preserves the current trace.
   * This will prevent the trace from being discarded or sampled.
   * @returns {Promise<void>}
   * @example
   * ```ts
   * await ctx.tracer.preserve();
   * ```
   */
  preserve(): Promise<void>;

  /**
   * Discards the current trace.
   * This will prevent the trace from being preserved.
   * @returns {Promise<void>}
   * @example
   * ```ts
   * await ctx.tracer.discard();
   * ```
   */
  discard(): Promise<void>;

  /**
   * Makes sure the current trace will get sampled.
   * This will undo any preserve() or discard() calls.
   * @param {number} sampleRate - The sample rate to use. (optional)
   * @returns {Promise<void>}
   * @example
   * ```ts
   * await ctx.tracer.sample();
   * ```
   */
  sample(sampleRate?: number): Promise<void>;

  /**
   * Creates a new span within the current trace.
   * @param {string} name - The name of the span.
   * @param {(span: SpanAPI) => Promise<T>} fn - The function to run within the span.
   * @returns {Promise<T>} The result of the function.
   * @example
   * ```ts
   * const result = await ctx.tracer.withSpan("createPost", async (span) => {
   *   await span.info("Creating post");
   *   return await ctx.db.insert("posts", args);
   * });
   * ```
   */
  withSpan<T>(name: string, fn: (span: SpanAPI) => Promise<T>): Promise<T>;

  /**
   * The Trace ID of the current trace.
   */
  getTraceId(): string;

  /**
   * The Span ID of the current span.
   */
  getSpanId(): string;
}

export interface TracerAPI {
  /**
   * Creates a new trace in the database.
   * @param {string} traceId - The ID of the trace to create.
   * @param {"pending" | "success" | "error"} status - The status of the trace.
   * @param {number} sampleRate - The sample rate for the trace.
   * @param {any} metadata - The metadata for the trace.
   * @param {typeof statusValidator.type} source - The source of the trace.
   * @returns {Promise<string>} A promise that resolves to the ID of the created trace.
   */
  createTrace: (
    traceId: string,
    status: typeof statusValidator.type,
    sampleRate: number,
    metadata: any,
    source: typeof sourceValidator.type,
  ) => Promise<string>;

  /**
   * Updates the status of a trace.
   * @param {string} traceId - The ID of the trace to update.
   * @param {typeof statusValidator.type} status - The new status of the trace.
   * @returns {Promise<void>} A promise that resolves when the trace is updated.
   */
  updateTraceStatus: (
    traceId: string,
    status: typeof statusValidator.type,
  ) => Promise<void>;

  /**
   * Updates the preserve flag of a trace.
   * @param {string} traceId - The ID of the trace to update.
   * @param {boolean | undefined} preserve - The new preserve flag of the trace.
   * @returns {Promise<void>} A promise that resolves when the trace is updated.
   */
  updateTracePreserve: (
    traceId: string,
    preserve: boolean | undefined,
  ) => Promise<void>;
  updateTraceMetadata: (traceId: string, metadata: any) => Promise<void>;
}
