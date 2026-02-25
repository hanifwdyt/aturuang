import "dotenv/config";
import { serve } from "@hono/node-server";
import { createBot } from "./bot.js";
import { createWeb } from "./web.js";
import { createApi } from "./api/index.js";

const WEB_PORT = parseInt(process.env.WEB_PORT || "3000");

async function main() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN is required");
    process.exit(1);
  }

  // Start web server
  const web = createWeb();
  const api = createApi();
  web.route("/", api);
  serve({ fetch: web.fetch, port: WEB_PORT }, (info) => {
    console.log(`🌐 Web server running at http://localhost:${info.port}`);
    console.log(`📖 API docs at http://localhost:${info.port}/reference`);
  });

  // Start bot
  const bot = createBot(botToken);

  // Register commands for Telegram menu
  await bot.api.setMyCommands([
    { command: "start", description: "Mulai / restart bot" },
    { command: "today", description: "Pengeluaran hari ini" },
    { command: "week", description: "Ringkasan minggu ini" },
    { command: "month", description: "Ringkasan bulan ini" },
    { command: "recent", description: "10 transaksi terakhir" },
    { command: "undo", description: "Hapus transaksi terakhir" },
    { command: "setpassword", description: "Set password dashboard" },
    { command: "customid", description: "Set custom login ID" },
  ]);

  // Set menu button to open dashboard
  const webUrl = process.env.WEB_URL || "https://aturuang.hanif.app";
  await bot.api.setChatMenuButton({
    menu_button: { type: "web_app", text: "Dashboard", web_app: { url: webUrl } },
  });

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  console.log("🤖 Starting AturUang...");
  await bot.start({
    onStart: (botInfo) => {
      console.log(`✅ Bot @${botInfo.username} is running!`);
    },
  });
}

main().catch(console.error);
