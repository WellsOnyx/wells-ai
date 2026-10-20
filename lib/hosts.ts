/**
 * Host split for the shared deployment.
 * grainandvault.com, preview URLs, and local dev get the Grain & Vault experience.
 * wellsonyx.io keeps its existing pages.
 */
export function isWellsOnyxHost(host: string | null | undefined): boolean {
  const name = (host || '').toLowerCase().split(':')[0]
  return name === 'wellsonyx.io' || name === 'www.wellsonyx.io' || name.endsWith('.wellsonyx.io')
}
