import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { decode, encode } from 'iconv-lite';
import { encryptSeedCbcPkcs7 } from '../../../src/modules/import-batches/public';

export function buildWooriCardHtmlFixture(): Buffer {
  return encode(
    [
      '<!DOCTYPE html>',
      '<html lang="ko">',
      '<head><meta http-equiv="Content-Type" content="text/html; charset=EUC-KR"></head>',
      '<body>',
      '<p>우리카드 이용대금 명세서 2026 04 총 결제금액 28,430 원 결제일 2026년 04월 16일</p>',
      '<table>',
      '<tr><th>이용 일자</th><th>이용가맹점</th><th>이용금액 (해외현지금액)</th><th>당월 결제하실 금액</th><th>결제 후 잔액</th><th>포인트</th></tr>',
      '<tr><th>기간</th><th>회차</th><th>청구금액 (US$)</th><th>수수료 (환율)</th><th>이용 혜택</th><th>혜택 금액</th><th>납부하실 금액</th><th>꿀머니(모아)</th></tr>',
      '<tr><td>(M083)카드의정석 DISCOUNT</td></tr>',
      '<tr><td>03/09</td><td>G마켓_1566-5701_gmarket.co.kr</td><td>13,430</td><td>1</td><td>13,430</td><td>할인</td><td>94</td><td>13,336</td></tr>',
      '<tr><td>12/24</td><td>취소-구글클라우드코리아</td><td>-15,000</td><td>1</td><td>0</td><td>할인</td><td>105</td><td>0</td></tr>',
      '<tr><td>통합청구합계</td><td>28,430</td><td>0</td><td>0</td><td>28,430</td><td>0</td></tr>',
      '</table>',
      '</body>',
      '</html>'
    ].join('\n'),
    'euc-kr'
  );
}

export function buildWooriBankHtmlFixture(): Buffer {
  return encode(
    [
      '<!DOCTYPE html>',
      '<html lang="ko">',
      '<head><meta http-equiv="Content-Type" content="text/html; charset=EUC-KR"></head>',
      '<body>',
      '<table>',
      '<thead>',
      '<tr><th>계좌번호</th><td>1002-000-000000</td></tr>',
      '<tr><th>조회기간</th><td>2026.04.01 ~ 2026.04.30</td></tr>',
      '<tr><th>거래일시</th><th>거래구분</th><th>기재내용</th><th>출금금액</th><th>입금금액</th><th>잔액</th><th>취급점</th></tr>',
      '</thead>',
      '<tbody>',
      '<tr><td>2026.04.16 03:06:13</td><td>입금</td><td>스마트스토어 정산</td><td>0원</td><td>201,940원</td><td>4,559,447원</td><td>스마트뱅킹</td></tr>',
      '<tr><td>2026.04.18 21:11:26</td><td>출금</td><td>카카오페이</td><td>10,145원</td><td>0원</td><td>4,399,152원</td><td>우리WON뱅킹</td></tr>',
      '</tbody>',
      '</table>',
      '</body>',
      '</html>'
    ].join('\n'),
    'euc-kr'
  );
}

export function buildEncryptedWooriBankVestMailFixture(
  password: string
): Buffer {
  return buildEncryptedVestMailFixture({
    html: decode(buildWooriBankHtmlFixture(), 'euc-kr'),
    password,
    markerText: 'WOORIBANK VestMail'
  });
}

export function buildEncryptedWooriCardVestMailFixture(
  password: string
): Buffer {
  return buildEncryptedVestMailFixture({
    html: decode(buildWooriCardHtmlFixture(), 'euc-kr'),
    password,
    markerText: '우리카드 VestMail'
  });
}

