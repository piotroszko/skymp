import * as fs from "fs";
import * as path from "path";

import { AuditEntry } from "./RconTypes";

const DEFAULT_MAX_BYTES_PER_FILE = 16 * 1024 * 1024;
const LEGACY_FILE_MARKER = -1;

interface QueueItem {
  ymd: string;
  line: string;
  bytes: number;
}

export class RconAudit {
  private writing = false;
  private readonly queue: QueueItem[] = [];
  private currentYmd: string | null = null;
  private currentIdx: number = 0;
  private currentBytes: number = 0;
  private currentFileResolved = false;

  constructor(
    private readonly dir: string,
    private readonly maxQueueSize: number = 10_000,
    private readonly logError: (msg: string) => void = () => {},
    private readonly maxBytesPerFile: number = DEFAULT_MAX_BYTES_PER_FILE,
  ) {}

  enqueue(entry: AuditEntry): void {
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
    }
    const ymd = entry.ts.slice(0, 10);
    const line = JSON.stringify(entry) + "\n";
    this.queue.push({ ymd, line, bytes: Buffer.byteLength(line, "utf8") });
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
      await this.ensureCurrentFile(item.ymd);
      if (
        this.currentBytes > 0 &&
        this.currentBytes + item.bytes > this.maxBytesPerFile &&
        this.currentIdx !== LEGACY_FILE_MARKER
      ) {
        this.currentIdx += 1;
        this.currentBytes = 0;
      } else if (
        this.currentBytes > 0 &&
        this.currentBytes + item.bytes > this.maxBytesPerFile &&
        this.currentIdx === LEGACY_FILE_MARKER
      ) {
        // legacy YYYY-MM-DD.jsonl file is full → roll forward to .1
        this.currentIdx = 1;
        this.currentBytes = 0;
      }
      const file = this.currentFilePath(item.ymd);
      await fs.promises.appendFile(file, item.line, { encoding: "utf8" });
      this.currentBytes += item.bytes;
    } catch (err) {
      this.logError(`Audit write failed: ${(err as Error).message}`);
    }
  }

  private async ensureCurrentFile(ymd: string): Promise<void> {
    if (this.currentFileResolved && this.currentYmd === ymd) {
      return;
    }
    this.currentYmd = ymd;
    this.currentIdx = 0;
    this.currentBytes = 0;
    this.currentFileResolved = true;

    const legacyPath = path.join(this.dir, `${ymd}.jsonl`);
    try {
      const stat = await fs.promises.stat(legacyPath);
      this.currentIdx = LEGACY_FILE_MARKER;
      this.currentBytes = stat.size;
      return;
    } catch {
      // legacy file does not exist → fall through to indexed scan
    }

    let highest = 0;
    let highestSize = 0;
    let found = false;
    try {
      const entries = await fs.promises.readdir(this.dir);
      const re = new RegExp(`^${escapeRegExp(ymd)}\\.(\\d+)\\.jsonl$`);
      for (const name of entries) {
        const m = re.exec(name);
        if (!m) continue;
        const n = parseInt(m[1] as string, 10);
        if (!Number.isFinite(n)) continue;
        if (!found || n > highest) {
          highest = n;
          found = true;
        }
      }
      if (found) {
        const stat = await fs.promises.stat(path.join(this.dir, `${ymd}.${highest}.jsonl`));
        highestSize = stat.size;
      }
    } catch {
      // dir may not exist yet; we mkdir before write
    }

    this.currentIdx = found ? highest : 0;
    this.currentBytes = found ? highestSize : 0;
  }

  private currentFilePath(ymd: string): string {
    if (this.currentIdx === LEGACY_FILE_MARKER) {
      return path.join(this.dir, `${ymd}.jsonl`);
    }
    return path.join(this.dir, `${ymd}.${this.currentIdx}.jsonl`);
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
