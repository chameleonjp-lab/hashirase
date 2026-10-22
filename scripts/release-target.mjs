import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function isCurrentRelease({ sourceSha, mainSha }) {
  if (![sourceSha, mainSha].every(sha => typeof sha === 'string' && /^[a-f0-9]{40}$/.test(sha))) throw new Error('Release and main require full commit SHAs');
  return sourceSha === mainSha;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const sourceSha = args.includes('--source-sha') ? args[args.indexOf('--source-sha') + 1] : process.env.GITHUB_SHA;
    const repository = process.env.GITHUB_REPOSITORY;
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !process.env.GITHUB_TOKEN || !process.env.GITHUB_OUTPUT) throw new Error('Release preflight requires the GitHub Actions repository, token and output file');
    const response = await fetch(`https://api.github.com/repos/${repository}/git/ref/heads/main`, {
      headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) throw new Error(`Main ref lookup returned HTTP ${response.status}`);
    const mainSha = (await response.json()).object?.sha;
    const publish = isCurrentRelease({ sourceSha, mainSha });
    await appendFile(process.env.GITHUB_OUTPUT, `publish=${publish}\n`);
    console.log(`Release preflight: ${sourceSha}, main ${mainSha}, publish ${publish}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
