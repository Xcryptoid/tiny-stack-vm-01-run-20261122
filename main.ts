import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Tiny stack VM for make.fun's ISA: runs every program.bin of a set on its
// input.bin, writing stdout.bin + exit.txt. Faithful to the reference VM.

// Opcode byte -> [immediate bytes, values popped, values pushed].
const OPS = {
  0: [0, 0, 0], 1: [1, 0, 1], 2: [4, 0, 1], 3: [0, 1, 0], 4: [0, 1, 2],
  5: [0, 2, 2], 6: [0, 2, 3], 7: [0, 3, 3],
  16: [0, 2, 1], 17: [0, 2, 1], 18: [0, 2, 1], 19: [0, 2, 1],
  20: [0, 2, 1], 21: [0, 2, 1], 22: [0, 2, 1], 23: [0, 1, 1],
  24: [0, 2, 1], 25: [0, 2, 1], 26: [0, 2, 1], 27: [0, 1, 1],
  28: [0, 2, 1], 29: [0, 2, 1], 30: [0, 2, 1], 32: [0, 2, 1],
  33: [0, 2, 1], 34: [0, 2, 1],
  48: [2, 0, 0], 49: [2, 1, 0], 50: [2, 1, 0], 51: [2, 0, 0], 52: [0, 0, 0],
  64: [0, 1, 1], 65: [0, 2, 0],
  80: [0, 1, 0], 81: [0, 1, 0], 82: [0, 0, 1], 83: [0, 1, 0],
};

function run(p, q) {
  const D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256);
  const o = new Uint8Array(65536);
  let s = 0, c = 0, l = 0, i = 0, pc = 0, n = 0;
  const end = (e) => ({ out: o.slice(0, l), code: e });
  for (;;) {
    if (n === 1000000) return end(10);
    if (pc < 0 || pc >= p.length) return end(9);
    const b = p[pc];
    const op = OPS[b];
    if (!op) return end(5);
    const m = op[0];
    if (pc + m >= p.length) return end(9);
    n++;
    if (s < op[1]) return end(2);
    if (s - op[1] + op[2] > 256) return end(3);
    const nx = pc + 1 + m;
    pc = nx;
    switch (b) {
      case 0: return end(0);
      case 1: D[s++] = (p[nx - 1] << 24) >> 24; break;
      case 2: D[s++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break;
      case 3: s--; break;
      case 4: D[s] = D[s - 1]; s++; break;
      case 5: { const t = D[s - 1]; D[s - 1] = D[s - 2]; D[s - 2] = t; break; }
      case 6: D[s] = D[s - 2]; s++; break;
      case 7: { const a = D[s - 3]; D[s - 3] = D[s - 2]; D[s - 2] = D[s - 1]; D[s - 1] = a; break; }
      case 23: D[s - 1] = -D[s - 1] | 0; break;
      case 27: D[s - 1] = ~D[s - 1]; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22:
      case 24: case 25: case 26: case 28: case 29: case 30: case 32: case 33: case 34: {
        const y = D[s - 1], x = D[s - 2];
        if (b >= 19 && b <= 22 && y === 0) return end(4);
        const r = [(x + y) | 0, (x - y) | 0, Math.imul(x, y), x === -2147483648 && y === -1 ? x : (x / y) | 0, y === -1 ? 0 : (x % y) | 0, Math.floor((x >>> 0) / (y >>> 0)) | 0, ((x >>> 0) % (y >>> 0)) | 0, 0, x & y, x | y, x ^ y, 0, x << (y & 31), x >> (y & 31), (x >>> (y & 31)) | 0, 0, x === y ? 1 : 0, x < y ? 1 : 0, (x >>> 0) < (y >>> 0) ? 1 : 0][b - 16];
        s -= 2; D[s++] = r; break;
      }
      case 48: case 49: case 50: {
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        let take = true;
        if (b !== 48) { const v = D[--s]; take = b === 49 ? v === 0 : v !== 0; }
        if (take) pc = nx + rel;
        break;
      }
      case 51:
        if (c === 64) return end(7);
        C[c++] = nx;
        pc = p[nx - 2] | (p[nx - 1] << 8);
        break;
      case 52:
        if (c === 0) return end(8);
        pc = C[--c];
        break;
      case 64: {
        const a = D[s - 1];
        if (a < 0 || a > 255) return end(6);
        D[s - 1] = M[a];
        break;
      }
      case 65: {
        const a = D[s - 1], v = D[s - 2];
        if (a < 0 || a > 255) return end(6);
        s -= 2; M[a] = v;
        break;
      }
      case 80: {
        const t = String(D[s - 1]);
        if (l + t.length > 65536) return end(11);
        s--;
        for (let k = 0; k < t.length; k++) o[l++] = t.charCodeAt(k);
        break;
      }
      case 81:
        if (l + 1 > 65536) return end(11);
        o[l++] = D[--s] & 255;
        break;
      case 82: D[s++] = i < q.length ? q[i++] : -1; break;
      case 83: return end(D[--s] & 255);
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(readFileSync(join(I, id, 'program.bin')), readFileSync(join(I, id, 'input.bin')));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.out);
  writeFileSync(join(O, id, 'exit.txt'), r.code + '\n');
}
