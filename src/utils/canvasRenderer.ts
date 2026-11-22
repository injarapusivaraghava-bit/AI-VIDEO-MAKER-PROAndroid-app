import {
  APP_LOGO_URL,
  AspectRatio,
  CartoonCharacter,
  SceneFilter,
  SceneItem,
  SubtitleStyle,
  VideoProject,
  VideoQuality,
} from '../types/studio';
import { decodeWavBase64, scheduleProceduralMusic, scheduleSfx } from './audioEngine';

export function getCanvasDimensions(
  aspectRatio: AspectRatio,
  quality: VideoQuality = '720p'
): { width: number; height: number } {
  const scale = quality === '1080p' ? 1.5 : quality === '480p' ? 0.6667 : 1;
  if (aspectRatio === '9:16') {
    return { width: Math.round(720 * scale), height: Math.round(1280 * scale) };
  }
  if (aspectRatio === '1:1') {
    const dim = quality === '1080p' ? 1080 : quality === '480p' ? 720 : 960;
    return { width: dim, height: dim };
  }
  return { width: Math.round(1280 * scale), height: Math.round(720 * scale) };
}

export function getSceneEffectiveDuration(scene: SceneItem): number {
  const base = Math.max(1, scene.durationSec || 5);
  const spd = Math.max(0.25, Math.min(4, scene.speed || 1));
  return Math.max(0.5, Number((base / spd).toFixed(2)));
}

export function getTotalDuration(scenes: SceneItem[]): number {
  return Number(scenes.reduce((acc, s) => acc + getSceneEffectiveDuration(s), 0).toFixed(2));
}

