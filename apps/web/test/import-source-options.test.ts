import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('import upload dialog does not offer Woori HTML as a selectable source', () => {
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

  assert.match(sharedSource, /selectableSourceKindOptions/);
  assert.match(sharedSource, /option\.value !== 'WOORI_BANK_HTML'/);
  assert.match(dialogSource, /selectableSourceKindOptions\.map/);
  assert.doesNotMatch(
    dialogSource,
    /WOORI_BANK_HTML|우리은행|HTML 파일 선택|text\/html/
  );
});
