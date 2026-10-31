import type { QualityLevel } from './params';

export interface QualityProfile {
  level: QualityLevel;
  pixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  shadowLights: number;
  ao: 'none' | 'sao' | 'gtao';
  bloom: boolean;
  rainParticles: number;
  windowRainShader: boolean;
}

export function profileFor(level: QualityLevel): QualityProfile {
  const dpr = window.devicePixelRatio || 1;
  switch (level) {
    case 'low':
      return { level, pixelRatio: 1, shadows: false, shadowMapSize: 0, shadowLights: 0, ao: 'none', bloom: false, rainParticles: 0, windowRainShader: false };
    case 'medium':
      return { level, pixelRatio: Math.min(dpr, 1.5), shadows: true, shadowMapSize: 1024, shadowLights: 1, ao: 'sao', bloom: true, rainParticles: 300, windowRainShader: false };
    case 'high':
      return { level, pixelRatio: Math.min(dpr, 2), shadows: true, shadowMapSize: 2048, shadowLights: 2, ao: 'gtao', bloom: true, rainParticles: 800, windowRainShader: true };
  }
}

/** 기기 자동 판별. 소프트웨어 렌더러·저사양은 낮음, 휴대기기는 보통, 그 외 높음. */
export function detectQuality(gl: WebGL2RenderingContext | WebGLRenderingContext | null): QualityLevel {
  let renderer = '';
  if (gl) {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
  }
  if (/swiftshader|llvmpipe|software|basic render/.test(renderer)) return 'low';
  const cores = navigator.hardwareConcurrency || 4;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 820;
  if (cores <= 2) return 'low';
  if (coarse || small) return 'medium';
  return 'high';
}
