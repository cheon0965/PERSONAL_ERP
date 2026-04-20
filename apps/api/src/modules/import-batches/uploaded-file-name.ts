const koreanTextPattern = /[\u3131-\u318e\uac00-\ud7a3]/u;

export function normalizeUploadedFileName(fileName: string): string {
  if (koreanTextPattern.test(fileName)) {
    return fileName;
  }

  const repairedFileName = Buffer.from(fileName, 'latin1').toString('utf8');

  if (
    koreanTextPattern.test(repairedFileName) &&
    !repairedFileName.includes('\ufffd')
  ) {
    return repairedFileName;
  }

  return fileName;
}
