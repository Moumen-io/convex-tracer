import { useAction, useMutation } from "convex/react";

import type {
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
} from "convex/server";
import type { AnyFunctionReference } from "../client/types";

type EmptyObject = Record<string, never>;

type OmitTraceContext<T> = T extends { __traceContext?: any }
  ? Omit<T, "__traceContext">
  : T;

type ArgsWithoutTrace<Args> =
  Args extends Record<string, any> ? OmitTraceContext<Args> : Args;

type OptionalTracedArgs<FuncRef extends AnyFunctionReference> =
  keyof OmitTraceContext<FuncRef["_args"]> extends never
    ? [args?: EmptyObject]
    : [args: OmitTraceContext<FuncRef["_args"]>];

export function useTracedMutation<
  Mutation extends FunctionReference<"mutation">,
>(
  fnRef: Mutation,
): OptionalTracedArgs<Mutation> extends [args?: EmptyObject]
  ? (args?: EmptyObject) => Promise<FunctionReturnType<Mutation>>
  : OptionalTracedArgs<Mutation> extends [args: infer Args]
    ? (args: Args) => Promise<FunctionReturnType<Mutation>>
    : never {
  return useMutation(fnRef) as any;
}

// Wrapper for useAction that excludes __traceContext
export function useTracedAction<Action extends FunctionReference<"action">>(
  fnRef: Action,
): OptionalRestArgs<Action> extends [infer Args]
  ? (args: ArgsWithoutTrace<Args>) => Promise<FunctionReturnType<Action>>
  : () => Promise<FunctionReturnType<Action>> {
  const execute = useAction(fnRef);

  return execute as any;
}

export function useTracedQuery<Mutation extends FunctionReference<"mutation">>(
  fnRef: Mutation,
): OptionalRestArgs<Mutation> extends [infer Args]
  ? (args: ArgsWithoutTrace<Args>) => Promise<FunctionReturnType<Mutation>>
  : () => Promise<FunctionReturnType<Mutation>> {
  return useMutation(fnRef) as any;
}
