// Port of ../saloon/src/Config.php (default sender slot)
//
// Global config as functions, with no module-init side effects. Slice 1 needs
// only the default sender; default timeouts (Slice 4) and the global mock slot
// (Slice 6) are added by those slices.

import type { Sender } from '@/contracts/Sender';
import { fetchSender } from '@/http/senders/fetchSender';

export function getDefaultSender(): Sender {
  return fetchSender;
}
