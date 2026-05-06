import * as fs from "fs";
import * as path from "path";

import { AuditEntry } from "./RconTypes";

export class RconAudit {
  private writing = false;
  private readonly queue: { file: string; line: string }[] = [];

  constructor(
    private readonly dir: string,
    private readonly maxQueueSize: number = 10_000,
    private readonly logError: (msg: string) => void = () => {},
  ) {}

  enqueue(entry: AuditEntry): void {
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
    }
    const file = path.join(this.dir, `${entry.ts.slice(0, 10)}.jsonl`);
    const line = JSON.stringify(entry) + "\n";
    this.queue.push({ file, line });
    this.kick();
  }

  async flush(): Promise<void> {
    while (this.queue.length > 0) {
      await this.drainOne();
    }
  }

  private kick(): void {
    if (this.writing) {
      return;
    }
    void this.drainLoop();
  }

  private async drainLoop(): Promise<void> {
    if (this.writing) {
      return;
    }
    this.writing = true;
    try {
      while (this.queue.length > 0) {
        await this.drainOne();
      }
    } finally {
      this.writing = false;
    }
  }

  private async drainOne(): Promise<void> {
    const item = this.queue.shift();
    if (!item) {
      return;
    }
    try {
      await fs.promises.mkdir(this.dir, { recursive: true });
      await fs.promises.appendFile(item.file, item.line, { encoding: "utf8" });
    } catch (err) {
      this.logError(`Audit write failed: ${(err as Error).message}`);
    }
  }
}
