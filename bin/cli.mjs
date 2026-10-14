#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { HELP, parseCli, pkg } from '../src/cli-args.mjs';
import { render } from '../src/render.mjs';

async function main() {
  let o;
  try {
    o = parseCli(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n\n${HELP}`);
    process.exit(2);
  }
  if (o.help) return void process.stdout.write(HELP);
  if (o.version) return void process.stdout.write(`${pkg.version}\n`);
  let lastPct = -1;
  try {
    const r = await render({
      ...o,
      onProgress: ({ frame, frames, elapsed }) => {
        const pct = Math.floor((frame / frames) * 20) * 5;
        if (pct !== lastPct || frame === frames) {
          lastPct = pct;
          const per = elapsed / frame;
          process.stderr.write(`\r${String(pct).padStart(3)}%  frame ${frame}/${frames}  ${per.toFixed(2)} s/frame  ETA ${Math.round(per * (frames - frame))} s   `);
        }
      },
    });
    process.stderr.write('\n');
    if (o.hashFrames) writeFileSync(o.hashFrames, JSON.stringify(r.hashes, null, 1));
    process.stdout.write(`${o.output}  ${r.frames} frames, ${r.duration.toFixed(2)} s of audio, rendered in ${r.seconds.toFixed(1)} s on ${r.gpu}\n`);
  } catch (e) {
    process.stderr.write(`\nerror: ${e.message}\n`);
    process.exit(1);
  }
}

await main();
