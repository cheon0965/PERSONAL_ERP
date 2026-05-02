import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('import upload dialog exposes Woori bank HTML as a file upload option', () => {
  const sharedSource = readFileSync(
    path.resolve(process.cwd(), 'src/features/imports/imports.shared.ts'),
    'utf8'
  );
  const dialogSource = readFileSync(
    path.resolve(
      process.cwd(),
      'src/features/imports/import-upload-dialog.tsx'
    ),
    'utf8'
  );
  const pageHookSource = readFileSync(
    path.resolve(process.cwd(), 'src/features/imports/use-imports-page.ts'),
    'utf8'
  );

  assert.match(sharedSource, /selectableSourceKindOptions/);
  assert.match(sharedSource, /value: 'WOORI_BANK_HTML'/);
  assert.match(sharedSource, /value: 'KB_KOOKMIN_BANK_PDF'/);
  assert.match(sharedSource, /fileUploadSourceKinds[\s\S]*'WOORI_BANK_HTML'/);
  assert.match(
    sharedSource,
    /fileUploadSourceKinds[\s\S]*'KB_KOOKMIN_BANK_PDF'/
  );
  assert.match(dialogSource, /selectableSourceKindOptions\.map/);
  assert.match(dialogSource, /isWooriBankHtml/);
  assert.match(dialogSource, /isKbKookminBankPdf/);
  assert.match(sharedSource, /readImportSourceFundingAccountType/);
  assert.match(sharedSource, /case 'WOORI_CARD_HTML':[\s\S]*return 'CARD'/);
  assert.match(
    sharedSource,
    /case 'IM_BANK_PDF':[\s\S]*case 'WOORI_BANK_HTML':[\s\S]*case 'KB_KOOKMIN_BANK_PDF':[\s\S]*return 'BANK'/
  );
  assert.match(pageHookSource, /filterFundingAccountsForImportSource/);
  assert.match(dialogSource, /label={fundingAccountSelectLabel}/);
});
