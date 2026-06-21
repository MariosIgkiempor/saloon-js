// Port of ../saloon/src/Contracts/Plugin.php
//
// In SaloonPHP a plugin was a trait whose `boot{Name}()` hook ran during the
// pending-request lifecycle. Here a plugin is a factory returning `{ boot }` (see
// `src/plugins/*`). Plugins boot first (the `bootPlugins` tap), so they can add
// headers/config or register middleware before properties merge and auth runs.

import type { PendingRequest } from '@/http/pendingRequest';

export interface Plugin {
  /** Mutate the pending request as it boots (add headers/config/middleware). */
  boot(pending: PendingRequest): void;
}
