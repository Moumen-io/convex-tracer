// // In your convex functions file
// import { ConvexError, v } from "convex/values";
// import { Tracer } from "../../src/client";
// import { api, components, internal } from "./_generated/api";
// import { DataModel } from "./_generated/dataModel";

// // Instantiate tracer with component and config
// export const {
//   tracedQuery,
//   tracedMutation,
//   tracedAction,
//   internalTracedQuery,
//   tracer,
// } = new Tracer<DataModel>(components.tracer, {
//   preserveErrors: true,
// });

// export const getUsers = tracedQuery({
//   name: "getUsers",
//   onSuccess: async (ctx, args, result) => {
//     ctx.tracer.info("Succeeded fetching users");
//   },
//   handler: async (ctx, {}) => {
//     ctx.tracer.info("fetching users");
//     const users = await ctx.db.query("users").collect();

//     ctx.tracer.info("users fetched", { userIds: users.map((u) => u._id) });
//     return users;
//   },
// });

// export const getUser = tracedQuery({
//   args: { userId: v.id("users") },
//   onSuccess: async (ctx, args, result) => {
//     ctx.tracer.info("Succeeded fetching user");
//     if (result.postCount > 100) ctx.tracer.preserve();
//     else if (result.postCount > 20) ctx.tracer.sample();
//     else ctx.tracer.discard();
//   },
//   handler: async (ctx, { userId }) => {
//     const user = await ctx.db.get(userId);
//     if (!user) throw new Error("User not found");
//     return user;
//   },
// });

// export const getUserByEmail = internalTracedQuery({
//   name: "getUserByEmail",
//   args: { email: v.string() },
//   logArgs: ["email"],
//   logReturn: true,
//   onSuccess: async (ctx, { email }, r) => {
//     ctx.tracer.info("Succeeded user fetch", { email });
//   },
//   handler: async (ctx, { email }) => {
//     ctx.tracer.info("fetching user", { email });

//     const user = await ctx.db
//       .query("users")
//       .withIndex("by_email", (q) => q.eq("email", email))
//       .first();

//     if (!user) {
//       throw new ConvexError({ message: "User not found", email });
//     }

//     ctx.tracer.info("user fetched", { email });

//     return user;
//   },
// });

// export const addUserPosts = tracedMutation({
//   args: { userId: v.id("users"), count: v.number() },
//   handler: async (ctx, { userId, count }) => {
//     console.log("adding posts", userId);

//     const array = Array.from({ length: count }, (_, i) => i);
//     await Promise.all(
//       array.map((i) =>
//         ctx.db.insert("posts", { userId, title: `Post ${i + 1}` }),
//       ),
//     );
//   },
// });

// export const addUser = tracedMutation({
//   name: "addUser",
//   args: { user: v.object({ name: v.string(), email: v.string() }) },
//   onStart: async (ctx, args) => {
//     // do something before the function starts
//   },
//   onSuccess: async (ctx, args, result) => {
//     // do something with the result
//     ctx.tracer.preserve();
//   },
//   onError: async (ctx, args, error) => {
//     // do something to handle the error
//   },
//   handler: async (ctx, args) => {
//     const { success, data, error } = await ctx.runTracedQuery(
//       internal.example.getUserByEmail,
//       {
//         email: args.user.email,
//       },
//     );

//     if (success && data) {
//       ctx.tracer.error("User already exists", args);

//       throw new ConvexError("Action failed");
//     }

//     const fetchedUser = await ctx.runTracedQuery(api.example.getUsers);

//     ctx.tracer.info("Adding user", { ...args.user });

//     const userId = await ctx.db.insert("users", { ...args.user });
//     ctx.tracer.info("User added", { userId });

//     ctx.tracer.withSpan("createPostsInline", async (span) => {
//       // do something in a child span
//       // span.setMetadata({ foo: "bar" });
//       // await ctx.db. <- do something in a child span
//     });

//     await ctx.runTracedMutation(api.example.addUserPosts, {
//       userId,
//       count: 10,
//     });

//     return userId;
//   },
// });
