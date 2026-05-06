import * as crypto from "crypto";
import { BlockList, isIPv4, isIPv6 } from "net";

const BEARER_PREFIX = "Rcon ";

export function verifyBearer(authorizationHeader: string | undefined, expectedKey: string): boolean {
  if (typeof authorizationHeader !== "string") {
    return false;
  }
  if (!authorizationHeader.startsWith(BEARER_PREFIX)) {
    return false;
  }
  const provided = authorizationHeader.slice(BEARER_PREFIX.length);
  return constantTimeEquals(provided, expectedKey);
}

export function verifyTokenString(token: unknown, expectedKey: string): boolean {
  if (typeof token !== "string") {
    return false;
  }
  return constantTimeEquals(token, expectedKey);
}

export function buildBlockList(allowlist: string[]): BlockList {
  const list = new BlockList();
  for (const entry of allowlist) {
    addEntryToBlockList(list, entry);
  }
  return list;
}

function addEntryToBlockList(list: BlockList, entry: string): void {
  const trimmed = entry.trim();
  if (trimmed.length === 0) {
    return;
  }
  const slashIndex = trimmed.indexOf("/");
  if (slashIndex >= 0) {
    const address = trimmed.slice(0, slashIndex);
    const prefix = parseInt(trimmed.slice(slashIndex + 1), 10);
    const family = detectFamily(address);
    if (!Number.isFinite(prefix) || !family) {
      throw new Error(`Invalid CIDR entry in rcon ipAllowlist: ${entry}`);
    }
    list.addSubnet(address, prefix, family);
    return;
  }
  const family = detectFamily(trimmed);
  if (!family) {
    throw new Error(`Invalid IP entry in rcon ipAllowlist: ${entry}`);
  }
  list.addAddress(trimmed, family);
}

function detectFamily(address: string): "ipv4" | "ipv6" | null {
  if (isIPv4(address)) {
    return "ipv4";
  }
  if (isIPv6(address)) {
    return "ipv6";
  }
  return null;
}

export function ipAllowed(list: BlockList, ip: string | undefined): boolean {
  if (typeof ip !== "string" || ip.length === 0) {
    return false;
  }
  const family = detectFamily(normalizeIp(ip));
  if (!family) {
    return false;
  }
  return list.check(normalizeIp(ip), family);
}

export function normalizeIp(ip: string): string {
  if (ip.startsWith("::ffff:")) {
    return ip.slice("::ffff:".length);
  }
  return ip;
}

function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}
