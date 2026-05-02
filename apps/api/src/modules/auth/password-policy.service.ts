import { BadRequestException, Injectable } from '@nestjs/common';

type PasswordPolicyContext = {
  email?: string | null;
  name?: string | null;
  additionalTerms?: Array<string | null | undefined>;
};

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password12',
  'password123',
  'password1234',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwerty1234',
  'letmein',
  'letmein123',
  'welcome1',
  'welcome123',
  'admin123',
  'admin1234',
  '11111111',
  '00000000',
  'iloveyou',
  'changeme',
  'changeme123'
]);

const PRODUCT_CONTEXT_TERMS = [
  'personalerp',
  'personal-erp',
  'personal_erp',
  'personal',
  'erp'
];

@Injectable()
export class PasswordPolicyService {
  assertAcceptable(
    password: string,
    context: PasswordPolicyContext = {}
  ): void {
    const normalized = normalizePassword(password);

    if (COMMON_PASSWORDS.has(normalized)) {
      throw new BadRequestException('너무 흔한 비밀번호는 사용할 수 없습니다.');
    }

    const contextTerms = buildContextTerms(context);
    if (
      contextTerms.some((term) => isContextDerivedPassword(normalized, term))
    ) {
      throw new BadRequestException(
        '이메일, 이름, 서비스명과 너무 비슷한 비밀번호는 사용할 수 없습니다.'
      );
    }
  }
}

function normalizePassword(password: string): string {
  return password.trim().toLowerCase();
}

function buildContextTerms(context: PasswordPolicyContext): string[] {
  const terms = new Set<string>();

  addTerm(terms, context.email?.split('@')[0]);
  addTerm(terms, context.name);

  for (const namePart of context.name?.split(/\s+/) ?? []) {
    addTerm(terms, namePart);
  }

  for (const productTerm of PRODUCT_CONTEXT_TERMS) {
    addTerm(terms, productTerm);
  }

  for (const term of context.additionalTerms ?? []) {
    addTerm(terms, term);
  }

  return Array.from(terms);
}

function addTerm(terms: Set<string>, rawTerm: string | null | undefined): void {
  const term = rawTerm
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  if (term && term.length >= 8) {
    terms.add(term);
  }
}

function isContextDerivedPassword(password: string, term: string): boolean {
  const compactPassword = password.replace(/[^a-z0-9]/g, '');
  const compactTerm = term.replace(/[^a-z0-9]/g, '');

  return (
    compactPassword === compactTerm ||
    compactPassword.startsWith(compactTerm) ||
    compactPassword.endsWith(compactTerm)
  );
}
