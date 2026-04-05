import { loadConfig } from "./config.js";
import { Bridge } from "./bridge.js";

async function main() {
  console.log("[Bridge] Starting Feishu-ACP Bridge...");

  const config = loadConfig();
  const bridge = new Bridge(config);

  const shutdown = async () => {
    console.log("\n[Bridge] Shutting down...");
    await bridge.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await bridge.start();
}

main().catch((err) => {
  console.error("[Bridge] Fatal error:", err);
  process.exit(1);
});
