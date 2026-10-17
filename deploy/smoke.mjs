const [base, version] = process.argv.slice(2);
if (!base || !/^[0-9a-f]{40,64}$/.test(version || '')) throw new Error('Usage: smoke.mjs HTTPS_ORIGIN COMMIT_SHA');
const headers = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
  : {};
for (let attempt = 0; attempt < 15; attempt += 1) {
  try {
    const health = await fetch(new URL(`/api/health?release=${version}`, base), { headers, cache: 'no-store', signal: AbortSignal.timeout(10000) });
    const value = await health.json();
    if (!health.ok || value.status !== 'ok' || value.version !== version) throw new Error('Unexpected backend version');
    const sessionResponse = await fetch(new URL('/api/auth/me', base), {headers, cache:'no-store', signal:AbortSignal.timeout(10000)});
    const session = await sessionResponse.json();
    if (!sessionResponse.ok || session.user !== null) throw new Error('The authenticated API proxy is unavailable');
    const page = await fetch(base, { headers, signal: AbortSignal.timeout(10000) });
    if (!page.ok || !(await page.text()).includes('id="root"')) throw new Error('Frontend document is unavailable');
    console.log(`Public frontend and API verified: ${base} (${version})`);
    process.exit(0);
  } catch (error) {
    if (attempt === 14) throw error;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
