#!/usr/bin/env node
// Preview server:  node tools/serve.mjs [--port 5173]
import { startServer } from "./lib/server.mjs";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("Preview server:  node tools/serve.mjs [--port 5173]");
  process.exit(0);
}
const portArg = args.indexOf("--port");
const port = portArg >= 0 ? Number(args[portArg + 1]) : Number(process.env.PORT || 5173);

const { url } = await startServer({ port, quiet: false });
console.log(`The Pelican Test preview: ${url}/`);