export function findSceneAtTime(
  scenes: SceneItem[],
  elapsedSec: number
): { scene: SceneItem; index: number; localTime: number; progress: number } {
  let cursor = 0;
  for (let i = 0; i < scenes.length; i++) {
    const dur = getSceneEffectiveDuration(scenes[i]);
    if (elapsedSec < cursor + dur || i === scenes.length - 1) {
      const localTime = Math.max(0, Math.min(dur, elapsedSec - cursor));
      return {
        scene: scenes[i],
        index: i,
        localTime,
        progress: Math.min(1, localTime / dur),
      };
    }
    cursor += dur;
  }
  return {
    scene: scenes[0],
    index: 0,
    localTime: 0,
    progress: 0,
  };
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  character: CartoonCharacter,
  cx: number,
  cy: number,
  scale: number,
  time: number
) {
  if (!character || character === 'none') return;
  const bounce = Math.sin(time * 4.2) * 8 * scale;
  const sway = Math.sin(time * 2.1) * 0.04;

  ctx.save();
  ctx.translate(cx, cy + bounce);
  ctx.rotate(sway);
  ctx.scale(scale, scale);

  // Soft ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 74 - bounce / scale, 48, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  if (character === 'rabbit') {
    // Ears
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.ellipse(-18, -76, 12, 34, -0.15, 0, Math.PI * 2);
    ctx.ellipse(18, -76, 12, 34, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FDA4AF';
    ctx.beginPath();
    ctx.ellipse(-18, -74, 6, 22, -0.15, 0, Math.PI * 2);
    ctx.ellipse(18, -74, 6, 22, 0.15, 0, Math.PI * 2);
    ctx.fill();
    // Body & Head
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.ellipse(0, 34, 34, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -24, 34, 0, Math.PI * 2);
    ctx.fill();
    // Eyes & Smile
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-12, -28, 4.5, 0, Math.PI * 2);
    ctx.arc(12, -28, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FB7185';
    ctx.beginPath();
    ctx.arc(0, -18, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -14, 10, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else if (character === 'turtle') {
    // Shell
    ctx.fillStyle = '#15803D';
    ctx.beginPath();
    ctx.arc(0, 22, 46, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 22, 32, Math.PI + 0.3, -0.3);
    ctx.stroke();
    // Head
    ctx.fillStyle = '#4ADE80';
    ctx.beginPath();
    ctx.arc(52, 8, 22, 0, Math.PI * 2);
    ctx.fill();
    // Feet
    ctx.fillRect(-34, 22, 18, 22);
    ctx.fillRect(14, 22, 18, 22);
    // Eye
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(60, 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(58, 12, 8, 0.2, Math.PI - 0.3);
    ctx.stroke();
  } else if (character === 'kid' || character === 'elder') {
    const shirtColor = character === 'kid' ? '#F59E0B' : '#E2E8F0';
    const hairColor = character === 'kid' ? '#1E293B' : '#CBD5E1';
    // Torso
    ctx.fillStyle = shirtColor;
    ctx.beginPath();
    ctx.roundRect(-26, 4, 52, 62, 18);
    ctx.fill();
    // Head
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.arc(0, -24, 30, 0, Math.PI * 2);
    ctx.fill();
    // Hair
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(0, -32, 30, Math.PI, 0);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-10, -24, 4, 0, Math.PI * 2);
    ctx.arc(10, -24, 4, 0, Math.PI * 2);
    ctx.fill();
    // Smile
    ctx.strokeStyle = '#7C2D12';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -16, 10, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else if (character === 'owl') {
    ctx.fillStyle = '#92400E';
    ctx.beginPath();
    ctx.ellipse(0, 12, 36, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.ellipse(0, 24, 22, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-13, -12, 12, 0, Math.PI * 2);
    ctx.arc(13, -12, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-13, -12, 5, 0, Math.PI * 2);
    ctx.arc(13, -12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(6, -4);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
  } else if (character === 'robot') {
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.roundRect(-34, -46, 68, 52, 14);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(-24, -36, 48, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#22D3EE';
    ctx.beginPath();
    ctx.arc(-10, -22, 5, 0, Math.PI * 2);
    ctx.arc(10, -22, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#64748B';
    ctx.beginPath();
    ctx.roundRect(-28, 12, 56, 56, 12);
    ctx.fill();
  }

  ctx.restore();
}

const colorValidationCache = new Map<string, string>();

function safeColor(input: string | undefined, fallback: string): string {
  if (!input || typeof input !== 'string') return fallback;
  let trimmed = input.trim();
  if (!trimmed) return fallback;

  // Normalize bare hex codes like "1E1B4B" -> "#1E1B4B"
  if (/^[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    trimmed = `#${trimmed}`;
  }

  const cached = colorValidationCache.get(trimmed);
  if (cached) return cached;

  if (typeof Option !== 'undefined') {
    const tester = new Option().style;
    tester.color = '';
    tester.color = trimmed;
    if (tester.color !== '') {
      colorValidationCache.set(trimmed, trimmed);
      return trimmed;
    }
  } else if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    return trimmed;
  }

  return fallback;
}

function drawProceduralBackdrop(
  ctx: CanvasRenderingContext2D,
  scene: SceneItem,
  w: number,
  h: number,
  time: number,
  progress: number
) {
  const { palette, cartoonElements, cameraMotion } = scene;
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.72);
  skyGrad.addColorStop(0, safeColor(palette?.skyTop, '#0F172A'));
  skyGrad.addColorStop(1, safeColor(palette?.skyBottom, '#1E3A8A'));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Camera drift transform for parallax layers
  let panX = 0;
  let zoom = 1;
  if (cameraMotion === 'zoom-in') zoom = 1 + progress * 0.08;
  else if (cameraMotion === 'zoom-out') zoom = 1.08 - progress * 0.08;
  else if (cameraMotion === 'pan-left') panX = -progress * 45;
  else if (cameraMotion === 'pan-right') panX = progress * 45;
  else if (cameraMotion === 'ken-burns') {
    zoom = 1 + progress * 0.06;
    panX = Math.sin(progress * Math.PI) * 20;
  }

  ctx.save();
  ctx.translate(w / 2 + panX, h / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-w / 2, -h / 2);

  // Celestial orb (Sun or Moon)
  const orbX = w * 0.72;
  const orbY = h * 0.24;
  const orbGlow = ctx.createRadialGradient(orbX, orbY, 10, orbX, orbY, w * 0.22);
  orbGlow.addColorStop(0, safeColor(palette?.accent, '#FBBF24'));
  orbGlow.addColorStop(0.35, 'rgba(251, 191, 36, 0.28)');
  orbGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = orbGlow;
  ctx.beginPath();
  ctx.arc(orbX, orbY, w * 0.22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = safeColor(palette?.accent, '#FDE68A');
  ctx.beginPath();
  ctx.arc(orbX, orbY, Math.min(w, h) * 0.065, 0, Math.PI * 2);
  ctx.fill();

  // Drifting clouds
  ctx.fillStyle = cartoonElements?.mood === 'night' ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.28)';
  for (let c = 0; c < 4; c++) {
    const cx = ((w * 0.25 * c + time * 18) % (w + 200)) - 100;
    const cy = h * (0.14 + (c % 2) * 0.09);
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.arc(cx + 28, cy - 10, 42, 0, Math.PI * 2);
    ctx.arc(cx + 62, cy, 32, 0, Math.PI * 2);
    ctx.fill();
  }

  // Distant layered mountains
  ctx.fillStyle = 'rgba(15, 23, 42, 0.38)';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.68);
  ctx.lineTo(w * 0.22, h * 0.44);
  ctx.lineTo(w * 0.48, h * 0.62);
  ctx.lineTo(w * 0.74, h * 0.4);
  ctx.lineTo(w, h * 0.58);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Foreground rolling ground
  const groundGrad = ctx.createLinearGradient(0, h * 0.62, 0, h);
  groundGrad.addColorStop(0, safeColor(palette?.ground, '#15803D'));
  groundGrad.addColorStop(1, '#090D16');
  ctx.fillStyle = groundGrad;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.66);
  ctx.quadraticCurveTo(w * 0.3, h * 0.59, w * 0.62, h * 0.66);
  ctx.quadraticCurveTo(w * 0.85, h * 0.71, w, h * 0.63);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Setting accents (trees, palms, temple, city, space, ocean)
  const setting = cartoonElements?.setting || 'forest';
  if (setting === 'forest' || setting === 'village') {
    for (let i = 0; i < 4; i++) {
      const tx = w * (0.1 + i * 0.27);
      const ty = h * 0.65;
      ctx.fillStyle = '#451A03';
      ctx.fillRect(tx - 8, ty - 70, 16, 75);
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.arc(tx, ty - 85, 42, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (setting === 'ocean') {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.38)';
    ctx.fillRect(0, h * 0.65, w, h * 0.35);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 2;
    for (let r = 0; r < 4; r++) {
      const ry = h * (0.7 + r * 0.06);
      const waveShift = Math.sin(time * 2 + r) * 20;
      ctx.beginPath();
      ctx.moveTo(w * 0.1 + waveShift, ry);
      ctx.quadraticCurveTo(w * 0.5 + waveShift, ry - 10, w * 0.9 + waveShift, ry);
      ctx.stroke();
    }
  } else if (setting === 'temple') {
    // Traditional South Indian gopuram silhouette
    const gx = w * 0.5;
    const gy = h * 0.64;
    ctx.fillStyle = '#7C2D12';
    ctx.fillRect(gx - 55, gy - 35, 110, 40);
    ctx.fillStyle = '#9A3412';
    ctx.beginPath();
    ctx.moveTo(gx - 46, gy - 35);
    ctx.lineTo(gx - 20, gy - 125);
    ctx.lineTo(gx + 20, gy - 125);
    ctx.lineTo(gx + 46, gy - 35);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(gx, gy - 134, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (setting === 'city') {
    const heights = [120, 175, 95, 200, 145, 110];
    heights.forEach((bh, i) => {
      const bx = w * (0.08 + i * 0.15);
      const by = h * 0.66 - bh;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(bx, by, w * 0.11, bh + 16);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.55)';
      for (let wy = by + 16; wy < h * 0.62; wy += 24) {
        ctx.fillRect(bx + 10, wy, 10, 12);
        ctx.fillRect(bx + 32, wy, 10, 12);
      }
    });
  } else if (setting === 'space') {
    // Glowing ringed planet
    const px = w * 0.28;
    const py = h * 0.34;
    ctx.fillStyle = safeColor(palette?.accent, '#38BDF8');
    ctx.beginPath();
    ctx.arc(px, py, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.55)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(px, py, 78, 18, -0.25, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Characters
  const charScale = Math.min(w, h) / 720;
  if (cartoonElements?.character && cartoonElements.character !== 'none') {
    const hasSecond = cartoonElements.secondaryCharacter && cartoonElements.secondaryCharacter !== 'none';
    drawCharacter(
      ctx,
      cartoonElements.character,
      hasSecond ? w * 0.38 : w * 0.5,
      h * 0.67,
      charScale * 1.15,
      time
    );
    if (hasSecond && cartoonElements.secondaryCharacter) {
      drawCharacter(
        ctx,
        cartoonElements.secondaryCharacter,
        w * 0.63,
        h * 0.69,
        charScale * 1.0,
        time + 1.2
      );
    }
  }

  ctx.restore();
}

function drawWeatherParticles(
  ctx: CanvasRenderingContext2D,
  fx: SceneItem['weatherFx'],
  w: number,
  h: number,
  time: number
) {
  if (!fx || fx === 'none') return;

  ctx.save();
  const count = fx === 'rain' ? 75 : 36;

  for (let i = 0; i < count; i++) {
    const seed = (i * 9301 + 49297) % 233280;
    const rx = seed / 233280;
    const ry = ((i * 7919 + 12345) % 233280) / 233280;

    if (fx === 'rain') {
      const x = (rx * w + time * 90) % w;
      const y = (ry * h + time * 680) % h;
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 6, y + 18);
      ctx.stroke();
    } else if (fx === 'fireflies' || fx === 'golden-dust') {
      const x = (rx * w + Math.sin(time * 0.9 + i) * 30 + w) % w;
      const y = (ry * h * 0.8 + Math.cos(time * 1.1 + i) * 24 + h) % h;
      const alpha = 0.35 + 0.55 * Math.abs(Math.sin(time * 2.2 + i));
      ctx.fillStyle =
        fx === 'fireflies' ? `rgba(190, 242, 100, ${alpha})` : `rgba(251, 191, 36, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 2.5 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    } else if (fx === 'stars') {
      const x = rx * w;
      const y = ry * h * 0.52;
      const alpha = 0.25 + 0.75 * Math.abs(Math.sin(time * 2 + i));
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (fx === 'petals') {
      const x = (rx * w + Math.sin(time + i) * 40 + w) % w;
      const y = (ry * h + time * 55) % h;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(251, 113, 133, 0.72)' : 'rgba(253, 186, 116, 0.72)';
      ctx.beginPath();
      ctx.ellipse(x, y, 6, 3.5, time + i, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawSubtitles(
  ctx: CanvasRenderingContext2D,
  scene: SceneItem,
  project: VideoProject,
  w: number,
  h: number
) {
  const style: SubtitleStyle = project.subtitleStyle || 'cinema';
  if (style === 'off') return;

  const primaryText =
    project.contentLanguage === 'en' ? scene.subtitleEn || scene.narration : scene.subtitleTe || scene.narration;
  const secondaryText =
    project.contentLanguage === 'bilingual' && scene.subtitleEn && scene.subtitleEn !== primaryText
      ? scene.subtitleEn
      : '';

  if (!primaryText) return;

  const isPortrait = w < h;
  const fontSize = style === 'shorts-pop' ? (isPortrait ? 34 : 38) : isPortrait ? 26 : 30;
  const subFontSize = Math.round(fontSize * 0.74);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = `600 ${fontSize}px "Noto Sans Telugu", "DM Sans", sans-serif`;
  const maxTextW = w * 0.84;
  const lines = wrapTextLines(ctx, primaryText, maxTextW);

  let secLines: string[] = [];
  if (secondaryText) {
    ctx.font = `500 ${subFontSize}px "DM Sans", sans-serif`;
    secLines = wrapTextLines(ctx, secondaryText, maxTextW);
  }

  const lineH = fontSize * 1.35;
  const secLineH = subFontSize * 1.3;
  const boxH = lines.length * lineH + secLines.length * secLineH + 28;
  const centerY = style === 'shorts-pop' ? h * 0.74 : h - boxH / 2 - (isPortrait ? 84 : 40);

  if (style !== 'minimal') {
    const boxW = Math.min(w * 0.9, maxTextW + 56);
    ctx.fillStyle = style === 'shorts-pop' ? 'rgba(11, 13, 18, 0.82)' : 'rgba(11, 13, 18, 0.74)';
    ctx.beginPath();
    ctx.roundRect((w - boxW) / 2, centerY - boxH / 2, boxW, boxH, 16);
    ctx.fill();
  }

  let cursorY = centerY - boxH / 2 + 16 + lineH / 2;
  ctx.font = `600 ${fontSize}px "Noto Sans Telugu", "DM Sans", sans-serif`;
  ctx.fillStyle = style === 'shorts-pop' ? '#FBBF24' : '#F8FAFC';
  for (const l of lines) {
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 8;
    ctx.fillText(l, w / 2, cursorY);
    cursorY += lineH;
  }

  if (secLines.length > 0) {
    ctx.font = `500 ${subFontSize}px "DM Sans", sans-serif`;
    ctx.fillStyle = '#CBD5E1';
    for (const l of secLines) {
      ctx.fillText(l, w / 2, cursorY);
      cursorY += secLineH;
    }
  }
  ctx.restore();
}

function getFilterCss(preset?: SceneFilter, enhance?: boolean, chromaKey?: boolean): string {
  const parts: string[] = [];
  switch (preset) {
    case 'warm':
      parts.push('sepia(0.24) saturate(1.22) brightness(1.04)');
      break;
    case 'vivid':
      parts.push('saturate(1.42) contrast(1.1)');
      break;
    case 'bw':
      parts.push('grayscale(1) contrast(1.14)');
      break;
    case 'golden':
      parts.push('sepia(0.38) contrast(1.08) brightness(1.05)');
      break;
    default:
      break;
  }
  if (enhance) {
    parts.push('contrast(1.12) saturate(1.16) brightness(1.04)');
  }
  if (chromaKey) {
    parts.push('hue-rotate(-8deg) saturate(1.08)');
  }
  return parts.length ? parts.join(' ') : 'none';
}

export function renderSceneFrame(
  ctx: CanvasRenderingContext2D,
  project: VideoProject,
  scene: SceneItem,
  progress: number,
  globalTime: number,
  imageCache: Map<string, HTMLImageElement>,
  watermarkText?: string
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = scene.chromaKey ? '#0F172A' : '#07090D';
  ctx.fillRect(0, 0, w, h);

  const sceneDur = getSceneEffectiveDuration(scene);
  const localSec = progress * sceneDur;
  const transMode = scene.transition || 'fade';
  const transT = localSec < 0.45 ? localSec / 0.45 : 1;

  ctx.save();
  if (transMode === 'fade' && transT < 1) {
    ctx.globalAlpha = Math.max(0.15, transT);
  } else if (transMode === 'slide' && transT < 1) {
    const ease = 1 - Math.pow(1 - transT, 3);
    ctx.translate((1 - ease) * w * 0.16, 0);
    ctx.globalAlpha = Math.max(0.25, transT);
  }

  ctx.filter = getFilterCss(scene.filterPreset, scene.enhance, scene.chromaKey);

  const img = scene.imageUrl ? imageCache.get(scene.imageUrl) : undefined;
  if (img && img.complete && img.naturalWidth > 0) {
    let scale = scene.cropZoom ? Math.max(1, Math.min(2, scene.cropZoom)) : 1.05;
    let tx = 0;
    let ty = 0;
    if (scene.cameraMotion === 'zoom-in') scale *= 1.0 + progress * 0.14;
    else if (scene.cameraMotion === 'zoom-out') scale *= 1.14 - progress * 0.14;
    else if (scene.cameraMotion === 'pan-left') {
      scale = Math.max(scale, 1.14);
      tx = (0.5 - progress) * w * 0.08;
    } else if (scene.cameraMotion === 'pan-right') {
      scale = Math.max(scale, 1.14);
      tx = (progress - 0.5) * w * 0.08;
    } else if (scene.cameraMotion === 'ken-burns') {
      scale *= 1.02 + progress * 0.12;
      tx = Math.sin(progress * Math.PI) * 28;
      ty = -progress * 18;
    } else if (scene.cameraMotion === 'bounce-cartoon') {
      scale *= 1.04 + Math.sin(globalTime * 4) * 0.02;
      ty = Math.sin(globalTime * 4) * 6;
    }

    const rotated = (scene.rotation || 0) % 180 !== 0;
    const natW = rotated ? img.naturalHeight : img.naturalWidth;
    const natH = rotated ? img.naturalWidth : img.naturalHeight;
    const imgRatio = natW / natH;
    const canvasRatio = w / h;
    let drawW = w;
    let drawH = h;
    if (scene.fitMode === 'contain') {
      if (imgRatio > canvasRatio) {
        drawW = w;
        drawH = w / imgRatio;
      } else {
        drawH = h;
        drawW = h * imgRatio;
      }
    } else if (imgRatio > canvasRatio) {
      drawH = h;
      drawW = h * imgRatio;
    } else {
      drawW = w;
      drawH = w / imgRatio;
    }

    ctx.save();
    ctx.translate(w / 2 + tx, h / 2 + ty);
    if (scene.rotation) {
      ctx.rotate((scene.rotation * Math.PI) / 180);
    }
    ctx.scale(scale, scale);
    if (rotated) {
      ctx.drawImage(img, -drawH / 2, -drawW / 2, drawH, drawW);
    } else {
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    }
    ctx.restore();

    // Subtle cinema gradient scrim for readability
    const scrim = ctx.createLinearGradient(0, h * 0.55, 0, h);
    scrim.addColorStop(0, 'rgba(0,0,0,0)');
    scrim.addColorStop(1, 'rgba(11,13,18,0.65)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h);
  } else {
    drawProceduralBackdrop(ctx, scene, w, h, globalTime, progress);
  }

  ctx.filter = 'none';

  // Style-specific visual treatment overlays
  if (project.style === 'realistic') {
    const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
    if (w > h) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, w, 26);
      ctx.fillRect(0, h - 26, w, 26);
    }
  } else if (project.style === 'anime') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const lx = ((i * w * 0.18 + globalTime * 60) % (w + 200)) - 100;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx - 90, h * 0.45);
      ctx.stroke();
    }
    ctx.restore();
  } else if (project.style === '3d-render') {
    ctx.save();
    const glow = ctx.createRadialGradient(w * 0.2, h * 0.28, 6, w * 0.2, h * 0.28, 80);
    glow.addColorStop(0, 'rgba(255,255,255,0.65)');
    glow.addColorStop(0.5, safeColor(scene.palette?.accent, '#38BDF8'));
    glow.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(w * 0.2, h * 0.28 + Math.sin(globalTime * 2) * 8, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Visual Callout / Overlay Text (supported across all styles when edited)
  if (scene.visualCallout && scene.visualCallout.trim().length > 0) {
    ctx.save();
    ctx.font = '700 24px "Outfit", "Noto Sans Telugu", sans-serif';
    const textW = ctx.measureText(scene.visualCallout).width;
    const boxW = Math.min(w * 0.8, textW + 44);
    ctx.fillStyle = 'rgba(11, 13, 18, 0.78)';
    ctx.beginPath();
    ctx.roundRect(36, 36, boxW, 48, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#FBBF24';
    ctx.textBaseline = 'middle';
    ctx.fillText(scene.visualCallout, 58, 60);
    ctx.restore();
  }

  // Optional Sticker Overlay
  if (scene.sticker && scene.sticker.trim().length > 0) {
    ctx.save();
    const stickerPx = Math.round(Math.min(w, h) * 0.085);
    ctx.font = `${stickerPx}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const bob = Math.sin(globalTime * 3) * 6;
    ctx.fillText(scene.sticker.trim(), w * 0.86, h * 0.18 + bob);
    ctx.restore();
  }

  drawWeatherParticles(ctx, scene.weatherFx, w, h, globalTime);
  ctx.restore();

  drawSubtitles(ctx, scene, project, w, h);

  if (watermarkText) {
    ctx.save();
    const logoImg = imageCache.get(APP_LOGO_URL);
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.roundRect(w - 58, 18, 34, 34, 8);
      ctx.clip();
      ctx.drawImage(logoImg, w - 58, 18, 34, 34);
      ctx.restore();
      ctx.save();
      ctx.font = '600 17px "Outfit", sans-serif';
      ctx.fillStyle = 'rgba(248, 250, 252, 0.72)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(watermarkText, w - 68, 35);
    } else {
      ctx.font = '600 18px "Outfit", sans-serif';
      ctx.fillStyle = 'rgba(248, 250, 252, 0.65)';
      ctx.textAlign = 'right';
      ctx.fillText(watermarkText, w - 24, 34);
    }
    ctx.restore();
  }
}

export async function preloadProjectImages(scenes: SceneItem[]): Promise<Map<string, HTMLImageElement>> {
  const cache = new Map<string, HTMLImageElement>();
  const urls = Array.from(
    new Set([APP_LOGO_URL, ...(scenes.map((s) => s.imageUrl).filter(Boolean) as string[])])
  );
  await Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            cache.set(url, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url;
        })
    )
  );
  return cache;
}

export function generateSrtContent(project: VideoProject): string {
  let cursor = 0;
  const fmt = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.round((sec - Math.floor(sec)) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  };

  return project.scenes
    .map((s, idx) => {
      const dur = getSceneEffectiveDuration(s);
      const start = fmt(cursor);
      const end = fmt(cursor + dur);
      cursor += dur;
      const line =
        project.contentLanguage === 'bilingual'
          ? `${s.subtitleTe}\n${s.subtitleEn}`
          : project.contentLanguage === 'en'
            ? s.subtitleEn || s.narration
            : s.subtitleTe || s.narration;
      return `${idx + 1}\n${start} --> ${end}\n${line}\n`;
    })
    .join('\n');
}

export async function renderThumbnailPng(
  project: VideoProject,
  hookText: string
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d')!;
  const cache = await preloadProjectImages(project.scenes);
  const firstScene = project.scenes[0];

  if (firstScene) {
    renderSceneFrame(ctx, { ...project, subtitleStyle: 'off' }, firstScene, 0.35, 1.2, cache);
  } else {
    ctx.fillStyle = '#0B0D12';
    ctx.fillRect(0, 0, 1280, 720);
  }

  // Dramatic left scrim for bold thumbnail typography
  const grad = ctx.createLinearGradient(0, 0, 900, 0);
  grad.addColorStop(0, 'rgba(11, 13, 18, 0.88)');
  grad.addColorStop(0.7, 'rgba(11, 13, 18, 0.45)');
  grad.addColorStop(1, 'rgba(11, 13, 18, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);

  // Accent bar + Bold Hook Title
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(64, 180, 10, 340);

  ctx.font = '700 66px "Outfit", "Noto Sans Telugu", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lines = wrapTextLines(ctx, hookText || project.title, 760);
  let y = 195;
  for (const line of lines.slice(0, 4)) {
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 14;
    ctx.fillText(line, 96, y);
    y += 82;
  }

  return canvas.toDataURL('image/png');
}

export async function exportProjectVideo(
  project: VideoProject,
  watermarkText: string | undefined,
  onProgress: (pct: number) => void
): Promise<{ blob: Blob; ext: string }> {
  const quality: VideoQuality = project.quality || '720p';
  const dims = getCanvasDimensions(project.aspectRatio, quality);
  const canvas = document.createElement('canvas');
  canvas.width = dims.width;
  canvas.height = dims.height;
  const ctx = canvas.getContext('2d')!;

  const imageCache = await preloadProjectImages(project.scenes);
  const totalSec = getTotalDuration(project.scenes);

  // Set up AudioContext + MediaStreamDestination for Voice + Music + SFX mixing
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();

  const musicGain = audioCtx.createGain();
  musicGain.gain.value = project.musicVolume ?? 0.25;
  musicGain.connect(dest);

  const voiceGain = audioCtx.createGain();
  voiceGain.gain.value = project.voiceVolume ?? 1.0;
  voiceGain.connect(dest);

  const sfxGain = audioCtx.createGain();
  sfxGain.gain.value = 0.7;
  sfxGain.connect(dest);

  // Decode scene TTS audio buffers if present
  const voiceBuffers = new Map<string, AudioBuffer>();
  for (const s of project.scenes) {
    if (s.audioBase64) {
      try {
        const buf = await decodeWavBase64(audioCtx, s.audioBase64);
        voiceBuffers.set(s.id, buf);
      } catch (e) {
        console.warn('Could not decode scene audio', s.id, e);
      }
    }
  }

  const videoStream = canvas.captureStream(30);
  const combinedTracks = [...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()];
  const combinedStream = new MediaStream(combinedTracks);

  const mimeCandidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const selectedMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
  const ext = selectedMime.includes('mp4') ? 'mp4' : 'webm';
  const videoBitsPerSecond = quality === '1080p' ? 7_500_000 : quality === '480p' ? 2_200_000 : 4_000_000;

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: selectedMime,
    videoBitsPerSecond,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const startOffset = audioCtx.currentTime + 0.08;
  const stopMusic = scheduleProceduralMusic(audioCtx, musicGain, project.musicTrack, startOffset, totalSec);

  // Schedule scene voiceovers & SFX
  let sceneCursor = 0;
  const activeSources: AudioBufferSourceNode[] = [];
  for (const s of project.scenes) {
    const dur = getSceneEffectiveDuration(s);
    const buf = voiceBuffers.get(s.id);
    if (buf) {
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = Math.max(0.5, Math.min(2, s.speed || 1));
      src.connect(voiceGain);
      src.start(startOffset + sceneCursor);
      activeSources.push(src);
    }
    if (s.sfx && s.sfx !== 'none') {
      scheduleSfx(audioCtx, sfxGain, s.sfx, startOffset + sceneCursor + 0.05);
    }
    sceneCursor += dur;
  }

  return new Promise((resolve, reject) => {
    recorder.onerror = (err) => reject(err);
    recorder.onstop = () => {
      stopMusic();
      activeSources.forEach((s) => {
        try {
          s.stop();
        } catch {}
      });
      audioCtx.close().catch(() => {});
      onProgress(100);
      resolve({ blob: new Blob(chunks, { type: selectedMime }), ext });
    };

    recorder.start(250);
    const t0 = performance.now();

    const tick = () => {
      const elapsedSec = (performance.now() - t0) / 1000;
      const pct = Math.min(99, Math.round((elapsedSec / totalSec) * 100));
      onProgress(pct);

      const { scene, progress } = findSceneAtTime(project.scenes, elapsedSec);
      renderSceneFrame(ctx, project, scene, progress, elapsedSec, imageCache, watermarkText);

      if (elapsedSec < totalSec) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop();
        }, 120);
      }
    };

    requestAnimationFrame(tick);
  });
}
