import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const seedDatabase = mutation({
  args: { reset: v.optional(v.boolean()) },
  handler: async (ctx, { reset }) => {
    // Optional: Clear existing data
    if (reset) {
      console.log("Clearing existing data...");
      
      const orders = await ctx.db.query("orders").collect();
      const payments = await ctx.db.query("payments").collect();
      const inventory = await ctx.db.query("inventory").collect();
      const products = await ctx.db.query("products").collect();
      const customers = await ctx.db.query("customers").collect();

      await Promise.all([
        ...payments.map(p => ctx.db.delete(p._id)),
        ...orders.map(o => ctx.db.delete(o._id)),
        ...inventory.map(i => ctx.db.delete(i._id)),
        ...products.map(p => ctx.db.delete(p._id)),
        ...customers.map(c => ctx.db.delete(c._id)),
      ]);
      
      console.log("Database cleared!");
    }

    // Seed Customers
    console.log("Seeding customers...");
    const customerData = [
      { 
        name: "Alice Johnson", 
        email: "alice@example.com", 
        creditLimit: 5000 
      },
      { 
        name: "Bob Smith", 
        email: "bob@example.com", 
        creditLimit: 2000 
      },
      { 
        name: "Charlie Davis", 
        email: "charlie@example.com", 
        creditLimit: 10000 
      },
      { 
        name: "Diana Prince", 
        email: "diana@example.com", 
        creditLimit: 1500 
      },
      { 
        name: "Ethan Hunt", 
        email: "ethan@example.com", 
        creditLimit: 7500 
      },
      { 
        name: "Fiona Green", 
        email: "fiona@example.com", 
        creditLimit: 3000 
      },
    ];

    const customers = await Promise.all(
      customerData.map(customer =>
        ctx.db.insert("customers", {
          ...customer,
          createdAt: Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000, // Random date within last 90 days
        })
      )
    );

    console.log(`✓ Created ${customers.length} customers`);

    // Seed Products
    console.log("Seeding products...");
    const productData = [
      {
        name: "Wireless Bluetooth Headphones",
        description: "Premium noise-cancelling headphones with 30-hour battery life",
        price: 149.99,
        category: "Electronics",
        sku: "ELEC-HP-001",
      },
      {
        name: "Smart Fitness Watch",
        description: "Track your health and fitness with advanced sensors",
        price: 299.99,
        category: "Electronics",
        sku: "ELEC-FW-002",
      },
      {
        name: "Portable Power Bank 20000mAh",
        description: "High-capacity portable charger with fast charging",
        price: 49.99,
        category: "Electronics",
        sku: "ELEC-PB-003",
      },
      {
        name: "4K Webcam",
        description: "Professional webcam with auto-focus and built-in mic",
        price: 89.99,
        category: "Electronics",
        sku: "ELEC-WC-004",
      },
      {
        name: "Ergonomic Office Chair",
        description: "Adjustable lumbar support with breathable mesh",
        price: 349.99,
        category: "Furniture",
        sku: "FURN-CH-001",
      },
      {
        name: "Standing Desk Converter",
        description: "Easily convert any desk to a standing desk",
        price: 199.99,
        category: "Furniture",
        sku: "FURN-SD-002",
      },
      {
        name: "LED Desk Lamp",
        description: "Adjustable brightness with USB charging port",
        price: 39.99,
        category: "Furniture",
        sku: "FURN-LM-003",
      },
      {
        name: "Yoga Mat Premium",
        description: "Non-slip exercise mat with carrying strap",
        price: 29.99,
        category: "Sports",
        sku: "SPRT-YM-001",
      },
      {
        name: "Resistance Bands Set",
        description: "5-piece set with different resistance levels",
        price: 24.99,
        category: "Sports",
        sku: "SPRT-RB-002",
      },
      {
        name: "Smart Water Bottle",
        description: "Tracks hydration with LED reminders",
        price: 34.99,
        category: "Sports",
        sku: "SPRT-WB-003",
      },
      {
        name: "Mechanical Keyboard RGB",
        description: "Cherry MX switches with customizable lighting",
        price: 129.99,
        category: "Electronics",
        sku: "ELEC-KB-005",
      },
      {
        name: "Wireless Gaming Mouse",
        description: "High-precision sensor with 20000 DPI",
        price: 79.99,
        category: "Electronics",
        sku: "ELEC-MS-006",
      },
      {
        name: "USB-C Hub 7-in-1",
        description: "Expand connectivity with multiple ports",
        price: 44.99,
        category: "Electronics",
        sku: "ELEC-HB-007",
      },
      {
        name: "Noise Cancelling Earbuds",
        description: "True wireless with active noise cancellation",
        price: 179.99,
        category: "Electronics",
        sku: "ELEC-EB-008",
      },
      {
        name: "Adjustable Dumbbell Set",
        description: "Space-saving adjustable weight system",
        price: 399.99,
        category: "Sports",
        sku: "SPRT-DB-004",
      },
    ];

    const products = await Promise.all(
      productData.map(product =>
        ctx.db.insert("products", {
          ...product,
          createdAt: Date.now() - Math.random() * 120 * 24 * 60 * 60 * 1000, // Random date within last 120 days
        })
      )
    );

    console.log(`✓ Created ${products.length} products`);

    // Seed Inventory
    console.log("Seeding inventory...");
    const inventoryData = products.map((productId, index) => {
      // Create different inventory levels to test various scenarios
      const scenarios = [
        { quantity: 150, reserved: 10 },  // High stock
        { quantity: 45, reserved: 5 },    // Medium stock
        { quantity: 8, reserved: 2 },     // Low stock (triggers warnings)
        { quantity: 200, reserved: 20 },  // Very high stock
        { quantity: 15, reserved: 3 },    // Medium-low stock
      ];
      
      const scenario = scenarios[index % scenarios.length];
      
      return {
        productId,
        quantity: scenario.quantity,
        reserved: scenario.reserved,
        warehouseLocation: `Warehouse-${String.fromCharCode(65 + (index % 5))}`, // A-E
        lastRestocked: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000, // Last 30 days
      };
    });

    const inventory = await Promise.all(
      inventoryData.map(inv => ctx.db.insert("inventory", inv))
    );

    console.log(`✓ Created ${inventory.length} inventory records`);

    // Seed some historical orders with different statuses
    console.log("Seeding historical orders...");
    const historicalOrders = [
      {
        customerId: customers[0], // Alice
        items: [
          { productId: products[0], quantity: 1 }, // Headphones
          { productId: products[2], quantity: 2 }, // Power Banks
        ],
        total: 249.97,
        status: "delivered",
        paymentMethod: "credit_card",
        transactionId: "txn_hist_001",
        createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
        confirmedAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
        shippedAt: Date.now() - 13 * 24 * 60 * 60 * 1000,
      },
      {
        customerId: customers[1], // Bob
        items: [
          { productId: products[4], quantity: 1 }, // Office Chair
        ],
        total: 349.99,
        status: "payment_failed",
        paymentMethod: "debit_card",
        createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
      },
      {
        customerId: customers[2], // Charlie
        items: [
          { productId: products[1], quantity: 1 }, // Fitness Watch
          { productId: products[7], quantity: 2 }, // Yoga Mats
        ],
        total: 359.97,
        status: "shipped",
        paymentMethod: "credit_card",
        transactionId: "txn_hist_002",
        createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
        confirmedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
        shippedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
      },
      {
        customerId: customers[1], // Bob (second failed payment)
        items: [
          { productId: products[6], quantity: 1 }, // Desk Lamp
        ],
        total: 39.99,
        status: "payment_failed",
        paymentMethod: "debit_card",
        createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
      },
      {
        customerId: customers[3], // Diana
        items: [
          { productId: products[8], quantity: 3 }, // Resistance Bands
          { productId: products[9], quantity: 1 }, // Water Bottle
        ],
        total: 109.96,
        status: "delivered",
        paymentMethod: "paypal",
        transactionId: "txn_hist_003",
        createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
        confirmedAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
        shippedAt: Date.now() - 18 * 24 * 60 * 60 * 1000,
      },
      {
        customerId: customers[4], // Ethan
        items: [
          { productId: products[10], quantity: 1 }, // Keyboard
          { productId: products[11], quantity: 1 }, // Mouse
          { productId: products[12], quantity: 2 }, // USB-C Hubs
        ],
        total: 299.96,
        status: "confirmed",
        paymentMethod: "credit_card",
        transactionId: "txn_hist_004",
        createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
        confirmedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
      },
    ];

    const orders = await Promise.all(
      historicalOrders.map(order => ctx.db.insert("orders", order))
    );

    console.log(`✓ Created ${orders.length} historical orders`);

    // Create payment records for successful orders
    const successfulOrders = historicalOrders.filter(
      order => order.status !== "payment_failed" && order.transactionId
    );

    const payments = await Promise.all(
      successfulOrders.map((order, index) =>
        ctx.db.insert("payments", {
          orderId: orders[historicalOrders.indexOf(order)],
          amount: order.total,
          paymentMethod: order.paymentMethod,
          transactionId: order.transactionId!,
          status: "completed",
          processedAt: order.confirmedAt!,
        })
      )
    );

    console.log(`✓ Created ${payments.length} payment records`);

    // Summary
    console.log("\n🎉 Database seeded successfully!");
    console.log("=" .repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   • ${customers.length} customers`);
    console.log(`   • ${products.length} products`);
    console.log(`   • ${inventory.length} inventory records`);
    console.log(`   • ${orders.length} historical orders`);
    console.log(`   • ${payments.length} payment records`);
    console.log("=" .repeat(50));
    console.log("\n💡 Test Scenarios:");
    console.log(`   • Alice (${customerData[0].email}): Good customer, $5000 credit`);
    console.log(`   • Bob (${customerData[1].email}): 2 failed payments, $2000 credit`);
    console.log(`   • Charlie (${customerData[2].email}): High credit limit, active buyer`);
    console.log(`   • Products with low inventory: Check inventory table for quantity < 10`);
    console.log("\n🚀 Ready to test createOrder!");

    return {
      customers: customers.length,
      products: products.length,
      inventory: inventory.length,
      orders: orders.length,
      payments: payments.length,
    };
  },
});
