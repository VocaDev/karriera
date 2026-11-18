// UUID v4 për id-të që i krijon app-i vetë (p.sh. shtimi i një pune: e njëjta id te çdo provë, kështu një provë e dytë
// pas "s'mbaroi në kohë" s'krijon kopje). Nuk përdoret për asgjë sekrete: vetëm unike.
export function uuidIRi(): string {
  const g = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (g?.randomUUID) return g.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
