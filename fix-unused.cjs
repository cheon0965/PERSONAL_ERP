const fs = require('fs');
const filePath =
  'apps/api/src/modules/operations-console/operations-console.service.ts';
if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(/CreateOperationsExportRequest,\s*/g, '');
  content = content.replace(/CreateOperationsNoteRequest,\s*/g, '');
  content = content.replace(/OperationsExportResult,\s*/g, '');
  content = content.replace(/OperationsExportScopeItem,\s*/g, '');
  content = content.replace(/OperationsExportsResponse,\s*/g, '');
  content = content.replace(/OperationsNotesResponse,\s*/g, '');
  content = content.replace(/PlanItemStatus,\s*/g, '');

  content = content.replace(
    /const openPeriodStatuses/g,
    'const _openPeriodStatuses'
  );
  content = content.replace(
    /const unresolvedTransactionStatuses/g,
    'const _unresolvedTransactionStatuses'
  );
  content = content.replace(
    /const operationsPeriodInclude/g,
    'const _operationsPeriodInclude'
  );
  content = content.replace(
    /import \{ mapAccountingPeriodRecordToItem \} from '\.\.\/accounting-periods\/accounting-period\.mapper';\n?/g,
    ''
  );

  content = content.replace(
    /type BuildExportPayloadInput/g,
    'type _BuildExportPayloadInput'
  );
  content = content.replace(
    /type BuildExportPayloadResult/g,
    'type _BuildExportPayloadResult'
  );

  content = content.replace(
    /async readExportRowCount/g,
    'async _readExportRowCount'
  );
  content = content.replace(
    /async readExportSourceDates/g,
    'async _readExportSourceDates'
  );
  content = content.replace(/ readExportScopeLabel/g, ' _readExportScopeLabel');
  content = content.replace(
    / readExportScopeDescription/g,
    ' _readExportScopeDescription'
  );
  content = content.replace(
    / readExportScopeCadence/g,
    ' _readExportScopeCadence'
  );
  content = content.replace(/ readScopeRangeLabel/g, ' _readScopeRangeLabel');
  content = content.replace(/ isExportScope/g, ' _isExportScope');
  content = content.replace(
    / readPeriodRecordLabel/g,
    ' _readPeriodRecordLabel'
  );
  content = content.replace(
    / normalizeOptionalText/g,
    ' _normalizeOptionalText'
  );
  content = content.replace(/ mapOperationalNote/g, ' _mapOperationalNote');
  content = content.replace(/ readLatestIso/g, ' _readLatestIso');
  content = content.replace(/ readLatestDateValue/g, ' _readLatestDateValue');
  content = content.replace(/ readDateValue/g, ' _readDateValue');
  content = content.replace(/ toCsv/g, ' _toCsv');

  fs.writeFileSync(filePath, content);
  console.log('Fixed operations-console.service.ts unused vars');
}
