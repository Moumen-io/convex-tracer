import type { AnyFunctionReference } from "../client/types";

export type EmptyObject = Record<string, never>;

export type OmitTraceContext<T> = T extends { __traceContext?: any }
  ? Omit<T, "__traceContext">
  : T;

export type ArgsWithoutTrace<Args> =
  Args extends Record<string, any> ? OmitTraceContext<Args> : Args;

export type OptionalTracedArgs<FuncRef extends AnyFunctionReference> =
  keyof OmitTraceContext<FuncRef["_args"]> extends never
    ? [args?: EmptyObject]
    : [args: OmitTraceContext<FuncRef["_args"]>];
