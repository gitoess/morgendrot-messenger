/** Paket-ID-Expertenmenü im Posteingang (P5b). */
export type PackageExpertPort = {
  readonly inboxPackageFilter: string
  readonly packageIdSuggestions: string[]
  readonly packageIdBusy: boolean
  readonly refreshPackageIdSuggestions: (extraUnionIds?: string[]) => void | Promise<void>
  readonly applyTemporaryInboxPackage: (packageId: string) => void | Promise<void>
  readonly clearTemporaryInboxPackage: () => void | Promise<void>
  readonly applyPackageIdBackend: (packageId: string) => void | Promise<void>
}

export function asPackageExpert(expert: PackageExpertPort): PackageExpertPort {
  return expert
}
