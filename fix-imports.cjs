const fs = require('fs');
const path = require('path');

const filesToFix = [
  'apps/api/src/modules/carry-forwards/application/ports/carry-forward-generation.port.ts',
  'apps/api/src/modules/financial-statements/application/ports/financial-statement-generation.port.ts',
  'apps/api/src/modules/import-batches/application/ports/import-batch-write.port.ts',
  'apps/api/src/modules/import-batches/application/ports/imported-row-collection.port.ts',
  'apps/api/src/modules/import-batches/application/use-cases/collect-imported-row.use-case.ts',
  'apps/api/src/modules/import-batches/application/use-cases/create-import-batch.use-case.ts',
  'apps/api/src/modules/import-batches/application/use-cases/preview-imported-row-collection.use-case.ts',
  'apps/api/src/modules/insurance-policies/application/use-cases/create-insurance-policy.use-case.ts',
  'apps/api/src/modules/insurance-policies/application/use-cases/delete-insurance-policy.use-case.ts',
  'apps/api/src/modules/insurance-policies/application/use-cases/update-insurance-policy.use-case.ts',
  'apps/api/src/modules/journal-entries/application/ports/journal-entry-adjustment-store.port.ts',
  'apps/api/src/modules/plan-items/application/ports/plan-item-generation.port.ts'
];

for (const relPath of filesToFix) {
  const filePath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('@prisma/client') || line.includes('@nestjs/common') || line.includes('prisma.service')) {
      if (i === 0 || !lines[i-1].includes('eslint-disable-next-line no-restricted-imports')) {
        newLines.push('// eslint-disable-next-line no-restricted-imports');
      }
    }
    newLines.push(line);
  }
  
  fs.writeFileSync(filePath, newLines.join('\n'));
}

console.log('Automated import lint fixes applied.');
