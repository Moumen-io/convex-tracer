import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  internalTracedMutation,
  internalTracedQuery,
  tracedAction,
  tracedMutation,
  tracedQuery,
} from "./tracer";

// ============================================================================
// QUERY: Get Customers
// ============================================================================
export const getCustomers = tracedQuery({
  name: "getCustomers",

  onSuccess: async (ctx, _, result) => {
    await ctx.tracer.info("Succeeded fetching customers");
  },
  handler: async (ctx) => {
    await ctx.tracer.info("fetching customers");
    const customers = await ctx.db.query("customers").collect();

    await ctx.tracer.info("customers fetched", {
      customerIds: customers.map((c) => c._id),
    });

    return customers;
  },
});

// ============================================================================
// QUERY: Get Products
// ============================================================================
export const getProducts = tracedQuery({
  name: "getProducts",
  onSuccess: async (ctx, args, result) => {
    await ctx.tracer.info("Succeeded fetching products");
  },
  handler: async (ctx, {}) => {
    await ctx.tracer.info("fetching products");
    const products = await ctx.db.query("products").collect();

    await ctx.tracer.info("products fetched", {
      productIds: products.map((p) => p._id),
    });
    return products;
  },
});

// ============================================================================
// QUERY: Get Product with Inventory Check
// ============================================================================
export const getProductWithInventory = tracedQuery({
  name: "getProductWithInventory",
  // using string to simulate failure on query and not at validator
  args: { productId: v.string() },
  logArgs: ["productId"],
  logReturn: true,
  sampleRate: 0.5,
  onSuccess: async (ctx, args, result) => {
    if (result.inventory < 10) {
      await ctx.tracer.warn("Low inventory detected", {
        productId: args.productId,
        inventory: result.inventory,
      });
      await ctx.tracer.preserve(); // Preserve low inventory traces
    }
  },
  handler: async (ctx, { productId }) => {
    await ctx.tracer.info("Fetching product details", { productId });

    const product = await ctx.db.get("products", productId as Id<"products">);
    if (!product) {
      await ctx.tracer.error("Product not found", { productId });
      throw new ConvexError({ code: "NOT_FOUND", productId });
    }

    // Simulate inventory check with span
    const inventory = await ctx.tracer.withSpan(
      "checkInventory",
      async (span) => {
        await span.updateMetadata({ productId, warehouse: "primary" });

        // Simulate inventory fetch
        const inv = await ctx.db
          .query("inventory")
          .withIndex("by_product", (q) =>
            q.eq("productId", productId as Id<"products">),
          )
          .first();

        await span.updateMetadata({
          inventoryFound: !!inv,
          quantity: inv?.quantity || 0,
        });
        return inv?.quantity || 0;
      },
    );

    await ctx.tracer.info("Product fetched successfully", {
      productId,
      inventory,
      price: product.price,
    });

    return { ...product, inventory };
  },
});

// ============================================================================
// INTERNAL QUERY: Validate Customer Eligibility
// ============================================================================
export const validateCustomer = internalTracedQuery({
  name: "validateCustomer",
  args: { customerId: v.id("customers"), orderTotal: v.number() },
  logArgs: ["customerId", "orderTotal"],
  logReturn: true,
  onSuccess: async (ctx, args, result) => {
    if (!result.eligible) {
      await ctx.tracer.preserve();
      await ctx.tracer.warn("Customer validation failed", {
        customerId: args.customerId,
        reason: result.reason,
      });
    }
  },
  handler: async (ctx, { customerId, orderTotal }) => {
    await ctx.tracer.info("Validating customer eligibility");

    const customer = await ctx.db.get(customerId);
    if (!customer) {
      throw new ConvexError({ code: "CUSTOMER_NOT_FOUND", customerId });
    }

    // Check credit limit
    const creditCheck = await ctx.tracer.withSpan(
      "creditLimitCheck",
      async (span) => {
        await span.updateMetadata({
          customerId,
          creditLimit: customer.creditLimit,
          orderTotal,
        });

        const eligible = customer.creditLimit >= orderTotal;
        await span.updateMetadata({ eligible });

        return { eligible, creditLimit: customer.creditLimit };
      },
    );

    // Check payment history
    const paymentHistory = await ctx.tracer.withSpan(
      "paymentHistoryCheck",
      async (span) => {
        const recentOrders = await ctx.db
          .query("orders")
          .withIndex("by_customer", (q) => q.eq("customerId", customerId))
          .order("desc")
          .take(5);

        const failedPayments = recentOrders.filter(
          (o) => o.status === "payment_failed",
        ).length;
        const hasGoodHistory = failedPayments <= 3;

        await span.updateMetadata({
          recentOrderCount: recentOrders.length,
          failedPayments,
          hasGoodHistory,
        });

        return { hasGoodHistory, failedPayments };
      },
    );

    const eligible = creditCheck.eligible && paymentHistory.hasGoodHistory;
    const reason = !creditCheck.eligible
      ? "CREDIT_LIMIT_EXCEEDED"
      : !paymentHistory.hasGoodHistory
        ? "POOR_PAYMENT_HISTORY"
        : null;

    await ctx.tracer.info("Customer validation complete", {
      eligible,
      reason,
      customerId,
    });

    return { eligible, reason, customer };
  },
});

