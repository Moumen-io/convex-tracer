import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  customers: defineTable({
    name: v.string(),
    email: v.string(),
    creditLimit: v.number(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  products: defineTable({
    name: v.string(),
    description: v.string(),
    price: v.number(),
    category: v.string(),
    sku: v.string(),
    createdAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_sku", ["sku"]),

  inventory: defineTable({
    productId: v.id("products"),
    quantity: v.number(),
    reserved: v.number(),
    warehouseLocation: v.string(),
    lastRestocked: v.number(),
  }).index("by_product", ["productId"]),

  orders: defineTable({
    customerId: v.id("customers"),
    items: v.array(
      v.object({
        productId: v.id("products"),
        quantity: v.number(),
      }),
    ),
    total: v.number(),
    status: v.string(), // pending, confirmed, payment_failed, inventory_failed, shipped, delivered
    paymentMethod: v.string(),
    transactionId: v.optional(v.string()),
    createdAt: v.number(),
    confirmedAt: v.optional(v.number()),
    shippedAt: v.optional(v.number()),
  })
    .index("by_customer", ["customerId"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  payments: defineTable({
    orderId: v.id("orders"),
    amount: v.number(),
    paymentMethod: v.string(),
    transactionId: v.string(),
    status: v.string(), // completed, failed, refunded
    processedAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_transaction", ["transactionId"]),
});
