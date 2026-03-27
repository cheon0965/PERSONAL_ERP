export abstract class ReferenceOwnershipPort {
  abstract accountExistsForUser(
    userId: string,
    accountId: string
  ): Promise<boolean>;

  abstract categoryExistsForUser(
    userId: string,
    categoryId?: string
  ): Promise<boolean>;
}
