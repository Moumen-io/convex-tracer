import { useAction, useMutation } from "convex/react";

import type {
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
  
} from "convex/server";
import type { AnyFunctionReference } from "../client/types";


type EmptyObject = Record<string, never>;

// Utility type to omit __traceContext from args
type OmitTraceContext<T> = T extends { __traceContext?: any }
  ? Omit<T, "__traceContext">
  : T;

type OptionalTracedArgs<FuncRef extends AnyFunctionReference> =
  keyof OmitTraceContext<FuncRef["_args"]> extends never
    ? [args?: EmptyObject]
    : [args: OmitTraceContext<FuncRef["_args"]>];