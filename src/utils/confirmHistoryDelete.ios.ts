import type { ConfirmHistoryDeleteOptions } from './confirmHistoryDelete.android';

export function confirmHistoryDelete(_options: ConfirmHistoryDeleteOptions): Promise<boolean> {
  return Promise.resolve(true);
}
