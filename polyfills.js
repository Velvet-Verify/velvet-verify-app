// polyfills.js
if (typeof global.document === 'undefined') {
  global.document = {
    // styled-components looks for these two
    querySelectorAll: () => [],
    head: { appendChild() {} },

    /* ↓ anything else can be added later if another lib complains */
  };
}