// ============================================================================
// INTERNAL MUTATION: Process Payment
// ============================================================================
export const processPayment = internalTracedMutation({
  name: "processPayment",
  args: {
    orderId: v.id("orders"),
    amount: v.number(),
    paymentMethod: v.string(),
  },
  logArgs: ["orderId", "amount"],
  onSuccess: async (ctx, args, result) => {
    await ctx.tracer.info("Payment processed successfully", {
      orderId: args.orderId,
      transactionId: result.transactionId,
    });
  },
  onError: async (ctx, args, error) => {
    await ctx.tracer.error("Payment processing failed", {
      orderId: args.orderId,
      amount: args.amount,
      error: error.message,
    });
  },
  handler: async (ctx, { orderId, amount, paymentMethod }) => {
    await ctx.tracer.info("Initiating payment processing", {
      orderId,
      amount,
      paymentMethod,
    });

    // Simulate payment gateway call
    const paymentResult = await ctx.tracer.withSpan(
      "paymentGatewayCall",
      async (span) => {
        await span.updateMetadata({ gateway: "stripe", amount, paymentMethod });

        // Simulate random payment failure (10% chance)
        const success = Math.random() > 0.1;

        if (!success) {
          const code = "PAYMENT_FAILED";
          const reason = "INSUFFICIENT_FUNDS";

          await span.updateMetadata({ success: false, reason, code });
          throw new ConvexError(code);
        }

        const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await span.updateMetadata({ success: true, transactionId });

        return { transactionId, status: "succeeded" };
      },
    );

    // Record payment in database
    await ctx.db.insert("payments", {
      orderId,
      amount,
      paymentMethod,
      transactionId: paymentResult.transactionId,
      status: "completed",
      processedAt: Date.now(),
    });

    await ctx.tracer.info("Payment recorded in database", {
      transactionId: paymentResult.transactionId,
    });

    return paymentResult;
  },
});

// ============================================================================
// INTERNAL MUTATION: Reserve Inventory
// ============================================================================
export const reserveInventory = internalTracedMutation({
  name: "reserveInventory",
  args: {
    items: v.array(
      v.object({
        productId: v.id("products"),
        quantity: v.number(),
      }),
    ),
    orderId: v.id("orders"),
  },
  logArgs: ["orderId"],
  handler: async (ctx, { items, orderId }) => {
    await ctx.tracer.info("Starting inventory reservation", {
      orderId,
      itemCount: items.length,
    });

    const reservations: {
      productId: string;
      quantity: number;
    }[] = [];

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

          if (!inventory || inventory.quantity < item.quantity) {
            await span.updateMetadata({
              available: inventory?.quantity || 0,
              insufficient: true,
            });
            throw new ConvexError({
              code: "INSUFFICIENT_INVENTORY",
              productId: item.productId,
              requested: item.quantity,
              available: inventory?.quantity || 0,
            });
          }

          // Update inventory
          await ctx.db.patch(inventory._id, {
            quantity: inventory.quantity - item.quantity,
            reserved: (inventory.reserved || 0) + item.quantity,
          });

          await span.updateMetadata({
            newQuantity: inventory.quantity - item.quantity,
            success: true,
          });

          return { productId: item.productId, quantity: item.quantity };
        },
      );

      reservations.push(reservation);
    }

    await ctx.tracer.info("Inventory reservation complete", {
      orderId,
      reservationCount: reservations.length,
    });

    return reservations;
  },
});

