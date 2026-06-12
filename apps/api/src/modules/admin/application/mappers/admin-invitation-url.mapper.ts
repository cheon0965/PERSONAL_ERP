export function buildAdminInvitationUrl(input: {
  appOrigin: string;
  token: string;
}): string {
  const url = new URL('/accept-invitation', input.appOrigin);
  url.searchParams.set('token', input.token);
  return url.toString();
}
