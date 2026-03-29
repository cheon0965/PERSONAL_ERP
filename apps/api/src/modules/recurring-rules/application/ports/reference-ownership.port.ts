export abstract class ReferenceOwnershipPort {
  abstract fundingAccountExistsInWorkspace(
    tenantId: string,
    ledgerId: string,
    fundingAccountId: string
  ): Promise<boolean>;

  abstract categoryExistsInWorkspace(
    tenantId: string,
    ledgerId: string,
    categoryId?: string
  ): Promise<boolean>;
}
