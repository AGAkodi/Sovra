// Node globals some NEAR wallet modules (e.g. Meteor) expect. Must be imported
// before any wallet module; main.tsx imports this first.
import { Buffer } from 'buffer';

const g = globalThis as unknown as {
  Buffer?: typeof Buffer;
  process?: { env: Record<string, string>; browser: boolean; version: string; nextTick: (fn: (...a: unknown[]) => void, ...args: unknown[]) => void };
};

if (!g.Buffer) g.Buffer = Buffer;
if (!g.process) {
  g.process = {
    env: {},
    browser: true,
    version: '',
    nextTick: (fn, ...args) => queueMicrotask(() => fn(...args)),
  };
}
