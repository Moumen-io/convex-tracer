import type {
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
} from "convex/server";

import type { ComponentApi } from "../../component/_generated/component";
import type { TracerConfig } from "../types";
import type { SpanAPI, TraceAPI } from "./types";

export default class TracingAPI implements TraceAPI {
  constructor(
    private ctx:
      | GenericMutationCtx<GenericDataModel>
      | GenericActionCtx<GenericDataModel>,
    private component: ComponentApi,
    private traceId: string,
    private spanId: string,
    private config: TracerConfig,
  ) {}

  private async addLog(
    severity: "info" | "warn" | "error",
    message: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.ctx
      .runMutation(this.component.lib.addLog, {
        spanId: this.spanId,
        log: { timestamp: Date.now(), severity, message, metadata },
      })
      .catch((err) =>
        console.error(`[Tracer] Failed to add ${severity} log:`, err),
      );
  }

  getTraceId(): string {
    return this.traceId;
  }

  getSpanId(): string {
    return this.spanId;
  }

  async info(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.addLog("info", message, metadata);
  }
  async warn(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.addLog("warn", message, metadata);
  }
  async error(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.addLog("error", message, metadata);
  }

  async preserve(): Promise<void> {
    await this.ctx
      .runMutation(this.component.lib.updateTracePreserve, {
        traceId: this.traceId,
        preserve: true,
      })
      .catch((err) => console.error("[Tracer] Failed to preserve trace:", err));
  }

  async discard(): Promise<void> {
    await this.ctx
      .runMutation(this.component.lib.updateTracePreserve, {
        traceId: this.traceId,
        preserve: false,
      })
      .catch((err) => console.error("[Tracer] Failed to discard trace:", err));
  }

  async sample(sampleRate?: number): Promise<void> {
    await this.ctx
      .runMutation(this.component.lib.updateTracePreserve, {
        traceId: this.traceId,
        preserve: undefined,
        sampleRate,
      })
      .catch((err) =>
        console.error("[Tracer] Failed to reset trace sampling:", err),
      );
  }

  async withSpan<T>(
    spanName: string,
    fn: (span: SpanAPI) => Promise<T>,
  ): Promise<T> {
    return await this.createAndRunSpan(this.spanId, spanName, fn);
  }

  async updateMetadata(metadata: Record<string, any>): Promise<void> {
    await this.ctx
      .runMutation(this.component.lib.updateSpanMetadata, {
        spanId: this.spanId,
        metadata,
      })
      .catch((err) => console.error("[Tracer] Failed to set metadata:", err));
  }

  private createSpanAPI(spanId: string): SpanAPI {
    return {
      info: async (message: string, metadata?: Record<string, any>) => {
        await this.ctx
          .runMutation(this.component.lib.addLog, {
            spanId,
            log: { timestamp: Date.now(), severity: "info", message, metadata },
          })
          .catch((err) =>
            console.error(
              "[Tracer] Failed to add info log to child span:",
              err,
            ),
          );
      },
      warn: async (message: string, metadata?: Record<string, any>) => {
        await this.ctx
          .runMutation(this.component.lib.addLog, {
            spanId,
            log: { timestamp: Date.now(), severity: "warn", message, metadata },
          })
          .catch((err) =>
            console.error(
              "[Tracer] Failed to add warn log to child span:",
              err,
            ),
          );
      },
      error: async (message: string, metadata?: Record<string, any>) => {
        await this.ctx
          .runMutation(this.component.lib.addLog, {
            spanId,
            log: {
              timestamp: Date.now(),
              severity: "error",
              message,
              metadata,
            },
          })
          .catch((err) =>
            console.error(
              "[Tracer] Failed to add error log to child span:",
              err,
            ),
          );
      },
      updateMetadata: async (metadata: Record<string, any>) => {
        await this.ctx
          .runMutation(this.component.lib.updateSpanMetadata, {
            spanId,
            metadata,
          })
          .catch((err) =>
            console.error("[Tracer] Failed to set child span metadata:", err),
          );
      },
      withSpan: async <T>(
        spanName: string,
        fn: (span: SpanAPI) => Promise<T>,
      ): Promise<T> => {
        return await this.createAndRunSpan(spanId, spanName, fn);
      },
    };
  }

  private async createAndRunSpan<T>(
    parentSpanId: string,
    spanName: string,
    fn: (span: SpanAPI) => Promise<T>,
  ): Promise<T> {
    let childSpanId: string;
    try {
      childSpanId = await this.ctx.runMutation(this.component.lib.createSpan, {
        traceId: this.traceId,
        span: {
          parentSpanId,
          spanName,
          source: "backend",
          startTime: Date.now(),
          status: "pending",
        },
      });
    } catch (err) {
      console.error("[Tracer] Failed to create child span:", err);
      return await fn(this.createNoOpSpanAPI());
    }

    const spanAPI = this.createSpanAPI(childSpanId);
    const startTime = Date.now();

    try {
      const result = await fn(spanAPI);
      await this.ctx
        .runMutation(this.component.lib.completeSpan, {
          spanId: childSpanId,
          endTime: Date.now(),
          duration: Date.now() - startTime,
          status: "success",
        })
        .catch((err) =>
          console.error("[Tracer] Failed to complete span:", err),
        );
      return result;
    } catch (error) {
      await this.ctx
        .runMutation(this.component.lib.completeSpan, {
          spanId: childSpanId,
          endTime: Date.now(),
          duration: Date.now() - startTime,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        })
        .catch((err) =>
          console.error("[Tracer] Failed to complete span with error:", err),
        );

      if (this.config.preserveErrors) {
        this.preserve();
      }
      throw error;
    }
  }

  private createNoOpSpanAPI(): SpanAPI {
    return {
      info: async () => {},
      warn: async () => {},
      error: async () => {},
      updateMetadata: async () => {},
      withSpan: async <T>(): Promise<T> => {
        return undefined as any;
      },
    };
  }
}
