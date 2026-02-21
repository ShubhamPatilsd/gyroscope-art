"use client";

import { useEffect, useRef, useState, useCallback } from "react";

function drawSplat(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  v1: number, v2: number, v3: number, v4: number, v5: number,
  v6: number, v7: number, v8: number, v9: number, v10: number,
  v11: number, v12: number, v13: number, v14: number, v15: number,
  v16: number, v17: number
) {
  const x           = v1 * width;
  const y           = v2 * height;
  const scale       = 10 + v3 * 300;
  const aspectX     = 0.5 + v4 * 2;
  const aspectY     = 0.5 + v5 * 2;
  const rotation    = v6 * Math.PI * 2;
  const skewX       = (v7 - 0.5) * 1.0;
  const skewY       = (v8 - 0.5) * 1.0;
  const n           = 1 + v9 * 9;
  const hue         = v10 * 360;
  const sat         = 40 + v11 * 60;
  const light       = 30 + v12 * 40;
  const opacity     = 0.02 + v13 * 0.4;
  const hue2        = (hue + v14 * 180) % 360;
  const colorStop   = 0.1 + v15 * 0.8;
  const innerRadius = v16 * 0.9;
  const falloff     = 0.5 + v17 * 2;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(aspectX, aspectY);
  ctx.transform(1, skewY, skewX, 1, 0, 0);

  ctx.beginPath();
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const r = scale;
    const px = Math.sign(cos) * Math.pow(Math.abs(cos), 2 / n) * r;
    const py = Math.sign(sin) * Math.pow(Math.abs(sin), 2 / n) * r;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();

  const grad = ctx.createRadialGradient(0, 0, innerRadius * scale, 0, 0, scale);
  grad.addColorStop(0,         `hsla(${hue},  ${sat}%, ${light}%, ${opacity})`);
  grad.addColorStop(colorStop, `hsla(${hue2}, ${sat}%, ${light}%, ${opacity * falloff})`);
  grad.addColorStop(1,         `hsla(${hue2}, ${sat}%, ${light}%, 0)`);

  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

function randomValues(): number[] {
  return Array.from({ length: 17 }, () => Math.random());
}

type ImuState = { x: number; y: number; vx: number; vy: number };

export default function Home() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const initialized  = useRef(false);
  const [open, setOpen] = useState(false);
  const [vals, setVals]  = useState<number[]>(randomValues());
  const valsRef      = useRef(vals);

  // IMU
  const imuRef       = useRef<ImuState>({ x: 0.5, y: 0.5, vx: 0, vy: 0 });
  const imuActive    = useRef(false);
  const [imuEnabled, setImuEnabled] = useState(false);
  const [imuDisplay, setImuDisplay] = useState({ x: 0.5, y: 0.5 });
  const rafRef       = useRef<number | null>(null);
  const lastMotionT  = useRef<number | null>(null);
  const displayTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // keep valsRef in sync without triggering physics
  useEffect(() => { valsRef.current = vals; }, [vals]);

  // canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      if (canvas.width === window.innerWidth && canvas.height === window.innerHeight) return;
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      initialized.current = false;
    };
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || initialized.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    initialized.current = true;
  }, []);

  // --- IMU physics ---
  // Call this with raw acceleration values (m/s²) from any source
  const feedAccel = useCallback((ax: number, ay: number) => {
    const now = performance.now();
    const dt  = lastMotionT.current
      ? Math.min((now - lastMotionT.current) / 1000, 0.05)
      : 0.016;
    lastMotionT.current = now;

    const SENSITIVITY = 0.003;
    const DAMPING = Math.pow(0.88, dt * 60);

    const imu = imuRef.current;
    imu.vx += ax * SENSITIVITY * dt * 60;
    imu.vy -= ay * SENSITIVITY * dt * 60;

    imu.vx *= DAMPING;
    imu.vy *= DAMPING;

    imu.x += imu.vx;
    imu.y += imu.vy;

    if (imu.x < 0) { imu.x = 0;  imu.vx *= -0.4; }
    if (imu.x > 1) { imu.x = 1;  imu.vx *= -0.4; }
    if (imu.y < 0) { imu.y = 0;  imu.vy *= -0.4; }
    if (imu.y > 1) { imu.y = 1;  imu.vy *= -0.4; }
  }, []);

  // --- rAF draw loop (IMU mode) ---
  // stored in ref so the loop can re-schedule itself stably
  const loopRef = useRef<() => void>(() => {});
  useEffect(() => {
    loopRef.current = () => {
      if (!imuActive.current) return;
      const canvas = canvasRef.current;
      const ctx    = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      initCanvas();
      const { x, y } = imuRef.current;
      const v = valsRef.current;
      drawSplat(ctx, canvas.width, canvas.height,
        x, y, v[2], v[3], v[4], v[5], v[6], v[7], v[8],
        v[9], v[10], v[11], v[12], v[13], v[14], v[15], v[16]
      );
      rafRef.current = requestAnimationFrame(loopRef.current);
    };
  });

  const startImu = useCallback(() => {
    imuRef.current      = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
    lastMotionT.current = null;
    imuActive.current   = true;

    rafRef.current = requestAnimationFrame(loopRef.current);

    displayTimer.current = setInterval(() => {
      const { x, y } = imuRef.current;
      setImuDisplay({ x, y });
    }, 80);

    setImuEnabled(true);
  }, []);

  const stopImu = useCallback(() => {
    imuActive.current = false;
    if (rafRef.current)       cancelAnimationFrame(rafRef.current);
    if (displayTimer.current) clearInterval(displayTimer.current);
    setImuEnabled(false);
  }, []);

  useEffect(() => stopImu, [stopImu]);

  // --- manual draw ---
  const initAndDraw = (v: number[]) => {
    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    initCanvas();
    const [v1,v2,v3,v4,v5,v6,v7,v8,v9,v10,v11,v12,v13,v14,v15,v16,v17] = v;
    drawSplat(ctx, canvas.width, canvas.height,
      v1,v2,v3,v4,v5,v6,v7,v8,v9,v10,v11,v12,v13,v14,v15,v16,v17);
  };

  const handleDraw       = () => initAndDraw(vals);
  const handleRandomize  = () => setVals(randomValues());
  const handleRandomDraw = () => { const n = randomValues(); setVals(n); initAndDraw(n); };

  const labels = [
    "x","y","scale","aspect x","aspect y","rotation",
    "skew x","skew y","shape (n)","hue","saturation",
    "lightness","opacity","hue 2","color stop","inner radius","falloff",
  ];

  return (
    <>
      <canvas ref={canvasRef} className="block" />

      {/* open/close button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white text-xl flex items-center justify-center hover:bg-white/20 transition-colors"
      >
        {open ? "×" : "+"}
      </button>

      {/* popup */}
      {open && (
        <div className="fixed bottom-22 right-6 z-50 w-80 rounded-2xl bg-zinc-900/90 backdrop-blur border border-white/10 p-5 flex flex-col gap-4 text-white shadow-2xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-300 tracking-wide">Splat Generator</p>

            {/* IMU toggle */}
            <button
              onClick={imuEnabled ? stopImu : startImu}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                imuEnabled
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${imuEnabled ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
              IMU
            </button>
          </div>

          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
            {vals.map((v, i) => {
              const isImuControlled = imuEnabled && i < 2;
              const displayVal = isImuControlled
                ? (i === 0 ? imuDisplay.x : imuDisplay.y)
                : v;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className={`w-24 text-xs shrink-0 ${isImuControlled ? "text-emerald-400" : "text-zinc-400"}`}>
                    {labels[i]}
                  </span>
                  <input
                    type="range"
                    min={0} max={1} step={0.001}
                    value={displayVal}
                    disabled={isImuControlled}
                    onChange={e => {
                      if (isImuControlled) return;
                      const next = [...vals];
                      next[i] = parseFloat(e.target.value);
                      setVals(next);
                    }}
                    className={`flex-1 h-1 ${isImuControlled ? "accent-emerald-400 opacity-60" : "accent-white"}`}
                  />
                  <span className="w-8 text-right text-xs text-zinc-500">
                    {displayVal.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* manual controls — hidden while IMU is running */}
          {!imuEnabled && (
            <>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleRandomize}
                  className="flex-1 rounded-lg border border-white/15 py-2 text-xs text-zinc-300 hover:bg-white/10 transition-colors"
                >
                  Randomize
                </button>
                <button
                  onClick={handleDraw}
                  className="flex-1 rounded-lg bg-white py-2 text-xs text-black font-medium hover:bg-zinc-200 transition-colors"
                >
                  Draw
                </button>
              </div>
              <button
                onClick={handleRandomDraw}
                className="rounded-lg border border-white/15 py-2 text-xs text-zinc-300 hover:bg-white/10 transition-colors"
              >
                Random + Draw
              </button>
            </>
          )}

          {imuEnabled && (
            <p className="text-center text-xs text-zinc-500">
              Tilt device to paint · splats draw continuously
            </p>
          )}
        </div>
      )}
    </>
  );
}
