import { Injectable, signal } from '@angular/core';

export type WeatherTheme =
  | 'sunlight'
  | 'rain'
  | 'toxic-spores'
  | 'blizzard'
  | 'crypt-mist'
  | 'volcano-fire'
  | 'colosseum-glory';

@Injectable({ providedIn: 'root' })
export class WeatherShaderService {
  public readonly activeTheme = signal<WeatherTheme>('sunlight');

  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private animId: number | null = null;
  private startTime = 0;
  private lastTime = 0;
  private lightningIntensity = 0;

  // Shader program & uniform locations (when WebGL is supported)
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uTimeLoc: WebGLUniformLocation | null = null;
  private uThemeLoc: WebGLUniformLocation | null = null;
  private uLightningLoc: WebGLUniformLocation | null = null;

  // 2D particle fallback pool
  private particles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    color: string;
    life: number;
    maxLife: number;
  }[] = [];

  public attach(canvas: HTMLCanvasElement): void {
    this.detach();
    this.canvas = canvas;

    // Attempt WebGL first, fallback to 2D
    try {
      this.gl = (canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl')) as
        WebGLRenderingContext | WebGL2RenderingContext | null;
    } catch {
      this.gl = null;
    }

    if (this.gl) {
      this.initWebGL();
    } else {
      try {
        this.ctx2d = canvas.getContext('2d');
      } catch {
        this.ctx2d = null;
      }
    }

    this.initParticles();
    this.startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.lastTime = this.startTime;
    this.startLoop();
  }

  public detach(): void {
    if (this.animId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
      this.program = null;
    }
    if (this.gl && this.positionBuffer) {
      this.gl.deleteBuffer(this.positionBuffer);
      this.positionBuffer = null;
    }
    this.gl = null;
    this.ctx2d = null;
    this.canvas = null;
    this.particles = [];
  }

  public setTheme(theme: WeatherTheme): void {
    this.activeTheme.set(theme);
    this.initParticles();
  }

  public triggerLightning(): void {
    this.lightningIntensity = 1.0;
  }

  private initWebGL(): void {
    const gl = this.gl;
    if (!gl) return;

    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = (a_position + 1.0) * 0.5;
        // Flip Y for standard screen coordinates
        v_uv.y = 1.0 - v_uv.y;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Multi-weather procedural shader with noise, volumetric rays, fire embers, rain, and snow
    const fsSource = `
      precision mediump float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform int u_theme;
      uniform float u_lightning;
      varying vec2 v_uv;

      // Hash and Simplex-style pseudo noise
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec2 uv = v_uv;
        vec4 col = vec4(0.0);

        // 1. RAIN & DUSK STORM (u_theme == 1)
        if (u_theme == 1) {
          vec2 rainUv = uv * vec2(45.0, 8.0);
          rainUv.x += u_time * 6.0;
          rainUv.y += u_time * 26.0;
          float r = hash(floor(rainUv));
          if (r > 0.88) {
            float streak = smoothstep(0.0, 0.15, fract(rainUv.y)) * smoothstep(1.0, 0.85, fract(rainUv.y));
            col += vec4(0.65, 0.85, 1.0, 0.42 * streak);
          }
          // Ground splash ripples
          if (uv.y > 0.65) {
            float ripple = sin(u_time * 8.0 + uv.x * 60.0) * cos(u_time * 8.0 + uv.y * 60.0);
            col += vec4(0.5, 0.75, 1.0, max(0.0, ripple * 0.08));
          }
          // Ambient mist
          float mist = noise(uv * 3.0 + vec2(u_time * 0.15, 0.0)) * 0.12;
          col += vec4(0.25, 0.35, 0.45, mist);
          // Lightning flash
          if (u_lightning > 0.01) {
            col += vec4(0.85, 0.95, 1.0, u_lightning * 0.45);
          }
        }
        // 2. TOXIC SLIME SPORES (u_theme == 2)
        else if (u_theme == 2) {
          float mist = noise(uv * 4.0 + vec2(u_time * 0.2, -u_time * 0.1)) * 0.18;
          col += vec4(0.2, 0.85, 0.3, mist);
          // Rising bioluminescent spore clusters
          vec2 sporeUv = uv * vec2(28.0, 20.0) + vec2(sin(u_time * 0.8 + uv.y * 4.0), -u_time * 1.5);
          float s = hash(floor(sporeUv));
          if (s > 0.92) {
            float dist = length(fract(sporeUv) - 0.5);
            float glow = smoothstep(0.35, 0.0, dist);
            float pulse = 0.5 + 0.5 * sin(u_time * 4.0 + s * 20.0);
            col += vec4(0.4, 1.0, 0.35, glow * pulse * 0.6);
          }
        }
        // 3. MOUNTAIN BLIZZARD (u_theme == 3)
        else if (u_theme == 3) {
          vec2 snowUv = uv * vec2(35.0, 25.0);
          snowUv.x += u_time * 8.0 + sin(u_time * 1.5 + uv.y * 3.0) * 2.0;
          snowUv.y += u_time * 12.0;
          float s = hash(floor(snowUv));
          if (s > 0.86) {
            float dist = length(fract(snowUv) - 0.5);
            float flake = smoothstep(0.35, 0.0, dist);
            col += vec4(0.9, 0.96, 1.0, flake * 0.65);
          }
          // Frosty edge vignette
          float vig = smoothstep(0.2, 0.95, length(uv - 0.5) * 1.2);
          col += vec4(0.65, 0.85, 1.0, vig * 0.16);
        }
        // 4. CRYPT SOUL MIST (u_theme == 4)
        else if (u_theme == 4) {
          float fog = noise(uv * 3.5 + vec2(u_time * 0.1, u_time * 0.05)) * 0.15;
          col += vec4(0.45, 0.2, 0.7, fog);
          // Floating soul wisps
          vec2 wispUv = uv * vec2(20.0, 16.0) + vec2(cos(u_time + uv.y * 2.0), -u_time * 1.2);
          float w = hash(floor(wispUv));
          if (w > 0.93) {
            float d = length(fract(wispUv) - 0.5);
            col += vec4(0.75, 0.45, 1.0, smoothstep(0.4, 0.0, d) * 0.55);
          }
        }
        // 5. VOLCANO HELLFIRE & EMBERS (u_theme == 5)
        else if (u_theme == 5) {
          // Bottom lava heat haze
          float heat = max(0.0, (uv.y - 0.45) / 0.55) * 0.22;
          float flicker = 0.85 + 0.15 * sin(u_time * 7.0 + uv.x * 12.0);
          col += vec4(1.0, 0.32, 0.05, heat * flicker);
          // Rising fiery embers
          vec2 emberUv = uv * vec2(30.0, 22.0) + vec2(sin(u_time * 2.0 + uv.y * 5.0) * 1.5, -u_time * 4.5);
          float e = hash(floor(emberUv));
          if (e > 0.89) {
            float dist = length(fract(emberUv) - 0.5);
            float spark = smoothstep(0.3, 0.0, dist);
            vec3 emberCol = mix(vec3(1.0, 0.85, 0.2), vec3(1.0, 0.2, 0.05), fract(e * 7.0));
            col += vec4(emberCol, spark * 0.85);
          }
        }
        // 6. COLOSSEUM GLORY / SUNLIGHT (u_theme == 6 or 0)
        else {
          // Angled volumetric light shafts
          float ray = sin((uv.x * 2.5 - uv.y) * 9.0 + u_time * 0.35) * 0.5 + 0.5;
          ray = pow(ray, 3.0) * (1.0 - uv.y * 0.65) * 0.16;
          col += vec4(1.0, 0.92, 0.65, ray);
          // Floating golden dust motes
          vec2 moteUv = uv * vec2(26.0, 20.0) + vec2(cos(u_time * 0.4 + uv.y * 3.0), -u_time * 0.8);
          float m = hash(floor(moteUv));
          if (m > 0.91) {
            float dist = length(fract(moteUv) - 0.5);
            float glint = smoothstep(0.3, 0.0, dist) * (0.6 + 0.4 * sin(u_time * 3.0 + m * 15.0));
            col += vec4(1.0, 0.88, 0.35, glint * 0.55);
          }
        }

        gl_FragColor = col;
      }
    `;

    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;

    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('Weather WebGL link failed:', gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      return;
    }

    this.program = prog;
    this.uResolutionLoc = gl.getUniformLocation(prog, 'u_resolution');
    this.uTimeLoc = gl.getUniformLocation(prog, 'u_time');
    this.uThemeLoc = gl.getUniformLocation(prog, 'u_theme');
    this.uLightningLoc = gl.getUniformLocation(prog, 'u_lightning');

    const posLoc = gl.getAttribLocation(prog, 'a_position');
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // Two triangles covering screen
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    this.positionBuffer = buf;
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private compileShader(type: number, src: string): WebGLShader | null {
    const gl = this.gl;
    if (!gl) return null;
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('Weather Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private initParticles(): void {
    const theme = this.activeTheme();
    const count = theme === 'rain' ? 80 : theme === 'blizzard' ? 65 : 45;
    this.particles = [];

    const colors: Record<WeatherTheme, string[]> = {
      sunlight: ['rgba(254, 240, 138, 0.7)', 'rgba(251, 191, 36, 0.6)'],
      rain: ['rgba(147, 197, 253, 0.75)', 'rgba(191, 219, 254, 0.6)'],
      'toxic-spores': ['rgba(132, 204, 22, 0.8)', 'rgba(74, 222, 128, 0.7)'],
      blizzard: ['rgba(255, 255, 255, 0.85)', 'rgba(224, 242, 254, 0.7)'],
      'crypt-mist': ['rgba(192, 132, 252, 0.7)', 'rgba(147, 51, 234, 0.5)'],
      'volcano-fire': [
        'rgba(249, 115, 22, 0.85)',
        'rgba(239, 68, 68, 0.75)',
        'rgba(253, 224, 71, 0.9)',
      ],
      'colosseum-glory': ['rgba(250, 204, 21, 0.8)', 'rgba(253, 224, 71, 0.65)'],
    };

    const palette = colors[theme] ?? colors.sunlight;

    for (let i = 0; i < count; i++) {
      const pColor = palette[i % palette.length];
      this.particles.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        vx: theme === 'rain' ? 6 + Math.random() * 5 : (Math.random() - 0.5) * 4,
        vy:
          theme === 'rain'
            ? 45 + Math.random() * 30
            : theme === 'volcano-fire'
              ? -(8 + Math.random() * 12)
              : 3 + Math.random() * 6,
        size: theme === 'rain' ? 1.5 : 2 + Math.random() * 3,
        alpha: 0.3 + Math.random() * 0.6,
        color: pColor,
        life: Math.random() * 4,
        maxLife: 3 + Math.random() * 3,
      });
    }
  }

  private startLoop(): void {
    const loop = (now: number): void => {
      const dt = Math.min(0.1, (now - this.lastTime) / 1000);
      this.lastTime = now;
      const elapsed = (now - this.startTime) / 1000;

      if (this.lightningIntensity > 0) {
        this.lightningIntensity = Math.max(0, this.lightningIntensity - dt * 2.8);
      }

      this.render(elapsed, dt);

      if (this.canvas && typeof window !== 'undefined') {
        this.animId = window.requestAnimationFrame(loop);
      }
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      this.animId = window.requestAnimationFrame(loop);
    }
  }

  private render(elapsed: number, dt: number): void {
    const canvas = this.canvas;
    if (!canvas) return;

    // Check size & resize if needed
    const rect = canvas.getBoundingClientRect();
    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
    const targetW = Math.max(1, Math.round(rect.width * dpr));
    const targetH = Math.max(1, Math.round(rect.height * dpr));

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    // 1. If WebGL program is active, render fragment shader
    if (this.gl && this.program) {
      const gl = this.gl;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(this.program);
      if (this.uResolutionLoc) gl.uniform2f(this.uResolutionLoc, canvas.width, canvas.height);
      if (this.uTimeLoc) gl.uniform1f(this.uTimeLoc, elapsed);
      if (this.uLightningLoc) gl.uniform1f(this.uLightningLoc, this.lightningIntensity);

      const themeCodes: Record<WeatherTheme, number> = {
        sunlight: 0,
        rain: 1,
        'toxic-spores': 2,
        blizzard: 3,
        'crypt-mist': 4,
        'volcano-fire': 5,
        'colosseum-glory': 6,
      };
      if (this.uThemeLoc) {
        gl.uniform1i(this.uThemeLoc, themeCodes[this.activeTheme()] ?? 0);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return;
    }

    // 2. Canvas 2D fallback when WebGL is absent
    const ctx = this.ctx2d;
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const theme = this.activeTheme();

    // Draw ambient lightning flash
    if (this.lightningIntensity > 0) {
      ctx.fillStyle = `rgba(224, 242, 254, ${this.lightningIntensity * 0.4})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Update and draw particles
    const cw = canvas.width;
    const ch = canvas.height;

    for (const p of this.particles) {
      p.x += (p.vx * dt * 100) / (cw > 0 ? cw : 100);
      p.y += (p.vy * dt * 100) / (ch > 0 ? ch : 100);
      p.life += dt;

      if (p.y > 105) p.y = -5;
      if (p.y < -5) p.y = 105;
      if (p.x > 105) p.x = -5;
      if (p.x < -5) p.x = 105;

      const px = (p.x / 100) * cw;
      const py = (p.y / 100) * ch;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (theme === 'rain') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + 4, py + 12);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
