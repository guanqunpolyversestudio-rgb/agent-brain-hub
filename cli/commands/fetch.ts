import { pullCommand, type PullOptions } from "./pull.js";

export interface FetchOptions extends PullOptions {}

export async function fetchCommand(brainId: string, opts: FetchOptions): Promise<void> {
  await pullCommand(brainId, opts);
}