export function buildEncryptedVestMailFixture(input: {
  html: string;
  password: string;
  markerText: string;
}): Buffer {
  const passwordHash = createHash('sha256')
    .update(Buffer.from(input.password, 'utf8'))
    .digest();
  const key = createHash('sha256')
    .update(passwordHash)
    .digest()
    .subarray(0, 16);
  const iv = passwordHash.subarray(0, 16);
  const plaintext = Buffer.concat([key, Buffer.from(input.html, 'utf8')]);
  const encrypted = encryptSeedCbcPkcs7(plaintext, key, iv);
  const envelope = Buffer.concat([
    Buffer.alloc(16),
    Buffer.from(encrypted)
  ]).toString('base64');

  return Buffer.from(
    [
      '<!DOCTYPE html>',
      '<html>',
      '<body>',
      input.markerText,
      '<script>',
      'var s= new Array();',
      `s[0] = "${envelope}";`,
      'var vestmail = true;',
      '</script>',
      '</body>',
      '</html>'
    ].join('\n'),
    'utf8'
  );
}

export function buildMinimalImBankPdfFixture(): Buffer {
  return buildImBankPdfFixture([
    {
      rowNumber: 1,
      occurredAtText: '2026-04-18 [21:11:26]',
      withdrawalAmountText: '10,145',
      depositAmountText: '0',
      balanceAfterText: '4,399,152',
      remarks: '카카오페이'
    },
    {
      rowNumber: 2,
      occurredAtText: '2026-04-15 [18:16:48]',
      withdrawalAmountText: '0',
      depositAmountText: '2,010,940',
      balanceAfterText: '4,559,447',
      remarks: '*** 2026년 04'
    }
  ]);
}

export function buildMinimalKbKookminBankPdfFixture(): Buffer {
  return buildKbKookminBankPdfFixture({
    rows: [
      {
        rowNumber: 1,
        occurredAtText: '2026-05-02 13:06:13',
        title: '급여입금',
        withdrawalAmountText: '0',
        depositAmountText: '201,940',
        balanceAfterText: '4,559,447'
      },
      {
        rowNumber: 2,
        occurredAtText: '2026-05-01 09:14:00',
        title: '카카오페이',
        withdrawalAmountText: '10,145',
        depositAmountText: '0',
        balanceAfterText: '4,399,152'
      }
    ]
  });
}

export function buildEncryptedKbKookminBankPdfFixture(
  password: string
): Buffer {
  return buildKbKookminBankPdfFixture({
    rows: [
      {
        rowNumber: 1,
        occurredAtText: '2026-05-02 13:06:13',
        title: '급여입금',
        withdrawalAmountText: '0',
        depositAmountText: '201,940',
        balanceAfterText: '4,559,447'
      },
      {
        rowNumber: 2,
        occurredAtText: '2026-05-01 09:14:00',
        title: '카카오페이',
        withdrawalAmountText: '10,145',
        depositAmountText: '0',
        balanceAfterText: '4,399,152'
      }
    ],
    password
  });
}

export function buildScannedImBankPdfFixture(): Buffer {
  return Buffer.concat([
    Buffer.from('%PDF-1.4\n', 'latin1'),
    buildPdfStreamObject(1, 'q\n10 0 0 10 0 0 cm\n/Im0 Do\nQ'),
    Buffer.from('%%EOF\n', 'latin1')
  ]);
}

