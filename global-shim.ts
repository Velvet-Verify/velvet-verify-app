// global-shim.ts  (create this file in the project root)
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {} as any;
}