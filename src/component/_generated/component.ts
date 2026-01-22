/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      addLog: FunctionReference<
        "mutation",
        "internal",
        {
          log: {
            message: string;
            metadata?: Record<string, any>;
            severity: "info" | "warn" | "error";
            timestamp: number;
          };
          spanId: string;
        },
        string,
        Name
      >;
      cleanupTrace: FunctionReference<
        "mutation",
        "internal",
        { traceId: string },
        null,
        Name
      >;
      completeSpan: FunctionReference<
        "mutation",
        "internal",
        {
          duration: number;
          endTime: number;
          error?: string;
          result?: any;
          spanId: string;
          status: "success" | "error";
        },
        null,
        Name
      >;
      createSpan: FunctionReference<
        "mutation",
        "internal",
        {
          span: {
            args?: any;
            functionName?: string;
            parentSpanId?: string;
            source: "frontend" | "backend";
            spanName: string;
            startTime: number;
            status: "pending" | "success" | "error";
          };
          traceId: string;
        },
        string,
        Name
      >;
      createTrace: FunctionReference<
        "mutation",
        "internal",
        {
          metadata?: Record<string, any>;
          sampleRate: number;
          source: "frontend" | "backend";
          status: "pending" | "success" | "error";
        },
        string,
        Name
      >;
      getTrace: FunctionReference<
        "query",
        "internal",
        { traceId: string },
        null | {
          _creationTime: number;
          _id: string;
          metadata?: Record<string, any>;
          preserve?: boolean;
          sampleRate: number;
          spans: Array<{
            _creationTime: number;
            _id: string;
            args?: any;
            children?: Array<any>;
            duration?: number;
            endTime?: number;
            error?: string;
            functionName?: string;
            logs?: Array<{
              _creationTime: number;
              _id: string;
              message: string;
              metadata?: Record<string, any>;
              severity: "info" | "warn" | "error";
              spanId: string;
              timestamp: number;
            }>;
            metadata?: Record<string, any>;
            parentSpanId?: string;
            result?: any;
            source: "frontend" | "backend";
            spanName: string;
            startTime: number;
            status: "pending" | "success" | "error";
            traceId: string;
          }>;
          status: "pending" | "success" | "error";
          updatedAt: number;
          userId?: string;
        },
        Name
      >;
      listTraces: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          status?: "pending" | "success" | "error";
          userId?: string;
        },
        Array<{
          _creationTime: number;
          _id: string;
          metadata?: Record<string, any>;
          preserve?: boolean;
          sampleRate: number;
          status: "pending" | "success" | "error";
          updatedAt: number;
          userId?: string;
        }>,
        Name
      >;
      updateSpanMetadata: FunctionReference<
        "mutation",
        "internal",
        { metadata: Record<string, any>; spanId: string },
        null,
        Name
      >;
      updateTraceMetadata: FunctionReference<
        "mutation",
        "internal",
        { metadata: Record<string, any>; traceId: string },
        null,
        Name
      >;
      updateTracePreserve: FunctionReference<
        "mutation",
        "internal",
        { preserve?: boolean; sampleRate?: number; traceId: string },
        null,
        Name
      >;
      updateTraceStatus: FunctionReference<
        "mutation",
        "internal",
        { status: "pending" | "success" | "error"; traceId: string },
        null,
        Name
      >;
      verifySpan: FunctionReference<
        "query",
        "internal",
        { spanId: string },
        boolean,
        Name
      >;
      verifyTrace: FunctionReference<
        "query",
        "internal",
        { traceId: string },
        boolean,
        Name
      >;
    };
  };
