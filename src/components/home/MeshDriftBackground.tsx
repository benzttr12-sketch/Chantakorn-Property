'use client';

import { useEffect, useRef } from 'react';
import { MESH_DRIFT_FRAGMENT } from '@/lib/mesh-drift-shader';

const VERTEX = `attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

/** Decorative only: the hero image stays in place as the no-WebGL fallback. */
export default function MeshDriftBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let sceneUniform: WebGLUniformLocation | null = null;
    let frame = 0;
    let lastFrame = 0;
    let elapsed = 0;
    let inView = true;
    let disposed = false;

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
    };

    const render = () => {
      if (!program || gl.isContextLost() || !canvas.clientWidth || !canvas.clientHeight) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.uniform4f(sceneUniform, width, height, elapsed * 0.73, 4);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      canvas.dataset.rendered = 'true';
    };

    const tick = (now: number) => {
      frame = 0;
      if (disposed || document.hidden || !inView || motion.matches || !program) return;
      // Limit repaint work while keeping the specified elapsed-time speed.
      if (!lastFrame || now - lastFrame >= 1000 / 30) {
        if (lastFrame) elapsed += Math.min((now - lastFrame) / 1000, 0.1);
        lastFrame = now;
        render();
      }
      frame = requestAnimationFrame(tick);
    };

    const update = () => {
      stop();
      if (!program || disposed || document.hidden || !inView) return;
      render();
      if (!motion.matches) frame = requestAnimationFrame(tick);
    };

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const setup = () => {
      const vertex = compile(gl.VERTEX_SHADER, VERTEX);
      const fragment = compile(gl.FRAGMENT_SHADER, MESH_DRIFT_FRAGMENT);
      if (!vertex || !fragment) {
        if (vertex) gl.deleteShader(vertex);
        if (fragment) gl.deleteShader(fragment);
        return;
      }
      program = gl.createProgram();
      if (!program) { gl.deleteShader(vertex); gl.deleteShader(fragment); return; }
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        program = null;
        return;
      }
      buffer = gl.createBuffer();
      if (!buffer) { gl.deleteProgram(program); program = null; return; }
      gl.useProgram(program);
      sceneUniform = gl.getUniformLocation(program, 'u_scene');
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform3fv(gl.getUniformLocation(program, 'u_colors[0]'), new Float32Array([
        0.063, 0.063, 0.063, 0.961, 0.961, 0.961,
        0.690, 0.690, 0.690, 0.227, 0.227, 0.227,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ]));
      gl.uniform4f(gl.getUniformLocation(program, 'u_shape'), 1.16, 0.34, 0.50, 0);
      gl.uniform4f(gl.getUniformLocation(program, 'u_surface'), 2.40, 1.16, 0, 1);
      gl.uniform4f(gl.getUniformLocation(program, 'u_finish'), 0, 0, 0, 0.09);
      gl.uniform4f(gl.getUniformLocation(program, 'u_transform'), 1453, 0, 0, 0);
      gl.uniform4f(gl.getUniformLocation(program, 'u_space'), 0, 0, 0, 0);
      gl.uniform4f(gl.getUniformLocation(program, 'u_cursor'), 0, 2, 0.65, 0.46);
      update();
    };

    const lost = (event: Event) => {
      event.preventDefault();
      stop();
      program = null;
      buffer = null;
      sceneUniform = null;
      delete canvas.dataset.rendered;
    };
    const restored = () => { if (!disposed) setup(); };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? false;
      update();
    });
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (inView && !document.hidden) render();
    });

    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    document.addEventListener('visibilitychange', update);
    motion.addEventListener('change', update);
    window.addEventListener('resize', update);
    observer?.observe(canvas);
    resizeObserver?.observe(canvas);
    setup();

    return () => {
      disposed = true;
      stop();
      observer?.disconnect();
      resizeObserver?.disconnect();
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      document.removeEventListener('visibilitychange', update);
      motion.removeEventListener('change', update);
      window.removeEventListener('resize', update);
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      delete canvas.dataset.rendered;
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="home-mesh-drift" />;
}
