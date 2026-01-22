import { useAction, useMutation } from "convex/react";

import type { FunctionReference, FunctionReturnType } from "convex/server";
import type { EmptyObject, OptionalTracedArgs } from "./types";

export function useTracedQuery<TQuery extends FunctionReference<"mutation">>(
  fnRef: TQuery,
): OptionalTracedArgs<TQuery> extends [args?: EmptyObject]
  ? (args?: EmptyObject) => Promise<FunctionReturnType<TQuery>>
  : OptionalTracedArgs<TQuery> extends [args: infer Args]
    ? (args: Args) => Promise<FunctionReturnType<TQuery>>
    : never {
  return useMutation(fnRef) as any;
}

export function useTracedMutation<
  TMutation extends FunctionReference<"mutation">,
>(
  fnRef: TMutation,
): OptionalTracedArgs<TMutation> extends [args?: EmptyObject]
  ? (args?: EmptyObject) => Promise<FunctionReturnType<TMutation>>
  : OptionalTracedArgs<TMutation> extends [args: infer Args]
    ? (args: Args) => Promise<FunctionReturnType<TMutation>>
    : never {
  return useMutation(fnRef) as any;
}

export function useTracedAction<TAction extends FunctionReference<"action">>(
  fnRef: TAction,
): OptionalTracedArgs<TAction> extends [args?: EmptyObject]
  ? (args?: EmptyObject) => Promise<FunctionReturnType<TAction>>
  : OptionalTracedArgs<TAction> extends [args: infer Args]
    ? (args: Args) => Promise<FunctionReturnType<TAction>>
    : never {
  return useAction(fnRef) as any;
}
