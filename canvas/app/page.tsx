"use client";
import { useEffect, useRef } from "react";

// ======================== CONFIG ========================

const SIM_RES = 256;
const DYE_RES = 1024;
const PRESSURE_ITERS = 20;
const CURL_STRENGTH = 30;
const SPLAT_RADIUS = 0.0025;
const SPLAT_FORCE = 6000;
const VEL_DISSIPATION = 0.2;
const DYE_DISSIPATION = 0.4;
const PRESSURE_DISSIPATION = 0.8;

// ======================== SHADERS ========================

const VS = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const CLEAR_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uValue;
out vec4 fragColor;
void main() {
  fragColor = uValue * texture(uTex, vUv);
}`;

const SPLAT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uAspect;
uniform vec2 uPoint;
uniform vec3 uColor;
uniform float uRadius;
out vec4 fragColor;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
  fragColor = vec4(texture(uTex, vUv).rgb + splat, 1.0);
}`;

const ADVECT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVel;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uDt;
uniform float uDiss;
out vec4 fragColor;
void main() {
  vec2 coord = vUv - uDt * texture(uVel, vUv).xy * uTexel;
  fragColor = uDiss * texture(uSource, coord);
}`;

const DIVERGENCE_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uVel;
uniform vec2 uTexel;
out vec4 fragColor;
void main() {
  float L = texture(uVel, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uVel, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uVel, vUv + vec2(0.0, uTexel.y)).y;
  float B = texture(uVel, vUv - vec2(0.0, uTexel.y)).y;
  fragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const CURL_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uVel;
uniform vec2 uTexel;
out vec4 fragColor;
void main() {
  float L = texture(uVel, vUv - vec2(uTexel.x, 0.0)).y;
  float R = texture(uVel, vUv + vec2(uTexel.x, 0.0)).y;
  float T = texture(uVel, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture(uVel, vUv - vec2(0.0, uTexel.y)).x;
  fragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

const VORTICITY_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVel;
uniform sampler2D uCurl;
uniform vec2 uTexel;
uniform float uCurlStr;
uniform float uDt;
out vec4 fragColor;
void main() {
  float L = texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uCurl, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture(uCurl, vUv - vec2(0.0, uTexel.y)).x;
  float C = texture(uCurl, vUv).x;
  vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  f /= length(f) + 1e-4;
  f *= uCurlStr * C;
  f.y *= -1.0;
  fragColor = vec4(texture(uVel, vUv).xy + f * uDt, 0.0, 1.0);
}`;

const PRESSURE_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uPres;
uniform sampler2D uDiv;
uniform vec2 uTexel;
out vec4 fragColor;
void main() {
  float L = texture(uPres, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPres, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uPres, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture(uPres, vUv - vec2(0.0, uTexel.y)).x;
  float d = texture(uDiv, vUv).x;
  fragColor = vec4((L + R + T + B - d) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uPres;
uniform sampler2D uVel;
uniform vec2 uTexel;
out vec4 fragColor;
void main() {
  float L = texture(uPres, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPres, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uPres, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture(uPres, vUv - vec2(0.0, uTexel.y)).x;
  fragColor = vec4(texture(uVel, vUv).xy - vec2(R - L, T - B), 0.0, 1.0);
}`;

const DISPLAY_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uSaturation;
out vec4 fragColor;
void main() {
  vec3 c = texture(uTex, vUv).rgb;
  float grey = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(grey), c, uSaturation);
  fragColor = vec4(c, 1.0);
}`;

// ======================== HELPERS ========================

type FBO = {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
  attach: (unit: number) => number;
};

type DoubleFBO = {
  width: number;
  height: number;
  texelX: number;
  texelY: number;
  read: FBO;
  write: FBO;
  swap: () => void;
};

type Prog = {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation>;
  bind: () => void;
};

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) || "shader compile error");
  return s;
}

function makeProg(gl: WebGL2RenderingContext, vsSource: string, fsSource: string): Prog {
  const p = gl.createProgram()!;
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vsSource));
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p) || "link error");

  const uniforms: Record<string, WebGLUniformLocation> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i)!;
    uniforms[info.name] = gl.getUniformLocation(p, info.name)!;
  }
  return { program: p, uniforms, bind: () => gl.useProgram(p) };
}

