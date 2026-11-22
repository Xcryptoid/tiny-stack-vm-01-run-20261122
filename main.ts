// Tiny stack VM for make.fun's tiny stack ISA v1: runs each program.bin on
// its input.bin, writing what it prints and its exit code. All ten traps
// carry their own exit codes; arithmetic wraps at 32 bits.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
function run(p, g) {
  const D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256), O = new Uint8Array(65536);
  let s = 0, c = 0, q = 0, n = 0, i = 0, l = 0;
  const end = (e) => ({ out: O.subarray(0, l), code: e });
  for (;;) {
    if (n === 1e6) return end(10);
    if (q < 0 || q >= p.length) return end(9);
    const o = p[q], m = o === 1 ? 1 : o === 2 ? 4 : o >= 48 && o <= 51 ? 2 : 0;
    if (!(o <= 7 || (o >= 16 && o <= 34 && o !== 31) || (o >= 48 && o <= 52) || o === 64 || o === 65 || (o >= 80 && o <= 83))) return end(5);
    if (q + m >= p.length) return end(9);
    n++;
    const x = q + 1 + m;
    q = x;
    if (o >= 16 && o <= 34 && o !== 23 && o !== 27 && o !== 31) {
      if (s < 2) return end(2);
      const b = D[s - 1], a = D[s - 2];
      let r = 0;
      switch (o) {
        case 16: r = a + b | 0; break;
        case 17: r = a - b | 0; break;
        case 18: r = Math.imul(a, b); break;
        case 19: if (!b) return end(4); r = a === -2147483648 && b === -1 ? a : a / b | 0; break;
        case 20: if (!b) return end(4); r = b === -1 ? 0 : a % b | 0; break;
        case 21: if (!b) return end(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; break;
        case 22: if (!b) return end(4); r = (a >>> 0) % (b >>> 0) | 0; break;
        case 24: r = a & b; break;
        case 25: r = a | b; break;
        case 26: r = a ^ b; break;
        case 28: r = a << (b & 31); break;
        case 29: r = a >> (b & 31); break;
        case 30: r = a >>> (b & 31) | 0; break;
        case 32: r = a === b ? 1 : 0; break;
        case 33: r = a < b ? 1 : 0; break;
        case 34: r = (a >>> 0) < (b >>> 0) ? 1 : 0; break;
      }
      D[s - 2] = r; s--; continue;
    }
    switch (o) {
      case 0: return end(0);
      case 1: if (s === 256) return end(3); D[s++] = p[x - 1] << 24 >> 24; break;
      case 2: if (s === 256) return end(3); D[s++] = p[x - 4] | p[x - 3] << 8 | p[x - 2] << 16 | p[x - 1] << 24; break;
      case 3: if (s < 1) return end(2); s--; break;
      case 4: if (s < 1) return end(2); if (s === 256) return end(3); D[s] = D[s - 1]; s++; break;
      case 5: if (s < 2) return end(2); { const t = D[s - 1]; D[s - 1] = D[s - 2]; D[s - 2] = t; } break;
      case 6: if (s < 2) return end(2); if (s === 256) return end(3); D[s] = D[s - 2]; s++; break;
      case 7: if (s < 3) return end(2); { const t = D[s - 3]; D[s - 3] = D[s - 2]; D[s - 2] = D[s - 1]; D[s - 1] = t; } break;
      case 23: if (s < 1) return end(2); D[s - 1] = -D[s - 1] | 0; break;
      case 27: if (s < 1) return end(2); D[s - 1] = ~D[s - 1]; break;
      case 48: case 49: case 50: {
        const r = (p[x - 2] | p[x - 1] << 8) << 16 >> 16;
        let t = o === 48;
        if (o !== 48) { if (s < 1) return end(2); const v = D[--s]; t = o === 49 ? v === 0 : v !== 0; }
        if (t) q = x + r;
        break;
      }
      case 51: if (c === 64) return end(7); C[c++] = x; q = p[x - 2] | p[x - 1] << 8; break;
      case 52: if (c === 0) return end(8); q = C[--c]; break;
      case 64: if (s < 1) return end(2); { const a = D[s - 1]; if (a < 0 || a >= 256) return end(6); D[s - 1] = M[a]; } break;
      case 65: if (s < 2) return end(2); { const a = D[s - 1], v = D[s - 2]; if (a < 0 || a >= 256) return end(6); s -= 2; M[a] = v; } break;
      case 80: if (s < 1) return end(2); { const t = String(D[s - 1]); if (l + t.length > 65536) return end(11); s--; for (let j = 0; j < t.length; j++) O[l++] = t.charCodeAt(j); } break;
      case 81: if (s < 1) return end(2); if (l + 1 > 65536) return end(11); O[l++] = D[--s] & 255; break;
      case 82: if (s === 256) return end(3); D[s++] = i < g.length ? g[i++] : -1; break;
      case 83: if (s < 1) return end(2); return end(D[--s] & 255);
      default: return end(5);
    }
  }
}
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(new Uint8Array(readFileSync(join(I, id, 'program.bin'))), new Uint8Array(readFileSync(join(I, id, 'input.bin'))));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.out);
  writeFileSync(join(O, id, 'exit.txt'), `${r.code}\n`);
}
