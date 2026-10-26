// Probes loopback ports and hands each stack its own block.
// Blocks of ten keep a stack's ports together.

import net from "node:net";

/** Well-known dev ports a block never uses. */
const RESERVED = new Set([5000, 5173, 5432, 5433, 6379, 6380]);

/** First and last block starts. */
const BLOCKS = { first: 4100, last: 6090, size: 10 };



/**
 * Checks whether one loopback port can be bound.
 *
 * Purpose: Avoid ports that already have a listener.
 *
 * @param port Host port to test.
 * @returns Promise resolving true when the port is free.
 */
export function portFree(port) {
  // Release the probe listener before answering.
  return new Promise((resolve) => {
    // A bind error means something already listens.
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}



/**
 * Waits until a loopback port accepts connections.
 *
 * Purpose: Know when a starting stack or preview is up.
 *
 * @param port Loopback port to watch.
 * @param timeoutMs Maximum wait.
 * @returns Promise resolving when the port opens.
 */
export async function waitForPort(port, timeoutMs) {
  // Poll a few times a second until the deadline.
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await portFree(port))) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for port ${port}.`);
}



/**
 * Picks the next free block for a stack's named ports.
 *
 * Purpose: Give each stack stable ports of its own.
 *
 * @param names Port names from the stacks settings.
 * @param taken Ports other stacks already hold.
 * @param isFree Probe used to skip live listeners.
 * @returns Promise resolving with ports keyed by name.
 */
export async function choosePorts(names, taken, isFree = portFree) {
  // Name i gets the block start plus i.
  if (names.length > BLOCKS.size) throw new Error(`A stack may name at most ${BLOCKS.size} ports.`);
  const used = new Set([...RESERVED, ...taken]);
  for (let base = BLOCKS.first; base <= BLOCKS.last; base += BLOCKS.size) {
    const ports = Object.fromEntries(names.map((name, index) => [name, base + index]));
    if (Object.values(ports).some((port) => used.has(port))) continue;
    const free = await Promise.all(Object.values(ports).map((port) => isFree(port)));
    if (free.every(Boolean)) return ports;
  }
  throw new Error("No free stack port block.");
}
