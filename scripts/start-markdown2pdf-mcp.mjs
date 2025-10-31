#!/usr/bin/env node
import { MarkdownPdfServer } from "markdown2pdf-mcp/build/index.js";

async function main() {
  const server = new MarkdownPdfServer();
  const keepAlive = setInterval(() => {
    // keep process alive for MCP stdio transport
  }, 60_000);

  if (!process.stdin.destroyed) {
    process.stdin.resume();
  }

  try {
    await server.run();
  } catch (error) {
    console.error("[markdown2pdf-wrapper] Failed to start Markdown2PDF MCP server.", error);
    process.exitCode = 1;
  } finally {
    clearInterval(keepAlive);
  }
}

main().catch((error) => {
  console.error("[markdown2pdf-wrapper] Unexpected error while starting Markdown2PDF MCP server.", error);
  process.exitCode = 1;
});
