export abstract class ReferenceOwnershipPort {
  abstract fundingAccountExistsForUser(
    userId: string,
    fundingAccountId: string
  ): Promise<boolean>;

  abstract categoryExistsForUser(
    userId: string,
    categoryId?: string
  ): Promise<boolean>;
}