function makeFBO(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  internalFmt: number,
  fmt: number,
  type: number,
  filter: number
): FBO {
  const texture = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFmt, w, h, 0, fmt, type, null);

  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    texture,
    fbo,
    width: w,
    height: h,
    attach(unit: number) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      return unit;
    },
  };
}

function makeDoubleFBO(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  internalFmt: number,
  fmt: number,
  type: number,
  filter: number
): DoubleFBO {
  let fbo1 = makeFBO(gl, w, h, internalFmt, fmt, type, filter);
  let fbo2 = makeFBO(gl, w, h, internalFmt, fmt, type, filter);
  return {
    width: w,
    height: h,
    texelX: 1 / w,
    texelY: 1 / h,
    get read() { return fbo1; },
    get write() { return fbo2; },
    swap() { [fbo1, fbo2] = [fbo2, fbo1]; },
  };
}

function getRes(gl: WebGL2RenderingContext, res: number) {
  const aspect = gl.canvas.width / gl.canvas.height;
  return aspect > 1
    ? { w: Math.round(res * aspect), h: res }
    : { w: res, h: Math.round(res / aspect) };
}

function hslToRgb(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: r + m, g: g + m, b: b + m };
}

// ======================== COMPONENT ========================

// ======================== PARTICLES ========================

type Splat = { x: number; y: number; dx: number; dy: number; color: { r: number; g: number; b: number } };

type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  hue: number;
};

function spawnBurst(
  particles: Particle[],
  cx: number, cy: number,
  count: number, speed: number, hue: number
) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    const maxLife = 1.5 + Math.random() * 2;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: maxLife, maxLife,
      size: 2 + Math.random() * 4,
      hue,
    });
  }
}

