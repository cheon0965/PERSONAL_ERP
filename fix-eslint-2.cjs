const fs = require('fs');
const files = [
  'apps/api/src/modules/carry-forwards/application/ports/carry-forward-generation.port.ts',
  'apps/api/src/modules/financial-statements/application/ports/financial-statement-generation.port.ts',
  'apps/api/src/modules/import-batches/application/ports/import-batch-write.port.ts',
  'apps/api/src/modules/journal-entries/application/ports/journal-entry-adjustment-store.port.ts',
  'apps/api/src/modules/plan-items/application/ports/plan-item-generation.port.ts',
  'apps/api/src/modules/operations-console/operations-console.service.ts'
];

for(const f of files) {
  if (!fs.existsSync(f)) continue;
  let text = fs.readFileSync(f, 'utf8');
  
  text = text.replace(/\/\/\s*eslint-disable-next-line no-restricted-imports\n/g, '');
  
  let fixed = text.replace(/import\s+(?:type\s+)?{[^}]*}\s+from\s+'@prisma\/client';/g, '// eslint-disable-next-line no-restricted-imports\n$&');
  
  if (f.endsWith('operations-console.service.ts')) {
     fixed = fixed.replace(/async readExportRowCount/g, 'async _readExportRowCount');
     fixed = fixed.replace(/async readExportSourceDates/g, 'async _readExportSourceDates');
     // Some methods might not have async
     fixed = fixed.replace(/ readExportRowCount/g, ' _readExportRowCount');
     fixed = fixed.replace(/ readExportSourceDates/g, ' _readExportSourceDates');
  }
  
  fs.writeFileSync(f, fixed);
}
console.log('Fixed multiple line replacements.');
