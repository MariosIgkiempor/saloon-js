// Port of ../saloon/src/Config.php (default sender slot + default timeouts)
//
// Global config as functions, with no module-init side effects: the default
// sender and the default timeouts the fetch sender falls back to.

import type { Sender } from '@/contracts/Sender';
import { fetchSender } from '@/http/senders/fetchSender';

export function getDefaultSender(): Sender {
  return fetchSender;
}

// Defaults (ms) the fetch sender applies when no `hasTimeout`/config override is
// present. Mirror SaloonPHP's Config defaults (10s connect / 30s total), in ms.
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export function getDefaultConnectTimeout(): number {
  return DEFAULT_CONNECT_TIMEOUT_MS;
}

export function getDefaultRequestTimeout(): number {
  return DEFAULT_REQUEST_TIMEOUT_MS;
}