export function buildKbKookminBankPdfFixture(input: {
  rows: Array<{
    rowNumber: number;
    occurredAtText: string;
    title: string;
    withdrawalAmountText: string;
    depositAmountText: string;
    balanceAfterText: string;
  }>;
  password?: string;
}): Buffer {
  const cmap = [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CMapName /Adobe-Identity-UCS def',
    'endcmap'
  ].join('\n');
  const header = [
    drawText(
      30,
      732,
      'KB국민은행 거래내역조회 계좌번호 : 7849-00-000000 조회기간 : 2026.05.01 ~ 2026.05.02'
    ),
    drawText(34.68, 717, '순번'),
    drawText(69.58, 717, '거래일시'),
    drawText(174.12, 717, '거래내용'),
    drawText(241.79, 717, '출금액'),
    drawText(302.91, 717, '입금액'),
    drawText(372.15, 717, '잔액')
  ];
  const body = input.rows.flatMap((row, index) => {
    const y = 704.3 - index * 12;

    return [
      drawText(38.31, y, String(row.rowNumber)),
      drawText(69.58, y, row.occurredAtText),
      drawText(174.12, y, row.title),
      drawText(241.79, y, row.withdrawalAmountText),
      drawText(302.91, y, row.depositAmountText),
      drawText(372.15, y, row.balanceAfterText)
    ];
  });
  const content = [...header, ...body, drawText(390, 24, '거래내역조회')].join(
    '\n'
  );

  if (input.password) {
    return buildEncryptedRevision2PdfFixture({
      password: input.password,
      streams: [
        { objectNumber: 1, content: cmap },
        { objectNumber: 2, content }
      ]
    });
  }

  return Buffer.concat([
    Buffer.from('%PDF-1.4\n', 'latin1'),
    buildPdfStreamObject(1, cmap),
    buildPdfStreamObject(2, content),
    Buffer.from('%%EOF\n', 'latin1')
  ]);
}

export function buildImBankPdfFixture(
  rows: Array<{
    rowNumber: number;
    occurredAtText: string;
    withdrawalAmountText: string;
    depositAmountText: string;
    balanceAfterText: string;
    remarks: string;
  }>
): Buffer {
  const cmap = [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CMapName /Adobe-Identity-UCS def',
    'endcmap'
  ].join('\n');
  const header = [
    drawText(
      30,
      732,
      '고객명 : 테스트 조회계좌번호 : 092-00-000000-0 조회기간 : 2026-04-01 ~ 2026-04-30 현재잔액 : 4,399,152 원'
    ),
    drawText(34.68, 717, 'NO'),
    drawText(97.83, 717, '거래일시'),
    drawText(225.03, 717, '찾으신금액'),
    drawText(278.27, 717, '맡기신금액'),
    drawText(331.51, 717, '거래후잔액'),
    drawText(405.91, 717, '비고')
  ];
  const body = rows.flatMap((row, index) => {
    const y = 704.3 - index * 12;

    return [
      drawText(38.31, y, String(row.rowNumber)),
      drawText(69.58, y, row.occurredAtText),
      drawText(241.79, y, row.withdrawalAmountText),
      drawText(282.91, y, row.depositAmountText),
      drawText(336.15, y, row.balanceAfterText),
      drawText(383.35, y, row.remarks)
    ];
  });
  const content = [...header, ...body, drawText(390, 24, '거래내역조회')].join(
    '\n'
  );

  return Buffer.concat([
    Buffer.from('%PDF-1.4\n', 'latin1'),
    buildPdfStreamObject(1, cmap),
    buildPdfStreamObject(2, content),
    Buffer.from('%%EOF\n', 'latin1')
  ]);
}

export function buildPdfStreamObject(
  objectNumber: number,
  content: string
): Buffer {
  const compressed = deflateSync(Buffer.from(content, 'utf8'));

  return Buffer.concat([
    Buffer.from(
      `${objectNumber} 0 obj\n<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`,
      'latin1'
    ),
    compressed,
    Buffer.from('\nendstream\nendobj\n', 'latin1')
  ]);
}

export function buildEncryptedRevision2PdfFixture(input: {
  password: string;
  streams: Array<{ objectNumber: number; content: string }>;
}): Buffer {
  const permissions = -4;
  const firstFileId = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
  const ownerPassword = createHash('sha256')
    .update('test-owner-password', 'utf8')
    .digest();
  const fileKey = buildRevision2FileKeyForTest(
    input.password,
    ownerPassword,
    permissions,
    firstFileId
  );
  const userPassword = rc4ForTest(fileKey, PDF_PADDING_FOR_TEST);
  const streamObjects = input.streams.map(({ objectNumber, content }) =>
    buildEncryptedPdfStreamObject(objectNumber, content, fileKey)
  );

  return Buffer.concat([
    Buffer.from('%PDF-1.4\n', 'latin1'),
    ...streamObjects,
    Buffer.from(
      [
        '16 0 obj',
        `<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${ownerPassword.toString('hex')}> /U <${userPassword.toString('hex')}> /P ${permissions} >>`,
        'endobj',
        'trailer',
        `<< /Size 17 /Encrypt 16 0 R /ID [<${firstFileId.toString('hex')}><${firstFileId.toString('hex')}>] >>`,
        '%%EOF',
        ''
      ].join('\n'),
      'latin1'
    )
  ]);
}

