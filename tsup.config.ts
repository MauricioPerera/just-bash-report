import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node22",
  // Optional peer dependencies — never bundle them. Loaded lazily at runtime
  // via createRequire when createReportPlugin() is called.
  external: ["just-bash", "just-bash-data"],
});
