import type { Namespace } from "socket.io";

import { rconSocketDroppedCounter, rconSocketEventsCounter } from "./RconMetrics";

interface BusItem {
  topic: string;
  payload: unknown;
}

export class RconEventBus {
  private readonly ring: BusItem[] = [];

  constructor(private readonly capacity: number = 4096) {}

  push(topic: string, payload: unknown): void {
    if (this.ring.length >= this.capacity) {
      this.ring.shift();
      rconSocketDroppedCounter.inc({ reason: "bus_overflow" });
    }
    this.ring.push({ topic, payload });
  }

  size(): number {
    return this.ring.length;
  }

  flush(namespace: Namespace | null): number {
    if (this.ring.length === 0) {
      return 0;
    }
    if (!namespace) {
      this.ring.length = 0;
      return 0;
    }
    let emitted = 0;
    for (const item of this.ring) {
      try {
        namespace.to(item.topic).emit(item.topic, item.payload);
        rconSocketEventsCounter.inc({ topic: item.topic });
        emitted++;
      } catch {
        rconSocketDroppedCounter.inc({ reason: "emit_error" });
      }
    }
    this.ring.length = 0;
    return emitted;
  }
}
