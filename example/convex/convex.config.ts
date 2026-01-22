import tracer from "convex-tracer/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(tracer);

export default app;
