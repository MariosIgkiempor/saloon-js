// Port of ../saloon/src/Http/PendingRequest/BootPlugins.php
//
// The first tap: boot the connector's plugins, then the request's. Plugins run
// before properties merge / authentication, so they can seed headers/config or
// register middleware that the rest of the lifecycle then builds on.

import type { PendingRequest } from '@/http/pendingRequest';

export function bootPlugins(pending: PendingRequest): void {
  for (const plugin of pending.getConnector().plugins) plugin.boot(pending);
  for (const plugin of pending.getRequest().plugins) plugin.boot(pending);
}