// ============================================================================
// ACTION: Send Order Notification
// ============================================================================
export const sendOrderNotification = tracedAction({
  name: "sendOrderNotification",
  args: {
    orderId: v.id("orders"),
    customerEmail: v.string(),
    orderTotal: v.number(),
  },
  handler: async (ctx, { orderId, customerEmail, orderTotal }) => {
    await ctx.tracer.info("Sending order notification", {
      orderId,
      customerEmail,
    });

    // Simulate email sending
    await ctx.tracer.withSpan("sendEmail", async (span) => {
      await span.updateMetadata({
        to: customerEmail,
        template: "order_confirmation",
        orderId,
      });

      // Simulate external API call
      await new Promise((resolve) => setTimeout(resolve, 300));

      await span.updateMetadata({ sent: true, provider: "sendgrid" });
    });

    // Simulate SMS sending for high-value orders
    if (orderTotal > 500) {
      await ctx.tracer.withSpan("sendSMS", async (span) => {
        await span.updateMetadata({
          orderId,
          orderTotal,
          reason: "high_value_order",
        });

        await new Promise((resolve) => setTimeout(resolve, 500));
        await span.updateMetadata({ sent: true, provider: "twilio" });
      });
    }

    await ctx.tracer.info("Notifications sent successfully", { orderId });
  },
});

// ============================================================================
// MAIN MUTATION: Create Order (Multi-Depth Orchestration)
// ============================================================================
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
    paymentMethod: v.string(),
  },
  logArgs: ["customerId"],
  onStart: async (ctx, args) => {
    await ctx.tracer.info("Order creation initiated", {
      customerId: args.customerId,
      itemCount: args.items.length,
    });
  },
  onSuccess: async (ctx, args, result) => {
    await ctx.tracer.info("Order created successfully", {
      orderId: result.orderId,
      total: result.total,
      status: result.status,
    });

    // Preserve high-value orders
    if (result.total > 1000) await ctx.tracer.preserve();
  },
  onError: async (ctx, args, error) => {
    await ctx.tracer.error("Order creation failed", {
      customerId: args.customerId,
      error: error.message,
    });
  },
  handler: async (ctx, { customerId, items, paymentMethod }) => {
    // Step 1: Fetch product details and calculate total
    await ctx.tracer.info("Step 1: Fetching product details");

    const productDetails = await Promise.all(
      items.map((item) =>
        ctx.runTracedQuery(api.shop.getProductWithInventory, {
          productId: item.productId,
        }),
      ),
    );

    const total = productDetails.reduce((sum, result, idx) => {
      if (!result.success || !result.data) {
        throw new ConvexError({
          code: "PRODUCT_FETCH_FAILED",
          productId: items[idx].productId,
        });
      }
      return sum + result.data.price * items[idx].quantity;
    }, 0);

    await ctx.tracer.info("Order total calculated", {
      total,
      itemCount: items.length,
    });

    // Step 2: Validate customer
    await ctx.tracer.info("Step 2: Validating customer");

    const validationResult = await ctx.runTracedQuery(
      internal.shop.validateCustomer,
      { customerId, orderTotal: total },
    );

    if (!validationResult.success || !validationResult.data?.eligible) {
      const reason = validationResult.data?.reason || "VALIDATION_FAILED";
      const code = "CUSTOMER_INELIGIBLE";
      await ctx.tracer.error("Customer validation failed", { code, reason });
      throw new ConvexError({ code, reason });
    }

    // Step 3: Create order record
    await ctx.tracer.info("Step 3: Creating order record");

    const orderRecordId = await ctx.tracer.withSpan(
      "createOrderRecord",
      async (span) => {
        const id = await ctx.db.insert("orders", {
          customerId,
          items,
          total,
          status: "pending",
          paymentMethod,
          createdAt: Date.now(),
        });

        await span.updateMetadata({ orderId: id, total, status: "pending" });
        return id;
      },
    );

    // Step 4: Reserve inventory
    await ctx.tracer.info("Step 4: Reserving inventory");

    const inventoryResult = await ctx.runTracedMutation(
      internal.shop.reserveInventory,
      { items, orderId: orderRecordId },
    );

    if (!inventoryResult.success) {
      // Rollback: Update order status to failed
      await ctx.db.patch(orderRecordId, { status: "inventory_failed" });
      await ctx.tracer.error("Inventory reservation failed", {
        orderId: orderRecordId,
      });
      throw new ConvexError({
        code: "INVENTORY_RESERVATION_FAILED",
        details: inventoryResult.error,
      });
    }

    // Step 5: Process payment
    await ctx.tracer.info("Step 5: Processing payment");

    const paymentResult = await ctx.runTracedMutation(
      internal.shop.processPayment,
      {
        orderId: orderRecordId,
        amount: total,
        paymentMethod,
      },
    );

    if (!paymentResult.success) {
      // Rollback: Update order status and release inventory
      await ctx.db.patch(orderRecordId, { status: "payment_failed" });
      await ctx.tracer.error("Payment processing failed", {
        orderId: orderRecordId,
      });
      throw new ConvexError({
        code: "PAYMENT_FAILED",
        details: paymentResult.error,
      });
    }

    // Step 6: Update order status
    await ctx.tracer.info("Step 6: Finalizing order");

    await ctx.db.patch(orderRecordId, {
      status: "confirmed",
      confirmedAt: Date.now(),
      transactionId: paymentResult.data?.transactionId,
    });

    // Step 7: Schedule notifications (async, non-blocking)
    await ctx.tracer.info("Step 7: Scheduling notifications");

    const customer = validationResult.data.customer;
    await ctx.scheduler.runAfter(0, api.shop.sendOrderNotification, {
      orderId: orderRecordId,
      customerEmail: customer.email,
      orderTotal: total,
      __traceContext: {
        traceId: ctx.tracer.getTraceId(),
        spanId: ctx.tracer.getSpanId(),
      },
    });

    await ctx.tracer.info("Order processing complete", {
      orderId: orderRecordId,
      total,
      status: "confirmed",
    });

    return {
      status: "confirmed",
    };
  },
});

