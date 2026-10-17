// Capture the current production alias so a failed rollout can restore the pair.
import { appendFileSync } from 'node:fs';
const { APP_PUBLIC_URL, VERCEL_TOKEN, VERCEL_ORG_ID, GITHUB_OUTPUT } = process.env;
if (!APP_PUBLIC_URL || !VERCEL_TOKEN || !VERCEL_ORG_ID || !GITHUB_OUTPUT) throw new Error('Missing Vercel deployment configuration');
const host = new URL(APP_PUBLIC_URL).host;
const response = await fetch(`https://api.vercel.com/v4/aliases/${encodeURIComponent(host)}?teamId=${encodeURIComponent(VERCEL_ORG_ID)}`, {
  headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
});
if (response.status === 404) {
  appendFileSync(GITHUB_OUTPUT, 'previous_url=\n');
} else {
  if (!response.ok) throw new Error(`Vercel production lookup failed (${response.status})`);
  const alias = await response.json();
  const url = alias.deployment?.url;
  if (!url || !/^[a-z\d.-]+\.vercel\.app$/i.test(url)) throw new Error('Could not resolve the previous production deployment');
  appendFileSync(GITHUB_OUTPUT, `previous_url=https://${url}\n`);
}
