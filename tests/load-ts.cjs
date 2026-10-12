const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
module.exports = function loader(mocks = {}, globals = {}) {
  const root = path.join(__dirname, '../src');
  const cache = new Map();
  const context = vm.createContext({ console, Request, Response, Headers, URL, URLSearchParams, AbortSignal, Buffer, TextEncoder, TextDecoder, crypto: webcrypto, atob, btoa, setTimeout, clearTimeout, process: { env: {} }, ...globals });
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    function requireModule(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === 'next/server') return { NextResponse: Response, NextRequest: Request };
      if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`);
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(filename), name);
        return load(target.endsWith('.json') ? target : `${target}.ts`);
      }
      return require(name);
    }
    vm.runInContext(`(function(require,module,exports){${source}\n})`, context)(requireModule, module, module.exports);
    return module.exports;
  }
  return load;
};
