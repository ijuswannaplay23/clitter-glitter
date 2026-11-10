/** Client-generated so the offline host can create rows without a server. */
export function newId(): string {
  return crypto.randomUUID();
}
