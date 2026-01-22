# Convex Tracer

[![npm version](https://badge.fury.io/js/convex-tracer.svg)](https://badge.fury.io/js/convex-tracer)

<!-- START: Include on https://convex.dev/components -->

**Powerful Observability and tracing for Convex applications.** Track function
calls across queries, mutations, and actions with detailed insights, nested
spans, and automatic error tracking.

## Why use Convex Tracer?

- **Deep Visibility**: See exactly how your Convex functions execute, including
  nested calls and cross-function traces
- **Debug Production Issues**: Preserve error traces and have a complete view of
  of what went wrong, were it went wrong and why
- **Trace Sampling**: Control costs with configurable sample rates while
  preserving important traces
- **Zero Boilerplate**: Simple wrapper functions that feel natural in Convex

Perfect for complex workflows like multi-step order processing, payment flows,
or any scenario where you need to understand what's happening across multiple
function calls.

## Installation

Install the component:

```bash
npm install convex-tracer
```

Create a `convex.config.ts` file in your app's `convex/` folder and install the
component:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import tracer from "convex-tracer/convex.config";

const app = defineApp();
app.use(tracer);

export default app;
```

## Quick Start

Create a tracer instance in your Convex backend:

```ts
// convex/tracer.ts
import { Tracer } from "convex-tracer";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";

export const {
  tracedQuery,
  tracedMutation,
  tracedAction,
  internalTracedQuery,
  internalTracedMutation,
  internalTracedAction,
  tracer,
} = new Tracer<DataModel>(
  components.tracer,
  // Default options
  {
    sampleRate: 0.1, // Sample 10% of traces
    preserveErrors: true, // Always keep error traces
    retentionMinutes: 120, // Keep traces for 2 hours
  },
);
```

Use traced functions just like regular Convex functions:

```ts
// convex/shop.ts
import { v } from "convex/values";
import { tracedMutation } from "./tracer";

export const createOrder = tracedMutation({
  name: "createOrder",
  args: {
    customerId: v.id("customers"),
    items: v.array(
      v.object({
        productId: v.id("products"),
        quantity: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.tracer.info("Starting order creation", {
      customerId: args.customerId,
      itemCount: args.items.length,
    });

    // Your business logic here
    const orderId = await ctx.db.insert("orders", {
      customerId: args.customerId,
      items: args.items,
      status: "pending",
    });

    await ctx.tracer.info("Order created successfully", { orderId });

    return orderId;
  },
});
```

## Core Features

### Nested Spans

Create detailed traces with nested operations:

```ts
export const processPayment = tracedMutation({
  name: "processPayment",
  args: { orderId: v.id("orders"), amount: v.number() },
  handler: async (ctx, { orderId, amount }) => {
    for (const item of items) {
      const reservation = await ctx.tracer.withSpan(
        `reserveItem_${item.productId}`,
        async (span) => {
          await span.updateMetadata({
            productId: item.productId,
            requestedQty: item.quantity,
          });

          const inventory = await ctx.db
            .query("inventory")
            .withIndex("by_product", (q) => q.eq("productId", item.productId))
            .first();

          // More logic here
        },
      );
    }

    return result;
  },
});
```

### Cross-Function Tracing

Automatically trace calls across multiple functions:

```ts
export const createOrder = tracedMutation({
  name: "createOrder",
  args: { customerId: v.id("customers"), items: v.array(...) },
  handler: async (ctx, args) => {
    // This call is automatically traced as part of the same trace
    const validation = await ctx.runTracedMutation(
      internal.shop.validateCustomer,
      { customerId: args.customerId }
    );

    // Process payment - also traced
    const payment = await ctx.runTracedMutation(
      internal.shop.processPayment,
      { orderId, amount: total }
    );

    return { orderId, status: "confirmed" };
  },
});
```

### Lifecycle Hooks

Control trace behavior with lifecycle callbacks:

```ts
export const getProductWithInventory = tracedQuery({
  name: "getProductWithInventory",
  args: { productId: v.id("products") },
  onSuccess: async (ctx, args, result) => {
    if (result.inventory < 10) {
      await ctx.tracer.warn("Low inventory detected", {
        productId: args.productId,
        inventory: result.inventory,
      });
      await ctx.tracer.preserve(); // Keep this trace!
    }
  },
  onError: async (ctx, args, error) => {
    await ctx.tracer.error("Product fetch failed", {
      productId: args.productId,
      error: error.message,
    });
  },
  handler: async (ctx, { productId }) => {
    const product = await ctx.db.get(productId);
    const inventory = await checkInventory(ctx, productId);
    return { ...product, inventory };
  },
});
```

### Logging and Metadata

Rich logging at different severity levels:

```ts
await ctx.tracer.info("Processing step complete", { step: 1 });
await ctx.tracer.warn("Approaching rate limit", { remaining: 10 });
await ctx.tracer.error("Validation failed", { reason: "INVALID_EMAIL" });

// Add metadata to the current span
await ctx.tracer.updateMetadata({
  userId: user._id,
  planType: "premium",
});
```

## Configuration Options

### Global Configuration

```ts
new Tracer<DataModel>(components.tracer, {
  sampleRate: 0.1, // Sample 10% of traces (0.0-1.0)
  preserveErrors: true, // Always preserve error traces
  retentionMinutes: 120, // Keep traces for 2 hours
});
```

### Per-Function Configuration

```ts
export const myFunction = tracedMutation({
  name: "myFunction",
  args: { userId: v.id("users") },

  // Tracing options
  sampleRate: 1.0, // Override: trace 100% of calls
  logArgs: ["userId"], // Log specific arguments or all with "true"
  logReturn: true, // Log the return value

  // Lifecycle hooks
  onStart: async (ctx, args) => {
    await ctx.tracer.info("Function will start");
  },
  onSuccess: async (ctx, args, result) => {
    await ctx.tracer.info("Function succeeded", { result });
  },
  onError: async (ctx, args, error) => {
    await ctx.tracer.error("Function failed", { error: error.message });
  },

  handler: async (ctx, args) => {
    // Your logic here
  },
});
```

## API Reference

### Tracer Context Methods

All traced functions receive an enhanced context with these methods:

#### `ctx.tracer.info(message, metadata?)`

Log an info-level message with optional metadata.

#### `ctx.tracer.warn(message, metadata?)`

Log a warning-level message.

#### `ctx.tracer.error(message, metadata?)`

Log an error-level message.

#### `ctx.tracer.updateMetadata(metadata)`

Add metadata to the current span.

#### `ctx.tracer.preserve()`

Mark this trace to be preserved regardless of sample rate.

#### `ctx.tracer.discard()`

Discard this trace.

#### `ctx.tracer.sample(sampleRate?)`

Sample this trace with an optional override for the sample rate.

#### `ctx.tracer.withSpan(name, callback)`

Create a nested span for a block of code:

```ts
const result = await ctx.tracer.withSpan("spanName", async (span) => {
  await span.info("Inside nested span");
  await span.updateMetadata({ key: "value" });
  return someValue;
});
```

##### `span.info(message, metadata?)`

Log an info-level message with optional metadata.

##### `span.warn(message, metadata?)`

Log a warning-level message.

##### `span.error(message, metadata?)`

Log an error-level message.

##### `span.updateMetadata(metadata)`

Add metadata to the current span.

##### `span.withSpan(name, callback)`

Create a nested span for a block of code:

```ts
const result = await span.withSpan("createPost", async (span) => {
  await span.info("Creating post");
  return await ctx.db.insert("posts", args);
});
```

#### `ctx.runTracedQuery(funcRef, args)`

Call another traced query while maintaining the trace context.

#### `ctx.runTracedMutation(funcRef, args)`

Call another traced mutation while maintaining the trace context.

#### `ctx.runTracedAction(funcRef, args)`

Call another traced action while maintaining the trace context (actions only).

### Retrieving Traces

Query traces from your frontend or other functions:

```ts
// In your convex functions
import { tracer } from "./tracer";

export const getTrace = query({
  args: { traceId: v.string() },
  handler: async (ctx, args) => {
    return await tracer.tracer.getTrace(ctx, args.traceId);
  },
});

export const listTraces = query({
  args: {
    status: v.optional(v.union(v.literal("success"), v.literal("error"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await tracer.tracer.listTraces(ctx, args);
  },
});
```

### React Hooks

Use traced functions in your React components:

```ts
import { useTracedMutation } from "convex-tracer/react";
import { api } from "../convex/_generated/api";

function MyComponent() {
  const createOrder = useTracedMutation(api.shop.createOrder);

  const handleOrder = async () => {
    const result = await createOrder({
      customerId: "...",
      items: [...]
    });

    if (result.success) {
      console.log("Order created:", result.data);
    } else {
      console.error("Order failed:", result.error);
    }
  };

  return <button onClick={handleOrder}>Create Order</button>;
}
```

## Advanced Patterns

### Multi-Step Workflows

Trace complex workflows across multiple functions:

```ts
export const processOrder = tracedMutation({
  name: "processOrder",
  handler: async (ctx, args) => {
    // Step 1: Validate customer
    const validation = await ctx.runTracedQuery(internal.validateCustomer, {
      customerId: args.customerId,
    });

    // Step 2: Reserve inventory
    await ctx.runTracedMutation(internal.reserveInventory, {
      items: args.items,
    });

    // Step 3: Process payment
    await ctx.runTracedMutation(internal.processPayment, { amount: total });

    // Step 4: Send notifications (async)
    await ctx.scheduler.runAfter(0, api.sendNotification, {
      orderId,
      __traceContext: {
        traceId: ctx.tracer.getTraceId(),
        spanId: ctx.tracer.getSpanId(),
      },
    });
  },
});
```

### Conditional Preservation

Preserve traces based on business logic:

```ts
export const placeOrder = tracedMutation({
  name: "placeOrder",
  onSuccess: async (ctx, args, result) => {
    // Preserve high-value orders
    if (result.total > 1000) {
      await ctx.tracer.preserve();
    }

    // Preserve orders from VIP customers
    const customer = await ctx.db.get(args.customerId);
    if (customer.vipStatus) {
      await ctx.tracer.preserve();
    }
  },
  handler: async (ctx, args) => {
    // Process order...
  },
});
```

## Examples

See more detailed examples in `example/convex/shop.ts`

Found a bug? Feature request?
[File it here](https://github.com/Moumen-io/convex-tracer/issues).

## Best Practices

1. **Use descriptive span names**: `"validatePaymentMethod"` not `"step1"`
2. **Add relevant metadata**: Include IDs, counts, and business-relevant data
3. **Preserve strategically**: Don't preserve everything. Focus on errors and
   edge cases
4. **Sample appropriately**: Use low sample rates in production (0.05-0.15)
5. **Log at the right level**: `info` for normal flow, `warn` for concerning but
   handled issues, `error` for failures

### ⚠️ Important: TracedQueries Run as Mutations

**Critical difference from other traced functions**: `tracedQuery` functions run
as **mutations**, not queries. This is necessary to enable tracing (which
requires writes to the trace tables), but it has important implications:

#### Breaking Change: Loss of Reactivity

Unlike regular Convex queries, `tracedQuery` results **do not update
reactively**. This means:

- ❌ Your UI won't automatically re-render when data changes
- ❌ You lose Convex's real-time subscription benefits
- ❌ You must manually refetch to get updated data

#### When to Use TracedQueries

Use `tracedQuery` only when you specifically need tracing:

- ✅ Understanding complex data flows
- ✅ Data fetches that don't need reactivity
- ✅ Debugging production issues
- ✅ Performance profiling

**For normal queries that need reactivity, use regular `query()` functions.**

#### Pattern: Shared Logic Between Queries and TracedQueries

To maintain both reactive queries for your UI and traced queries for debugging,
extract your business logic into a shared helper:

```ts
// convex/helpers/products.ts
import { QueryCtx } from "../_generated/server";
import { Id } from "./_generated/dataModel";

// Shared business logic - no tracing
export async function getProductWithInventoryLogic(
  ctx: Pick<QueryCtx, "db">,
  productId: Id<"products">,
) {
  const product = await ctx.db.get(productId);
  if (!product) {
    throw new Error("Product not found");
  }

  const inventory = await ctx.db
    .query("inventory")
    .withIndex("by_product", (q) => q.eq("productId", productId))
    .first();

  return {
    ...product,
    inventory: inventory?.quantity || 0,
  };
}
```

```ts
// convex/products.ts
import { v } from "convex/values";
import { query } from "./_generated/server";
import { tracedQuery } from "./tracer";
import { getProductWithInventoryLogic } from "./helpers/products";

// Regular query - USE THIS IN YOUR UI (reactive)
export const getProductWithInventory = query({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    return await getProductWithInventoryLogic(ctx, productId);
  },
});

// Traced query (not reactive)
export const getProductWithInventoryTraced = tracedQuery({
  name: "getProductWithInventory",
  args: { productId: v.string() },
  logArgs: ["productId"],
  onSuccess: async (ctx, args, result) => {
    if (result.inventory < 10) {
      await ctx.tracer.warn("Low inventory", {
        productId: args.productId,
        inventory: result.inventory,
      });
      await ctx.tracer.preserve();
    }
  },
  handler: async (ctx, { productId }) => {
    await ctx.tracer.info("Fetching product", { productId });

    // Reuse the same business logic
    const result = await getProductWithInventoryLogic(ctx, productId);

    await ctx.tracer.info("Product fetched", {
      productId,
      inventory: result.inventory,
    });

    return result;
  },
});
```

For queries that sometimes need tracing, you can conditionally call either
version

<!-- END: Include on https://convex.dev/components -->

Run the example:

```sh
npm i
npm run dev
```