export const nestedWithSpan = tracedMutation({
  name: "nestedWithSpan",
  sampleRate: 1,
  handler: async (ctx, args) => {
    await ctx.tracer.info("Starting nested trace");
    await ctx.tracer.withSpan("nestedSpan", async (span) => {
      console.log("in nested span");
      console.log("span", span);
      await span.info("Starting updated nested span", { foo: "bar" });
      await span.warn("Warning in nested span");
      await span.withSpan("nestedSpan2", async (span2) => {
        await span2.info("Starting nested span2");
        await span2.withSpan("nestedSpan3", async (span3) => {
          await span3.info("Starting nested span3");
          await span3.withSpan("nestedSpan4", async (span4) => {
            await span4.info("Starting nested span4");
            await span4.withSpan("nestedSpan5", async (span5) => {
              await span5.info("Starting nested span5");
              await span5.withSpan("nestedSpan6", async (span6) => {
                await span6.info("Starting nested span6");
                await span6.withSpan("nestedSpan7", async (span7) => {
                  await span7.info("Starting nested span7");
                  await span7.withSpan("nestedSpan8", async (span8) => {
                    await span8.info("Starting nested span8");
                    await span8.withSpan("nestedSpan9", async (span9) => {
                      await span9.info("Starting nested span9");
                      await span9.withSpan("nestedSpan10", async (span10) => {
                        await span10.info("Starting nested span10");
                        await span10.withSpan(
                          "nestedSpan11",
                          async (span11) => {
                            await span11.info("Starting nested span11");
                            await span11.withSpan(
                              "nestedSpan12",
                              async (span12) => {
                                await span12.info("Starting nested span12");
                                await span12.withSpan(
                                  "nestedSpan13",
                                  async (span13) => {
                                    await span13.info("Starting nested span13");
                                    await span13.withSpan(
                                      "nestedSpan14",
                                      async (span14) => {
                                        await span14.info(
                                          "Started nested span14",
                                        );

                                        console.log("end of spans");
                                      },
                                    );
                                  },
                                );
                              },
                            );
                          },
                        );
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  },
});
