import { createHash } from 'node:crypto';
// eslint-disable-next-line no-restricted-imports
import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  ImportBatchItem,
  ImportSourceKind
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../../../common/auth/required-workspace.util';
import { assertWorkspaceActionAllowed } from '../../../../common/auth/workspace-action.policy';
// eslint-disable-next-line no-restricted-imports
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { resolveImportBatchFundingAccountId } from '../../import-batch-funding-account.policy';
import { parseImBankPdfStatement } from '../../im-bank-pdf-statement.parser';
import { mapImportBatchRecordToItem } from '../../import-batch.mapper';
import { parseWooriBankHtmlStatement } from '../../woori-bank-html-statement.parser';
import { ImportBatchWritePort } from '../ports/import-batch-write.port';

const FILE_UPLOAD_SOURCE_KINDS: ImportSourceKind[] = [
  'IM_BANK_PDF',
  'WOORI_BANK_HTML'
];

const ALLOWED_CONTENT_TYPES: Record<ImportSourceKind, string[]> = {
  IM_BANK_PDF: ['application/pdf', 'application/octet-stream'],
  WOORI_BANK_HTML: [
    'text/html',
    'application/octet-stream',
    'application/x-html'
  ],
  CARD_EXCEL: [],
  BANK_CSV: [],
  MANUAL_UPLOAD: []
};

export type CreateImportBatchFromFileInput = {
  sourceKind: ImportSourceKind;
  fileName: string;
  fundingAccountId: string;
  password?: string;
  contentType: string | null;
  buffer: Buffer;
};

@Injectable()
export class CreateImportBatchFromFileUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly importBatchWritePort: ImportBatchWritePort
  ) {}

  async execute(
    user: AuthenticatedUser,
    input: CreateImportBatchFromFileInput
  ): Promise<ImportBatchItem> {
    const workspace = requireCurrentWorkspace(user);
    assertWorkspaceActionAllowed(
      workspace.membershipRole,
      'import_batch.upload'
    );

    if (!FILE_UPLOAD_SOURCE_KINDS.includes(input.sourceKind)) {
      throw new BadRequestException(
        '파일 첨부 업로드는 현재 IM뱅크 PDF 또는 우리은행 HTML만 지원합니다.'
      );
    }

    const allowedTypes = ALLOWED_CONTENT_TYPES[input.sourceKind] ?? [];
    if (
      input.contentType &&
      allowedTypes.length > 0 &&
      !allowedTypes.includes(input.contentType)
    ) {
      throw new BadRequestException(
        `${input.sourceKind === 'WOORI_BANK_HTML' ? 'HTML' : 'PDF'} 파일만 업로드할 수 있습니다.`
      );
    }

    const fundingAccountId = await resolveImportBatchFundingAccountId({
      client: this.prisma,
      workspace,
      fundingAccountId: input.fundingAccountId,
      requiredMessage:
        input.sourceKind === 'WOORI_BANK_HTML'
          ? '우리은행 HTML 업로드에는 연결 계좌/카드를 선택해 주세요.'
          : 'IM뱅크 PDF 업로드에는 연결 계좌/카드를 선택해 주세요.'
    });

    const fingerprintScope = {
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId
    };

    const parsedBatch =
      input.sourceKind === 'WOORI_BANK_HTML'
        ? parseWooriBankHtmlStatement({
            buffer: input.buffer,
            fileName: input.fileName,
            password: input.password ?? '',
            fingerprintScope
          })
        : parseImBankPdfStatement({
            buffer: input.buffer,
            fileName: input.fileName,
            fingerprintScope
          });

    const fileHash = createHash('sha256').update(input.buffer).digest('hex');

    const created = await this.prisma.$transaction(
      (tx) =>
        this.importBatchWritePort.createBatchWithRows(tx, {
          workspace: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            membershipId: workspace.membershipId
          },
          sourceKind: input.sourceKind,
          fileName: input.fileName,
          fileHash,
          fundingAccountId,
          rowCount: parsedBatch.rowCount,
          parseStatus: parsedBatch.parseStatus,
          rows: parsedBatch.rows
        }),
      { timeout: 15_000 }
    );

    return mapImportBatchRecordToItem(created);
  }
}
