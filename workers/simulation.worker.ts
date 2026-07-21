/// <reference lib="webworker" />

import { SimulationWorkerAdapter } from "@/lib/simulation/worker-runtime";
import type { WorkerEvent, WorkerRequest } from "@/lib/simulation/types";

const scope = self as unknown as DedicatedWorkerGlobalScope;
const adapter = new SimulationWorkerAdapter((event: WorkerEvent) => scope.postMessage(event));

scope.onmessage = (message: MessageEvent<WorkerRequest>) => {
  adapter.handle(message.data);
};

setInterval(() => {
  adapter.tick(0.05);
}, 50);

export {};
