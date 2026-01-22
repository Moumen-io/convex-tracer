import { FunctionReference } from "convex/server";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";

import { useTracedMutation } from "convex-tracer/react";
import { cn } from "../lib/utils";

type FunctionDef = {
  name: string;
  funcRef: FunctionReference<any, "public">;
  type: "query" | "mutation" | "action";
  args?: Record<string, any>;
};

const DEMO_FUNCTIONS: FunctionDef[] = [
  {
    name: "getCustomers",
    funcRef: api.shop.getCustomers,
    type: "query",
  },
  {
    name: "getProducts",
    funcRef: api.shop.getProducts,
    type: "query",
  },
  {
    name: "getProductWithInventory",
    funcRef: api.shop.getProductWithInventory,
    type: "query",
    args: {
      productId: "jx7e2m2dwmxmv2k95b7421hf717zkc8w",
    },
  },
  {
    name: "createOrder",
    funcRef: api.shop.createOrder,
    type: "mutation",
    args: {
      customerId: "jd7b68pe8fmwsw065yprk2hzns7zk5jv",
      items: [
        {
          productId: "jx7e2m2dwmxmv2k95b7421hf717zkc8w",
          quantity: 1,
        },
      ],
      paymentMethod: "credit_card",
    },
  },
];

export function FunctionSidebar() {
  const [selectedFunction, setSelectedFunction] = useState<FunctionDef>(
    DEMO_FUNCTIONS[0],
  );
  const [functionArgs, setFunctionArgs] = useState<
    Record<string, any> | undefined
  >(DEMO_FUNCTIONS[0].args);

  const [fnReturn, setFnReturn] = useState<any>();

  const [isLoading, setIsLoading] = useState(false);

  const handleFunctionSelect = (funcName: string) => {
    const func = DEMO_FUNCTIONS.find((f) => f.name === funcName);
    if (func) {
      setSelectedFunction(func);
      setFunctionArgs(func.args);
    }
  };

  const executeMutation = useTracedMutation(selectedFunction.funcRef);

  const tracedMutation = useTracedMutation(api.shop.getProductWithInventory);

  const executeFunction = async () => {
    setIsLoading(true);
    if (
      selectedFunction.type === "query" ||
      selectedFunction.type === "mutation"
    ) {
      let result;

      const a = await tracedMutation();
      console.log(a);

      if (!functionArgs) {
        result = await executeMutation({});
      } else {
        result = await executeMutation({ ...functionArgs });
      }

      setFnReturn(result);
    } else {
      console.log("action");
    }
    setIsLoading(false);
  };

  // Update an item in an array of objects
  const updateArrayItem = (
    key: string,
    index: number,
    subKey: string,
    value: string,
  ) => {
    setFunctionArgs((prev) => {
      const newArgs = { ...prev };
      const array = [...(newArgs[key] as any[])];
      const currentValue = array[index][subKey];
      const newValue = typeof currentValue === "number" ? Number(value) : value;
      array[index] = { ...array[index], [subKey]: newValue };
      newArgs[key] = array;
      return newArgs;
    });
  };

  // Update an item in an array of primitives
  const updateArrayPrimitive = (key: string, index: number, value: string) => {
    setFunctionArgs((prev) => {
      const newArgs = { ...prev };
      const array = [...(newArgs[key] as any[])];
      const currentValue = array[index];
      const newValue = typeof currentValue === "number" ? Number(value) : value;
      array[index] = newValue;
      newArgs[key] = array;
      return newArgs;
    });
  };

  // Update existing updateArg and updateNestedArg to support numbers too
  const updateArg = (key: string, value: string) => {
    setFunctionArgs((prev) => {
      const currentValue = prev?.[key];
      const newValue = typeof currentValue === "number" ? Number(value) : value;
      return { ...prev, [key]: newValue };
    });
  };

  const updateNestedArg = (key: string, subKey: string, value: string) => {
    setFunctionArgs((prev) => {
      const currentValue = (prev?.[key] as any)?.[subKey];
      const newValue = typeof currentValue === "number" ? Number(value) : value;
      return {
        ...prev,
        [key]: { ...(prev?.[key] as object), [subKey]: newValue },
      };
    });
  };

  const getResponse = () => {
    const val = fnReturn;
    if (typeof fnReturn !== "object") return val;

    try {
      const newVal = { ...val };

      if (val.error) {
        try {
          const e = JSON.parse(val.error);
          newVal.error = e;
        } catch (e) {
          console.warn("skipping error parsing", e);
        }
      }
      return JSON.stringify(val, null, 2);
    } catch (e) {
      console.info("skipping error parsing", e);
      return val;
    }
  };

  return (
    <div className="w-96 border-l bg-muted/10 p-6 overflow-auto">
      <h2 className="text-xl font-bold mb-4">Test Functions</h2>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">
            Select Function
          </label>

          <Select
            value={selectedFunction?.name}
            onValueChange={handleFunctionSelect}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a function..." />
            </SelectTrigger>
            <SelectContent>
              {DEMO_FUNCTIONS.map((func) => (
                <SelectItem key={func.name} value={func.name}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{func.type}</Badge>
                    <span>{func.name.split(".").pop()}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedFunction && (
          <Card className="gap-2">
            <CardHeader>
              <CardTitle className="text-base">Arguments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(functionArgs || {}).map(([key, value]) => (
                <div key={key}>
                  {typeof value === "object" && !Array.isArray(value) ? (
                    // Handle nested objects
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{key}</label>
                      {Object.entries(value).map(([subKey, subValue]) => (
                        <Input
                          key={subKey}
                          placeholder={subKey}
                          value={subValue as string}
                          onChange={(e) =>
                            updateNestedArg(key, subKey, e.target.value)
                          }
                        />
                      ))}
                    </div>
                  ) : Array.isArray(value) ? (
                    // Handle arrays
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{key}</label>
                      {value.map((item, index) => (
                        <div
                          key={index}
                          className="border rounded-lg p-3 space-y-2"
                        >
                          <div className="text-xs text-gray-500 mb-2">
                            Item {index + 1}
                          </div>
                          {typeof item === "object" && !Array.isArray(item) ? (
                            // Array of objects
                            Object.entries(item).map(([subKey, subValue]) => (
                              <div key={subKey}>
                                <label className="text-xs text-gray-600">
                                  {subKey}
                                </label>
                                <Input
                                  placeholder={subKey}
                                  value={subValue as string}
                                  onChange={(e) =>
                                    updateArrayItem(
                                      key,
                                      index,
                                      subKey,
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>
                            ))
                          ) : (
                            // Array of primitives
                            <Input
                              placeholder={`${key}[${index}]`}
                              value={item as string}
                              onChange={(e) =>
                                updateArrayPrimitive(key, index, e.target.value)
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Handle primitive values
                    <div>
                      <label className="text-sm font-medium block mb-1">
                        {key}
                      </label>
                      <Input
                        placeholder={key}
                        value={value as string}
                        onChange={(e) => updateArg(key, e.target.value)}
                        type={typeof value === "number" ? "number" : "text"}
                      />
                    </div>
                  )}
                </div>
              ))}
              <Button
                onClick={executeFunction}
                disabled={isLoading}
                className={cn("w-full mt-4 hover:cursor-pointer")}
              >
                Execute Function
              </Button>
            </CardContent>
          </Card>
        )}

        <Separator className="my-6" />

        <div>
          <h3 className="text-sm font-semibold mb-2">Response</h3>
          <div className="space-y-2">
            <pre className="text-xs overflow-auto">{getResponse()}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
