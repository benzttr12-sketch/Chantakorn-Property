const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function mount({ reduced = false, webgl = true } = {}) {
  let effect, id = 0, now = 100;
  const frames = new Map(), documentListeners = {}, canvasListeners = {}, motionListeners = {};
  const uniform = [], counts = { draws: 0, deleted: 0 };
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8,
    createShader: () => ({}), shaderSource: () => {}, compileShader: () => {},
    getShaderParameter: () => true, deleteShader: () => {}, createProgram: () => ({}),
    attachShader: () => {}, linkProgram: () => {}, getProgramParameter: () => true,
    createBuffer: () => ({}), bindBuffer: () => {}, bufferData: () => {}, useProgram: () => {},
    getAttribLocation: () => 0, enableVertexAttribArray: () => {}, vertexAttribPointer: () => {},
    getUniformLocation: (_p, name) => name, uniform3fv: () => {},
    uniform4f: (...v) => { if (v[0] === 'u_scene') uniform.push(v); }, viewport: () => {},
    drawArrays: () => { counts.draws++; }, isContextLost: () => false,
    deleteProgram: () => { counts.deleted++; }, deleteBuffer: () => { counts.deleted++; },
  };
  const canvas = { clientWidth: 200, clientHeight: 100, width: 0, height: 0, dataset: {},
    getContext: () => webgl ? gl : null,
    addEventListener: (n, fn) => { canvasListeners[n] = fn; }, removeEventListener: () => {},
  };
  const document = { hidden: false, addEventListener: (n, fn) => { documentListeners[n] = fn; }, removeEventListener: () => {} };
  const motion = { matches: reduced, addEventListener: (n, fn) => { motionListeners[n] = fn; }, removeEventListener: () => {} };
  const window = { devicePixelRatio: 3, matchMedia: () => motion, addEventListener: () => {}, removeEventListener: () => {} };
  const hooks = { useRef: () => ({ current: canvas }), useEffect: fn => { effect = fn; } };
  class Observer { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} }
  const javascript = ts.transpileModule(fs.readFileSync('src/components/home/MeshDriftBackground.tsx','utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const context = { module, exports: module.exports, require: name => {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return { jsx: () => null };
    if (name === '@/lib/mesh-drift-shader') return { MESH_DRIFT_FRAGMENT: 'fragment' };
    throw Error(name);
  }, window, document, IntersectionObserver: Observer, ResizeObserver: Observer,
  requestAnimationFrame: fn => { frames.set(++id, fn); return id; }, cancelAnimationFrame: i => frames.delete(i), Float32Array };
  vm.runInNewContext(javascript, context);
  module.exports.default();
  const cleanup = effect();
  return { canvas, document, documentListeners, motion, motionListeners, frames, uniform, counts, cleanup,
    step: (advance = 40) => { now += advance; const f = [...frames.values()][0]; frames.clear(); if (f) f(now); },
  };
}

test('draws the requested canvas at capped pixel ratio and animates only when visible', () => {
  const s = mount();
  assert.equal(s.canvas.dataset.rendered, 'true');
  assert.deepEqual([s.canvas.width, s.canvas.height], [400, 200]);
  assert.equal(s.frames.size, 1);
  s.step(); s.step();
  assert.ok(s.uniform.at(-1)[3] > 0, 'shader time advances');
  s.document.hidden = true; s.documentListeners.visibilitychange();
  assert.equal(s.frames.size, 0);
  const draws = s.counts.draws; s.step(); assert.equal(s.counts.draws, draws);
  s.document.hidden = false; s.documentListeners.visibilitychange(); assert.equal(s.frames.size, 1);
  s.cleanup(); assert.equal(s.frames.size, 0); assert.equal(s.canvas.dataset.rendered, undefined); assert.equal(s.counts.deleted, 2);
});

test('respects reduced motion and falls back safely if WebGL is unavailable', () => {
  const s = mount({ reduced: true });
  assert.equal(s.canvas.dataset.rendered, 'true'); assert.equal(s.frames.size, 0);
  s.motion.matches = false; s.motionListeners.change(); assert.equal(s.frames.size, 1);
  s.motion.matches = true; s.motionListeners.change(); assert.equal(s.frames.size, 0);
  s.cleanup();
  const fallback = mount({ webgl: false });
  assert.equal(fallback.canvas.dataset.rendered, undefined); assert.equal(fallback.frames.size, 0);
});
