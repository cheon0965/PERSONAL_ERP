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
import { parseKbKookminBankPdfStatement } from '../../kb-kookmin-bank-pdf-statement.parser';
import { parseWooriBankHtmlStatement } from '../../woori-bank-html-statement.parser';
import { parseWooriCardHtmlStatement } from '../../woori-card-html-statement.parser';
import { ImportBatchWritePort } from '../ports/import-batch-write.port';

const FILE_UPLOAD_SOURCE_KINDS: ImportSourceKind[] = [
  'IM_BANK_PDF',
  'WOORI_BANK_HTML',
  'WOORI_CARD_HTML',
  'KB_KOOKMIN_BANK_PDF'
];

const ALLOWED_CONTENT_TYPES: Record<ImportSourceKind, string[]> = {
  IM_BANK_PDF: ['application/pdf', 'application/octet-stream'],
  KB_KOOKMIN_BANK_PDF: ['application/pdf', 'application/octet-stream'],
  WOORI_BANK_HTML: [
    'text/html',
    'application/octet-stream',
    'application/x-html'
  ],
  WOORI_CARD_HTML: [
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
        '파일 첨부 업로드는 현재 IM뱅크 PDF, KB국민은행 PDF, 우리은행 HTML, 우리카드 HTML만 지원합니다.'
      );
    }

    const allowedTypes = ALLOWED_CONTENT_TYPES[input.sourceKind] ?? [];
    if (
      input.contentType &&
      allowedTypes.length > 0 &&
      !allowedTypes.includes(input.contentType)
    ) {
      throw new BadRequestException(
        input.sourceKind === 'IM_BANK_PDF' ||
          input.sourceKind === 'KB_KOOKMIN_BANK_PDF'
          ? 'PDF 파일만 업로드할 수 있습니다.'
          : 'HTML 파일만 업로드할 수 있습니다.'
      );
    }

    const fundingAccountId = await resolveImportBatchFundingAccountId({
      client: this.prisma,
      workspace,
      sourceKind: input.sourceKind,
      fundingAccountId: input.fundingAccountId,
      requiredMessage: '파일 업로드에는 연결 계좌/카드를 선택해 주세요.'
    });

    const fingerprintScope = {
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId
    };

    // 파일 원본과 복호화 비밀번호는 저장하지 않는다.
    // 파서는 행 원본과 중복 판단용 fingerprint만 만들어 배치 저장 경계로 넘긴다.
    const parsedBatch =
      input.sourceKind === 'IM_BANK_PDF'
        ? parseImBankPdfStatement({
            buffer: input.buffer,
            fileName: input.fileName,
            fingerprintScope
          })
        : input.sourceKind === 'KB_KOOKMIN_BANK_PDF'
          ? parseKbKookminBankPdfStatement({
              buffer: input.buffer,
              fileName: input.fileName,
              password: input.password ?? '',
              fingerprintScope
            })
          : input.sourceKind === 'WOORI_BANK_HTML'
            ? parseWooriBankHtmlStatement({
                buffer: input.buffer,
                fileName: input.fileName,
                password: input.password ?? '',
                fingerprintScope
              })
            : parseWooriCardHtmlStatement({
                buffer: input.buffer,
                fileName: input.fileName,
                password: input.password ?? '',
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
