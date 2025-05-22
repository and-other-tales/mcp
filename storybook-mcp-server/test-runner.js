import { spawn } from "child_process";
import { createInterface } from "readline";

// Start the MCP server process
const server = spawn("node", ["build/index.js"], {
  stdio: ["pipe", "pipe", "inherit"],
});

// Create interface for reading test inputs
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Pipe test inputs to server
rl.on("line", (input) => {
  server.stdin.write(input + "\n");
});

// Handle server output
server.stdout.on("data", (data) => {
  console.log(data.toString());
});

// Handle process termination
process.on("SIGINT", () => {
  server.kill();
  process.exit(0);
});
