#!/usr/bin/env node
/**
 * Minimal MCP stdio driver for the local Jev server (bounded executor usage).
 *
 * Usage:
 *   node jev-driver.mjs list
 *   node jev-driver.mjs call <tool> <input-json-file>
 *
 * The launcher owns the credential; this driver never reads it. stdout carries
 * the MCP protocol, so the driver prints only tool results on stdout and all
 * diagnostics on stderr.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const LAUNCHER = "C:\\Users\\csn19\\.jev\\run-jev-mcp.ps1";

function startServer() {
  const child = spawn(
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      LAUNCHER,
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  const pending = new Map();
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let index = buffer.indexOf("\n");
    while (index !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line) {
        try {
          const message = JSON.parse(line);
          if (message.id !== undefined && pending.has(message.id)) {
            pending.get(message.id)(message);
            pending.delete(message.id);
          } else if (message.method === "notifications/message") {
            process.stderr.write(`[jev-notify] ${JSON.stringify(message.params).slice(0, 300)}\n`);
          }
        } catch {
          process.stderr.write(`[jev-nonjson] ${line.slice(0, 200)}\n`);
        }
      }
      index = buffer.indexOf("\n");
    }
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[jev-stderr] ${chunk.toString("utf8").slice(0, 400)}`);
  });
  let nextId = 1;
  function request(method, params, timeoutMs = 180000) {
    const id = nextId++;
    const payload = { jsonrpc: "2.0", id, method };
    if (params !== undefined) payload.params = params;
    child.stdin.write(`${JSON.stringify(payload)}\n`);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`timeout waiting for ${method} (id=${id})`));
      }, timeoutMs);
      pending.set(id, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
    });
  }
  function notify(method, params) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }
  return { child, request, notify };
}

const server = startServer();

try {
  const init = await server.request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "polyhunter-executor", version: "1.0.0" },
  });
  if (init.error) throw new Error(`initialize failed: ${JSON.stringify(init.error)}`);
  server.notify("notifications/initialized", {});

  const mode = process.argv[2];

  if (mode === "list") {
    const tools = await server.request("tools/list", {});
    if (tools.error) throw new Error(JSON.stringify(tools.error));
    for (const tool of tools.result.tools) {
      const required = (tool.inputSchema?.required ?? []).join(",");
      process.stdout.write(`${tool.name}\t(required: ${required})\n`);
    }
  } else if (mode === "call") {
    const toolName = process.argv[3];
    const inputFile = process.argv[4];
    const args = JSON.parse(readFileSync(inputFile, "utf8"));
    const result = await server.request("tools/call", {
      name: toolName,
      arguments: args,
    });
    if (result.error) throw new Error(JSON.stringify(result.error));
    const content = result.result?.content ?? [];
    for (const part of content) {
      if (part.type === "text") process.stdout.write(`${part.text}\n`);
    }
    if (result.result?.structuredContent !== undefined) {
      process.stdout.write(`${JSON.stringify(result.result.structuredContent)}\n`);
    }
    if (result.result?.isError) {
      process.stderr.write("tool returned isError=true\n");
      process.exitCode = 2;
    }
  } else {
    throw new Error("usage: jev-driver.mjs list | call <tool> <input.json>");
  }
} catch (error) {
  process.stderr.write(`jev-driver error: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  server.child.kill();
}
