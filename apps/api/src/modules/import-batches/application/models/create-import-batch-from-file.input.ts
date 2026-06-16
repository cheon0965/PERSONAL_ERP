import type { ImportSourceKind } from '@personal-erp/contracts';

export type CreateImportBatchFromFileInput = {
  sourceKind: ImportSourceKind;
  fileName: string;
  fundingAccountId: string;
  password?: string;
  contentType: string | null;
  buffer: Uint8Array;
};