function updateParticles(particles: Particle[], dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  w: number, h: number
) {
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  for (const p of particles) {
    const t = p.life / p.maxLife;
    const alpha = t * t;
    const r = p.size * (1 + (1 - t) * 2);
    const px = p.x * w;
    const py = (1 - p.y) * h;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
    grad.addColorStop(0, `hsla(${p.hue}, 80%, 90%, ${alpha})`);
    grad.addColorStop(0.4, `hsla(${p.hue}, 90%, 60%, ${alpha * 0.5})`);
    grad.addColorStop(1, `hsla(${p.hue}, 100%, 40%, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }
}

// ======================== COMPONENT ========================

export default function Home() {
  const canvasRef          = useRef<HTMLCanvasElement>(null);
  const particleCanvasRef  = useRef<HTMLCanvasElement>(null);
  const agentSplatQueueRef = useRef<Splat[]>([]);
  const agentTargetSatRef  = useRef(1.0);
  const narrativeRef       = useRef("");
  const pendingRef         = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const gl = canvas.getContext("webgl2")!;
    if (!gl) { alert("WebGL2 not supported"); return; }
    gl.getExtension("EXT_color_buffer_float");

    // --- vertex buffer (full-screen quad) ---
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    // --- compile programs ---
    const progs = {
      clear: makeProg(gl, VS, CLEAR_FS),
      splat: makeProg(gl, VS, SPLAT_FS),
      advection: makeProg(gl, VS, ADVECT_FS),
      divergence: makeProg(gl, VS, DIVERGENCE_FS),
      curl: makeProg(gl, VS, CURL_FS),
      vorticity: makeProg(gl, VS, VORTICITY_FS),
      pressure: makeProg(gl, VS, PRESSURE_FS),
      gradient: makeProg(gl, VS, GRADIENT_FS),
      display: makeProg(gl, VS, DISPLAY_FS),
    };

    // --- create FBOs ---
    const simRes = getRes(gl, SIM_RES);
    const dyeRes = getRes(gl, DYE_RES);
    const halfFloat = gl.HALF_FLOAT;
    const rgba16f = gl.RGBA16F;
    const rgba = gl.RGBA;
    const linear = gl.LINEAR;

    const velocity = makeDoubleFBO(gl, simRes.w, simRes.h, rgba16f, rgba, halfFloat, linear);
    const dye = makeDoubleFBO(gl, dyeRes.w, dyeRes.h, rgba16f, rgba, halfFloat, linear);
    const pressure = makeDoubleFBO(gl, simRes.w, simRes.h, rgba16f, rgba, halfFloat, linear);
    const divergenceFBO = makeFBO(gl, simRes.w, simRes.h, rgba16f, rgba, halfFloat, linear);
    const curlFBO = makeFBO(gl, simRes.w, simRes.h, rgba16f, rgba, halfFloat, linear);

    // --- blit helper ---
    function blit(target: FBO | null) {
      if (target) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        gl.viewport(0, 0, target.width, target.height);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // --- pointer state ---
    let prevX = 0, prevY = 0;
    let splatQueue: { x: number; y: number; dx: number; dy: number; color: { r: number; g: number; b: number } }[] = [];
    let hue = Math.random() * 360;

    // --- cursor / paint tracking ---
    let lastCursorMove = performance.now();
    let saturation = 1.0; // current (lerped toward agentTargetSatRef)
    const MOVE_DEADZONE = 0.008; // UV units — ignores tiny jitter (~8px on 1080p)
    let paintCount    = 0;
    let paintMovement = 0;

    function updatePointer(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = 1.0 - (clientY - rect.top) / rect.height;
      const dx = (clientX - prevX) / rect.width;
      const dy = -(clientY - prevY) / rect.height;
      prevX = clientX;
      prevY = clientY;

      hue = (hue + 3) % 360;
      const color = hslToRgb(hue, 1, 0.5);
      splatQueue.push({ x, y, dx: dx * SPLAT_FORCE, dy: dy * SPLAT_FORCE, color });

      // only count as real movement if above dead zone
      if (Math.abs(dx) > MOVE_DEADZONE || Math.abs(dy) > MOVE_DEADZONE) {
        lastCursorMove = performance.now();
        agentTargetSatRef.current = 1.0; // user is active — restore color
        paintCount++;
        paintMovement += Math.sqrt(dx * dx + dy * dy);
      }
    }

    const onMouseMove = (e: MouseEvent) => updatePointer(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      updatePointer(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      prevX = e.touches[0].clientX;
      prevY = e.touches[0].clientY;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: false });

    // --- agent: every 2s, send paint stats to Claude, apply response ---
    const disturberInterval = setInterval(async () => {
      if (pendingRef.current) return;
      const idleSec  = (performance.now() - lastCursorMove) / 1000;
      const count    = paintCount;
      const movement = paintMovement;
      paintCount    = 0;
      paintMovement = 0;

      if (count === 0 && idleSec < 2) return; // nothing interesting yet

      pendingRef.current = true;
      try {
        const res = await fetch("/api/disturber", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            splatCount:        count,
            totalMovement:     +movement.toFixed(3),
            idleSec:           +idleSec.toFixed(1),
            currentSaturation: +saturation.toFixed(3),
            currentHue:        Math.round(hue),
            narrative:         narrativeRef.current,
          }),
        });
        const data = await res.json();
        if (data.narrativeUpdate) narrativeRef.current = data.narrativeUpdate;
        for (const d of (data.disturbances ?? [])) {
          if (d.action === "add_splats") {
            for (let i = 0; i < (d.count ?? 3); i++) {
              agentSplatQueueRef.current.push({
                x: Math.random(), y: Math.random(),
                dx: (Math.random() - 0.5) * 1000,
                dy: (Math.random() - 0.5) * 1000,
                color: hslToRgb(Math.random() * 360, 1, 0.5),
              });
            }
          } else if (d.action === "set_saturation") {
            agentTargetSatRef.current = d.value;
          }
        }
      } catch (err) {
        console.error("Agent error:", err);
      } finally {
        pendingRef.current = false;
      }
    }, 2000);

    // --- splat function ---
    function doSplat(x: number, y: number, dx: number, dy: number, color: { r: number; g: number; b: number }) {
      const p = progs.splat;
      const aspect = canvas.width / canvas.height;

      // velocity splat
      p.bind();
      gl.uniform1i(p.uniforms.uTex, velocity.read.attach(0));
      gl.uniform1f(p.uniforms.uAspect, aspect);
      gl.uniform2f(p.uniforms.uPoint, x, y);
      gl.uniform3f(p.uniforms.uColor, dx, dy, 0);
      gl.uniform1f(p.uniforms.uRadius, SPLAT_RADIUS);
      blit(velocity.write);
      velocity.swap();

      // dye splat
      gl.uniform1i(p.uniforms.uTex, dye.read.attach(0));
      gl.uniform3f(p.uniforms.uColor, color.r * 0.3, color.g * 0.3, color.b * 0.3);
      blit(dye.write);
      dye.swap();
    }

    // --- random initial splats ---
    function randomSplats(n: number) {
      for (let i = 0; i < n; i++) {
        const c = hslToRgb(Math.random() * 360, 1, 0.5);
        doSplat(
          Math.random(), Math.random(),
          (Math.random() - 0.5) * 1000, (Math.random() - 0.5) * 1000,
          c
        );
      }
    }

    randomSplats(Math.floor(Math.random() * 5) + 5);

    // --- particle overlay ---
    const pCanvas = particleCanvasRef.current!;
    pCanvas.width = window.innerWidth;
    pCanvas.height = window.innerHeight;
    const pCtx = pCanvas.getContext("2d")!;
    const particles: Particle[] = [];

    // --- keyboard → splats + particles ---
    const keyTimes: number[] = [];
    let keyHue = Math.random() * 360;

    function getTypingSpeed() {
      const now = performance.now();
      // keep only last 2 seconds
      while (keyTimes.length > 0 && now - keyTimes[0] > 2000) keyTimes.shift();
      return keyTimes.length / 2; // keys per second
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      const now = performance.now();
      keyTimes.push(now);
      const speed = getTypingSpeed();

      // intensity scales with typing speed: 1-15 kps
      const intensity = Math.min(speed / 10, 1);
      const particleCount = Math.floor(8 + intensity * 40);
      const particleSpeed = 0.05 + intensity * 0.25;
      const splatForce = 500 + intensity * 4000;

      // random position on canvas
      const x = 0.15 + Math.random() * 0.7;
      const y = 0.15 + Math.random() * 0.7;

      // cycle hue faster with typing speed
      keyHue = (keyHue + 15 + speed * 8) % 360;
      const color = hslToRgb(keyHue, 1, 0.5);

      // fluid splat
      const angle = Math.random() * Math.PI * 2;
      doSplat(
        x, y,
        Math.cos(angle) * splatForce,
        Math.sin(angle) * splatForce,
        color
      );

      // particle burst
      spawnBurst(particles, x, y, particleCount, particleSpeed, keyHue);

      // keyboard counts as activity → restore color
      lastCursorMove = performance.now();
      agentTargetSatRef.current = 1.0;
    }

    window.addEventListener("keydown", onKeyDown);

    // --- simulation step ---
    function step(dt: number) {
      const tx = velocity.texelX;
      const ty = velocity.texelY;

      // 1. Curl
      progs.curl.bind();
      gl.uniform2f(progs.curl.uniforms.uTexel, tx, ty);
      gl.uniform1i(progs.curl.uniforms.uVel, velocity.read.attach(0));
      blit(curlFBO);

      // 2. Vorticity confinement
      progs.vorticity.bind();
      gl.uniform2f(progs.vorticity.uniforms.uTexel, tx, ty);
      gl.uniform1i(progs.vorticity.uniforms.uVel, velocity.read.attach(0));
      gl.uniform1i(progs.vorticity.uniforms.uCurl, curlFBO.attach(1));
      gl.uniform1f(progs.vorticity.uniforms.uCurlStr, CURL_STRENGTH);
      gl.uniform1f(progs.vorticity.uniforms.uDt, dt);
      blit(velocity.write);
      velocity.swap();

      // 3. Advect velocity
      progs.advection.bind();
      gl.uniform2f(progs.advection.uniforms.uTexel, tx, ty);
      gl.uniform1i(progs.advection.uniforms.uVel, velocity.read.attach(0));
      gl.uniform1i(progs.advection.uniforms.uSource, velocity.read.attach(0));
      gl.uniform1f(progs.advection.uniforms.uDt, dt);
      gl.uniform1f(progs.advection.uniforms.uDiss, 1.0 / (1.0 + dt * VEL_DISSIPATION));
      blit(velocity.write);
      velocity.swap();

      // 4. Advect dye
      gl.uniform1i(progs.advection.uniforms.uVel, velocity.read.attach(0));
      gl.uniform1i(progs.advection.uniforms.uSource, dye.read.attach(1));
      gl.uniform1f(progs.advection.uniforms.uDiss, 1.0 / (1.0 + dt * DYE_DISSIPATION));
      blit(dye.write);
      dye.swap();

      // 5. Divergence
      progs.divergence.bind();
      gl.uniform2f(progs.divergence.uniforms.uTexel, tx, ty);
      gl.uniform1i(progs.divergence.uniforms.uVel, velocity.read.attach(0));
      blit(divergenceFBO);

      // 6. Clear/dissipate pressure
      progs.clear.bind();
      gl.uniform1i(progs.clear.uniforms.uTex, pressure.read.attach(0));
      gl.uniform1f(progs.clear.uniforms.uValue, PRESSURE_DISSIPATION);
      blit(pressure.write);
      pressure.swap();

      // 7. Pressure solve (Jacobi)
      progs.pressure.bind();
      gl.uniform2f(progs.pressure.uniforms.uTexel, tx, ty);
      gl.uniform1i(progs.pressure.uniforms.uDiv, divergenceFBO.attach(1));
      for (let i = 0; i < PRESSURE_ITERS; i++) {
        gl.uniform1i(progs.pressure.uniforms.uPres, pressure.read.attach(0));
        blit(pressure.write);
        pressure.swap();
      }

      // 8. Gradient subtract
      progs.gradient.bind();
      gl.uniform2f(progs.gradient.uniforms.uTexel, tx, ty);
      gl.uniform1i(progs.gradient.uniforms.uPres, pressure.read.attach(0));
      gl.uniform1i(progs.gradient.uniforms.uVel, velocity.read.attach(1));
      blit(velocity.write);
      velocity.swap();
    }

    // --- animation loop ---
    let lastTime = performance.now();
    let animId: number;

    function loop() {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 1 / 60);
      lastTime = now;

      // process queued splats
      for (const s of splatQueue) {
        doSplat(s.x, s.y, s.dx, s.dy, s.color);
      }
      splatQueue = [];

      // drain agent splat queue into simulation
      for (const s of agentSplatQueueRef.current.splice(0)) {
        doSplat(s.x, s.y, s.dx, s.dy, s.color);
      }

      // lerp saturation toward agent's target
      const target = agentTargetSatRef.current;
      const lerpSpeed = target < saturation ? 0.8 : 6.0;
      saturation += (target - saturation) * Math.min(dt * lerpSpeed, 1);

      step(dt);

      // display
      progs.display.bind();
      gl.uniform1i(progs.display.uniforms.uTex, dye.read.attach(0));
      gl.uniform1f(progs.display.uniforms.uSaturation, saturation);
      blit(null);

      // --- particles ---
      updateParticles(particles, dt);
      drawParticles(pCtx, particles, pCanvas.width, pCanvas.height);

      animId = requestAnimationFrame(loop);
    }

    loop();

    // --- resize ---
    function onResize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      pCanvas.width = window.innerWidth;
      pCanvas.height = window.innerHeight;
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(disturberInterval);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchstart", onTouchStart);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-screen h-screen"
        style={{ cursor: "crosshair" }}
      />
      <canvas
        ref={particleCanvasRef}
        className="fixed inset-0 w-screen h-screen pointer-events-none"
      />
    </>
  );
}
