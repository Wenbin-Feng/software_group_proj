import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("request logs exclude OAuth codes, state, cookies and authorization headers", () => {
  const script = `
    import {buildApp} from ${JSON.stringify(new URL("../src/server.ts", import.meta.url).href)};
    import {mkdtempSync,rmSync} from 'node:fs';
    import {join} from 'node:path';import {tmpdir} from 'node:os';
    const dir=mkdtempSync(join(tmpdir(),'folio-auth-log-'));
    const app=await buildApp({dataDir:dir,publicUrl:'https://folio.example',logger:true,seed:false,registerAi:false,googleProvider:null});
    await app.inject({url:'/api/auth/google/callback?code=SYNTHETIC_PRIVATE_CODE&state=SYNTHETIC_PRIVATE_STATE',headers:{cookie:'folio_session=SYNTHETIC_PRIVATE_COOKIE',authorization:'Bearer SYNTHETIC_PRIVATE_HEADER'}});
    await app.close();rmSync(dir,{recursive:true,force:true});
  `;
  const child = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", script],
    { encoding: "utf8", timeout: 20000 },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /"url":"\/api\/auth\/google\/callback"/);
  assert.doesNotMatch(
    child.stdout + child.stderr,
    /SYNTHETIC_PRIVATE_(?:CODE|STATE|COOKIE|HEADER)/,
  );
});
