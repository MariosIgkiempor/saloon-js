// Port of ../saloon/src/Config.php (default sender slot + default timeouts)
//
// Global config as functions, with no module-init side effects. Slice 1 needs
// only the default sender; the default timeouts the fetch sender falls back to
// (Slice 4) are here too; the global mock slot (Slice 6) is added by that slice.

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