export function buildEncryptedPdfStreamObject(
  objectNumber: number,
  content: string,
  fileKey: Buffer
): Buffer {
  const compressed = deflateSync(Buffer.from(content, 'utf8'));
  const objectKey = buildPdfObjectKeyForTest(fileKey, objectNumber, 0);
  const encrypted = rc4ForTest(objectKey, compressed);

  return Buffer.concat([
    Buffer.from(
      `${objectNumber} 0 obj\n<< /Length ${encrypted.length} /Filter /FlateDecode >>\nstream\n`,
      'latin1'
    ),
    encrypted,
    Buffer.from('\nendstream\nendobj\n', 'latin1')
  ]);
}

export const PDF_PADDING_FOR_TEST = Buffer.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff,
  0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c,
  0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a
]);

export function buildRevision2FileKeyForTest(
  password: string,
  ownerPassword: Buffer,
  permissionsValue: number,
  firstFileId: Buffer
): Buffer {
  const permissions = Buffer.alloc(4);
  permissions.writeInt32LE(permissionsValue, 0);

  return createHash('md5')
    .update(
      Buffer.concat([
        padPdfPasswordForTest(password),
        ownerPassword,
        permissions,
        firstFileId
      ])
    )
    .digest()
    .subarray(0, 5);
}

export function buildPdfObjectKeyForTest(
  fileKey: Buffer,
  objectNumber: number,
  generationNumber: number
): Buffer {
  const objectSeed = Buffer.from([
    objectNumber & 0xff,
    (objectNumber >> 8) & 0xff,
    (objectNumber >> 16) & 0xff,
    generationNumber & 0xff,
    (generationNumber >> 8) & 0xff
  ]);

  return createHash('md5')
    .update(Buffer.concat([fileKey, objectSeed]))
    .digest()
    .subarray(0, Math.min(fileKey.length + 5, 16));
}

export function padPdfPasswordForTest(password: string): Buffer {
  const passwordBytes = Buffer.from(password, 'utf8');

  if (passwordBytes.length >= 32) {
    return Buffer.from(passwordBytes.subarray(0, 32));
  }

  return Buffer.concat([
    passwordBytes,
    PDF_PADDING_FOR_TEST.subarray(0, 32 - passwordBytes.length)
  ]);
}

export function rc4ForTest(key: Buffer, data: Buffer): Buffer {
  const state = Array.from({ length: 256 }, (_, index) => index);
  let j = 0;

  for (let i = 0; i < 256; i += 1) {
    j = (j + state[i]! + key[i % key.length]!) & 0xff;
    [state[i], state[j]] = [state[j]!, state[i]!];
  }

  const output = Buffer.alloc(data.length);
  let i = 0;
  j = 0;

  for (let index = 0; index < data.length; index += 1) {
    i = (i + 1) & 0xff;
    j = (j + state[i]!) & 0xff;
    [state[i], state[j]] = [state[j]!, state[i]!];
    output[index] = data[index]! ^ state[(state[i]! + state[j]!) & 0xff]!;
  }

  return output;
}

export function drawText(x: number, y: number, text: string): string {
  return [
    'BT',
    '/F1 8 Tf',
    `1 0 0 1 ${x} ${y} Tm`,
    `(${escapePdfLiteral(text)})Tj`,
    'ET'
  ].join('\n');
}

export function escapePdfLiteral(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}
