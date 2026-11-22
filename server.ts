import express from 'express';
import http from 'http';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'studio-db.json');
const ADMIN_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const aiBeta = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: 'v1beta',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface DbSchema {
  projects: any[];
  games: any[];
  assets: any[];
  users: { id: string; label: string; email?: string; role: string; status: 'active' | 'blocked'; lastActive: string }[];
  generationLogs: { id: string; type: string; summary: string; model: string; status: 'ok' | 'error'; createdAt: string }[];
  errorLogs: { id: string; route: string; message: string; createdAt: string }[];
  adminSettings: {
    studioName: string;
    proprietorName: string;
    adminNote?: string;
    freeDailyLimit: number;
    watermarkEnabled: boolean;
    watermarkText: string;
    enableCartoon: boolean;
    enableRealistic: boolean;
    enableImageToVideo: boolean;
    pricingMode: 'free-starter' | 'freemium';
    proMonthlyInr: number;
    maintenanceMode: boolean;
    adminPin: string;
  };
  usageStats: {
    totalStoryboards: number;
    totalVoices: number;
    totalExports: number;
    totalYouTubePreps: number;
    totalGames: number;
    todayCount: number;
    lastResetDate: string;
  };
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getSeedDb(): DbSchema {
  const now = new Date().toISOString();
  return {
    projects: [
      {
        id: 'proj-cartoon-rabbit',
        title: 'చిట్టి కుందేలు & తెలివైన తాబేలు',
        mode: 'cartoon-maker',
        style: 'cartoon',
        aspectRatio: '16:9',
        contentLanguage: 'bilingual',
        prompt: 'పిల్లల కోసం చిట్టి కుందేలు మరియు తెలివైన తాబేలు స్నేహ కథ',
        voiceName: 'Kore',
        voiceStyle: 'cartoon',
        musicTrack: 'kids-playful',
        musicVolume: 0.25,
        voiceVolume: 1.0,
        subtitleStyle: 'cinema',
        exportCount: 2,
        createdAt: now,
        updatedAt: now,
        youtubeSeo: {
          title: 'చిట్టి కుందేలు మరియు తెలివైన తాబేలు | Telugu Kids Cartoon Moral Story',
          description:
            'అందమైన అడవిలో చిట్టి కుందేలు మరియు తెలివైన తాబేలు ఎలా స్నేహితులు అయ్యాయో చూడండి. పిల్లల కోసం నీతి కథ!',
          tags: ['Telugu Stories', 'Kids Cartoon', 'Moral Stories Telugu', 'AI Cartoon Video'],
          hashtags: ['#TeluguStories', '#KidsCartoon', '#TeluguMoralStories'],
          thumbnailHook: 'అడవిలో అద్భుతమైన స్నేహం!',
          uploadedStatus: 'ready',
        },
        scenes: [
          {
            id: 'sc-1',
            title: 'అడవి ఉదయం (Forest Morning)',
            narration: 'పచ్చని అడవిలో ఒక చిట్టి కుందేలు, తెలివైన తాబేలు మంచి స్నేహితులుగా ఉండేవి.',
            subtitleTe: 'పచ్చని అడవిలో చిట్టి కుందేలు, తెలివైన తాబేలు స్నేహితులుగా ఉండేవి.',
            subtitleEn: 'In a lush green forest, a little rabbit and a wise turtle were best friends.',
            durationSec: 5,
            cameraMotion: 'zoom-in',
            weatherFx: 'golden-dust',
            backdropType: 'template',
            imageUrl: '/src/assets/images/studio_cartoon_jungle_1795115468069.jpg',
            palette: { skyTop: '#38BDF8', skyBottom: '#BAE6FD', ground: '#15803D', accent: '#FBBF24' },
            cartoonElements: { character: 'rabbit', secondaryCharacter: 'turtle', setting: 'forest', mood: 'sunny' },
          },
          {
            id: 'sc-2',
            title: 'చిరు జల్లు సమస్య (Sudden Stream)',
            narration: 'ఒకరోజు పెద్ద వర్షం రావడంతో వాగు పొంగింది. కుందేలు భయపడింది.',
            subtitleTe: 'పెద్ద వర్షం రావడంతో వాగు పొంగి, కుందేలు భయపడింది.',
            subtitleEn: 'When heavy rain swelled the stream, the little rabbit grew worried.',
            durationSec: 5,
            cameraMotion: 'bounce-cartoon',
            weatherFx: 'rain',
            backdropType: 'procedural',
            palette: { skyTop: '#1E293B', skyBottom: '#475569', ground: '#14532D', accent: '#38BDF8' },
            cartoonElements: { character: 'rabbit', secondaryCharacter: 'owl', setting: 'forest', mood: 'night' },
          },
          {
            id: 'sc-3',
            title: 'తాబేలు సాయం (Turtle Rescue)',
            narration: 'తెలివైన తాబేలు తన బలమైన చిప్పపై కుందేలును ఎక్కించుకుని సురక్షితంగా అవతలికి చేర్చింది.',
            subtitleTe: 'తాబేలు కుందేలును సురక్షితంగా ఒడ్డుకు చేర్చింది.',
            subtitleEn: 'The wise turtle carried the rabbit safely across the sparkling stream.',
            durationSec: 5,
            cameraMotion: 'pan-right',
            weatherFx: 'fireflies',
            backdropType: 'procedural',
            palette: { skyTop: '#F59E0B', skyBottom: '#FDE68A', ground: '#166534', accent: '#F97316' },
            cartoonElements: { character: 'turtle', secondaryCharacter: 'rabbit', setting: 'forest', mood: 'sunset' },
          },
        ],
      },
      {
        id: 'proj-kakinada-short',
        title: 'అద్భుతమైన పల్లె & తీర ప్రయాణం (Shorts)',
        mode: 'text-to-video',
        style: 'realistic',
        aspectRatio: '9:16',
        contentLanguage: 'bilingual',
        prompt: 'ఆంధ్రప్రదేశ్ అందమైన తీర ప్రాంతం మరియు పల్లెటూరి సాయంత్రం పై 9:16 యూట్యూబ్ షార్ట్',
        voiceName: 'Charon',
        voiceStyle: 'documentary',
        musicTrack: 'cinematic-dawn',
        musicVolume: 0.3,
        voiceVolume: 1.0,
        subtitleStyle: 'shorts-pop',
        exportCount: 1,
        createdAt: now,
        updatedAt: now,
        youtubeSeo: {
          title: 'మన తెలుగు ప్రకృతి అందాలు | Cinematic Telugu Travel Short',
          description: 'సూర్యోదయం నుండి సంధ్యా దీపాల వరకు మన తెలుగు నేల సౌందర్యాన్ని ఈ 60 సెకన్ల వీడియోలో చూడండి.',
          tags: ['Telugu Shorts', 'Andhra Pradesh', 'Travel Cinema', 'AI Video'],
          hashtags: ['#TeluguShorts', '#Kakinada', '#CinematicIndia'],
          thumbnailHook: 'ప్రకృతి మాయాజాలం!',
          uploadedStatus: 'draft',
        },
        scenes: [
          {
            id: 'sh-1',
            title: 'గిరి శిఖర సూర్యాస్తమయం',
            narration: 'ప్రయాణం ఎప్పుడూ ఒక చిన్న దీపపు వెలుగుతోనే మొదలవుతుంది.',
            subtitleTe: 'ప్రయాణం ఎప్పుడూ ఒక చిన్న దీపపు వెలుగుతోనే మొదలవుతుంది.',
            subtitleEn: 'Every great journey begins with a single lantern above the clouds.',
            durationSec: 5,
            cameraMotion: 'zoom-in',
            weatherFx: 'stars',
            backdropType: 'template',
            imageUrl: '/src/assets/images/studio_shorts_portrait_1795115467460.jpg',
            palette: { skyTop: '#0F172A', skyBottom: '#312E81', ground: '#1E293B', accent: '#F59E0B' },
            cartoonElements: { character: 'none', setting: 'mountains', mood: 'night' },
          },
          {
            id: 'sh-2',
            title: 'నదీ తీర దీపాలు',
            narration: 'సాయంత్రం వేళ గోదావరి తీరంలో వెలిగే దీపాలు మనసుకు ప్రశాంతతను ఇస్తాయి.',
            subtitleTe: 'సాయంత్రం వేళ నదీ తీర దీపాలు మనసుకు ప్రశాంతతను ఇస్తాయి.',
            subtitleEn: 'At dusk, oil lamps along the riverside bring timeless peace.',
            durationSec: 5,
            cameraMotion: 'ken-burns',
            weatherFx: 'fireflies',
            backdropType: 'template',
            imageUrl: '/src/assets/images/studio_telugu_village_1795115467329.jpg',
            palette: { skyTop: '#1E1B4B', skyBottom: '#9A3412', ground: '#0F172A', accent: '#FBBF24' },
            cartoonElements: { character: 'none', setting: 'village', mood: 'sunset' },
          },
        ],
      },
    ],
    games: [
      {
        id: 'game-farmer-harvest',
        title: 'రైతు పంట రక్షణ (Farmer Harvest Runner)',
        genre: 'platformer',
        prompt: 'Telugu village farmer jumping over rocks and collecting golden grain harvests',
        storyTe: 'పచ్చని పల్లె పొలాల్లో రైతు అడ్డంకులను దాటుకుంటూ బంగారు ధాన్యాన్ని సేకరించే ఆట.',
        storyEn: 'Help the village farmer leap over obstacles and collect golden grain bundles.',
        instructions: 'Arrow keys / Jump button to leap over crows & rocks and grab grain.',
        heroEmoji: '🧑‍🌾',
        enemyEmoji: '🐦',
        collectibleEmoji: '🌾',
        heroColor: '#F59E0B',
        enemyColor: '#EF4444',
        bgTop: '#0F172A',
        bgBottom: '#14532D',
        speed: 4,
        winScore: 100,
        createdAt: now,
        updatedAt: now,
      },
    ],
    assets: [],
    users: [
      {
        id: 'proprietor-1',
        label: 'Injarapu Siva Raghava (Proprietor)',
        email: 'injarapusivaraghava@gmail.com',
        role: 'admin',
        status: 'active',
        lastActive: now,
      },
    ],
    generationLogs: [],
    errorLogs: [],
    adminSettings: {
      studioName: 'AI VIDEO MAKER PRO',
      proprietorName: 'Injarapu Siva Raghava',
      adminNote: '',
      freeDailyLimit: 25,
      watermarkEnabled: false,
      watermarkText: 'AI VIDEO MAKER PRO',
      enableCartoon: true,
      enableRealistic: true,
      enableImageToVideo: true,
      pricingMode: 'free-starter',
      proMonthlyInr: 199,
      maintenanceMode: false,
      adminPin: '1234',
    },
    usageStats: {
      totalStoryboards: 2,
      totalVoices: 0,
      totalExports: 3,
      totalYouTubePreps: 1,
      totalGames: 1,
      todayCount: 0,
      lastResetDate: getTodayStr(),
    },
  };
}

function normalizeHexColor(val: any, fallback: string): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{3,8}$/.test(trimmed)) return `#${trimmed}`;
  return fallback;
}

function readDb(): DbSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seed = getSeedDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as DbSchema;
    let dirty = false;
    if (
      parsed.adminSettings?.studioName === 'Kala AI Video Studio' ||
      parsed.adminSettings?.studioName === 'AI VIDEO MAKER – PRO'
    ) {
      parsed.adminSettings.studioName = 'AI VIDEO MAKER PRO';
      dirty = true;
    }
    if (
      parsed.adminSettings?.watermarkText === 'Kala AI Studio' ||
      parsed.adminSettings?.watermarkText === 'AI VIDEO MAKER – PRO'
    ) {
      parsed.adminSettings.watermarkText = 'AI VIDEO MAKER PRO';
      dirty = true;
    }
    if (Array.isArray(parsed.projects)) {
      for (const proj of parsed.projects) {
        if (Array.isArray(proj.scenes)) {
          for (const sc of proj.scenes) {
            if (sc.palette) {
              const sTop = normalizeHexColor(sc.palette.skyTop, '#0F172A');
              const sBot = normalizeHexColor(sc.palette.skyBottom, '#1E3A8A');
              const grd = normalizeHexColor(sc.palette.ground, '#14532D');
              const acc = normalizeHexColor(sc.palette.accent, '#F59E0B');
              if (
                sTop !== sc.palette.skyTop ||
                sBot !== sc.palette.skyBottom ||
                grd !== sc.palette.ground ||
                acc !== sc.palette.accent
              ) {
                sc.palette = { skyTop: sTop, skyBottom: sBot, ground: grd, accent: acc };
                dirty = true;
              }
            }
          }
        }
      }
    }
    if (!Array.isArray(parsed.games)) { parsed.games = getSeedDb().games; dirty = true; }
    if (!Array.isArray(parsed.assets)) { parsed.assets = []; dirty = true; }
    if (!Array.isArray(parsed.users)) { parsed.users = getSeedDb().users; dirty = true; }
    if (!Array.isArray(parsed.generationLogs)) { parsed.generationLogs = []; dirty = true; }
    if (!Array.isArray(parsed.errorLogs)) { parsed.errorLogs = []; dirty = true; }
    if (typeof parsed.usageStats?.totalGames !== 'number') { parsed.usageStats.totalGames = parsed.games.length; dirty = true; }

    if (parsed.usageStats.lastResetDate !== getTodayStr()) {
      parsed.usageStats.todayCount = 0;
      parsed.usageStats.lastResetDate = getTodayStr();
      dirty = true;
    }
    if (dirty) {
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    return parsed;
  } catch {
    const seed = getSeedDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
}

function recordGenerationLog(type: string, summary: string, model: string, status: 'ok' | 'error' = 'ok') {
  try {
    const db = readDb();
    db.generationLogs.unshift({
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      summary: String(summary || '').slice(0, 140),
      model,
      status,
      createdAt: new Date().toISOString(),
    });
    db.generationLogs = db.generationLogs.slice(0, 100);
    writeDb(db);
  } catch {}
}

function recordErrorLog(route: string, message: string) {
  try {
    const db = readDb();
    db.errorLogs.unshift({
      id: `err-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      route,
      message: String(message || 'Unknown error').slice(0, 240),
      createdAt: new Date().toISOString(),
    });
    db.errorLogs = db.errorLogs.slice(0, 100);
    writeDb(db);
  } catch {}
}

function constantTimeMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyAdminPasscode(candidate: string, db: DbSchema): boolean {
  const configured = process.env.ADMIN_PASSCODE?.trim();
  const expected = configured && configured.length > 0 ? configured : String(db.adminSettings.adminPin || '1234');
  return constantTimeMatch(String(candidate || '').trim(), expected);
}

function createAdminToken(): string {
  const exp = Date.now() + 8 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token: string): boolean {
  if (!token || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('base64url');
  if (!constantTimeMatch(sig, expectedSig)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    return parsed?.role === 'admin' && typeof parsed?.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!verifyAdminToken(token)) {
    return res.status(403).json({ error: 'Admin authentication required. Unlock with Admin credentials.' });
  }
  next();
}

function writeDb(db: DbSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.code;
      if (status === 400 || status === 401 || status === 403 || status === 404) {
        throw err;
      }
      if (i < maxRetries) {
        await new Promise((r) => setTimeout(r, 800 * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

function handleGeminiError(res: express.Response, err: any, routeName = '/api/studio') {
  console.error('Gemini API Error:', err);
  const message = err?.message || 'AI service error occurred';
  recordErrorLog(routeName, message);
  const status = typeof err?.status === 'number' ? err.status : 500;
  res.status(status).json({ error: message });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, hasApiKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  // Real Android APK detection & safe allowlisted download
  const resolveRealApkFile = () => {
    const candidates = [
      path.resolve(process.cwd(), 'public', 'downloads', 'ai-video-maker-pro.apk'),
      path.resolve(process.cwd(), 'public', 'ai-video-maker-pro.apk'),
      path.resolve(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
      path.resolve(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
    ];

    for (const filePath of candidates) {
      try {
        if (!fs.existsSync(filePath)) continue;
        const stat = fs.statSync(filePath);
        if (!stat.isFile() || stat.size <= 0) continue;

        let realVersion: string | null = null;
        const gradlePath = path.resolve(process.cwd(), 'android', 'app', 'build.gradle');
        if (fs.existsSync(gradlePath)) {
          const gradleText = fs.readFileSync(gradlePath, 'utf-8');
          const match = gradleText.match(/versionName\s+["']([^"']+)["']/);
          if (match?.[1]) realVersion = match[1].trim();
        }
        if (!realVersion) {
          const metaPath = path.resolve(process.cwd(), 'public', 'downloads', 'apk-meta.json');
          if (fs.existsSync(metaPath)) {
            try {
              const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
              if (typeof meta?.version === 'string' && meta.version.trim()) {
                realVersion = meta.version.trim();
              }
            } catch {}
          }
        }

        return {
          available: true,
          filePath,
          version: realVersion,
          fileSizeBytes: stat.size,
          updatedAt: stat.mtime.toISOString(),
        };
      } catch {}
    }

    return null;
  };

  app.get('/api/apk/status', (_req, res) => {
    const apk = resolveRealApkFile();
    if (!apk) {
      return res.json({
        available: false,
        message: 'APK is not ready yet. Build the Android app first.',
        version: null,
        fileSizeBytes: null,
        updatedAt: null,
        downloadUrl: null,
      });
    }
    res.json({
      available: true,
      message: 'Android APK ready for download.',
      version: apk.version,
      fileSizeBytes: apk.fileSizeBytes,
      updatedAt: apk.updatedAt,
      downloadUrl: '/api/apk/download',
    });
  });

  app.get('/api/apk/download', (_req, res) => {
    const apk = resolveRealApkFile();
    if (!apk) {
      return res.status(404).json({
        error: 'APK is not ready yet. Build the Android app first.',
      });
    }
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    return res.download(apk.filePath, 'AI-VIDEO-MAKER-PRO.apk');
  });

  // Projects CRUD
  app.get('/api/projects', (_req, res) => {
    const db = readDb();
    res.json({ projects: db.projects });
  });

  app.post('/api/projects', (req, res) => {
    const project = req.body?.project;
    if (!project || !project.id) {
      return res.status(400).json({ error: 'Invalid project payload' });
    }
    const db = readDb();
    // Strip oversized inline audioBase64 if needed? Keep up to reasonable size; JSON supports it cleanly for typical 4-6 scenes.
    const idx = db.projects.findIndex((p) => p.id === project.id);
    const updated = { ...project, updatedAt: new Date().toISOString() };
    if (idx >= 0) {
      db.projects[idx] = updated;
    } else {
      db.projects.unshift(updated);
    }
    writeDb(db);
    res.json({ project: updated });
  });

  app.post('/api/projects/:id/export-track', (req, res) => {
    const db = readDb();
    const idx = db.projects.findIndex((p) => p.id === req.params.id);
    if (idx >= 0) {
      db.projects[idx].exportCount = (db.projects[idx].exportCount || 0) + 1;
    }
    db.usageStats.totalExports += 1;
    writeDb(db);
    res.json({ ok: true, totalExports: db.usageStats.totalExports });
  });

  app.delete('/api/projects/:id', (req, res) => {
    const db = readDb();
    db.projects = db.projects.filter((p) => p.id !== req.params.id);
    writeDb(db);
    res.json({ ok: true });
  });

  // Admin Settings, Auth, Logs & User Management
  app.get('/api/admin/settings', (_req, res) => {
    const db = readDb();
    const { adminPin: _pin, ...publicSettings } = db.adminSettings;
    res.json({
      settings: publicSettings,
      usageStats: db.usageStats,
    });
  });

  app.post('/api/admin/verify-pin', (req, res) => {
    const { pin } = req.body || {};
    const db = readDb();
    if (verifyAdminPasscode(String(pin || ''), db)) {
      const { adminPin: _pin, ...safeSettings } = db.adminSettings;
      const adminToken = createAdminToken();
      return res.json({ unlocked: true, adminToken, settings: safeSettings, usageStats: db.usageStats });
    }
    recordErrorLog('/api/admin/verify-pin', 'Failed admin unlock attempt');
    return res.status(401).json({ unlocked: false, error: 'Invalid Admin PIN' });
  });

  app.post('/api/admin/settings', requireAdmin, (req, res) => {
    const { settings } = req.body || {};
    const db = readDb();
    const { newPin, adminPin: _ignored, ...safeUpdates } = settings || {};
    db.adminSettings = {
      ...db.adminSettings,
      ...safeUpdates,
      adminPin: newPin && String(newPin).trim() ? String(newPin).trim() : db.adminSettings.adminPin,
    };
    writeDb(db);
    const { adminPin: _pin, ...publicSettings } = db.adminSettings;
    res.json({ settings: publicSettings, usageStats: db.usageStats });
  });

  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const db = readDb();
    res.json({
      users: db.users,
      generationLogs: db.generationLogs,
      errorLogs: db.errorLogs,
      projectCount: db.projects.length,
      gameCount: db.games.length,
      assetCount: db.assets.length,
    });
  });

  app.post('/api/admin/users/:id/status', requireAdmin, (req, res) => {
    const db = readDb();
    const nextStatus = req.body?.status === 'blocked' ? 'blocked' : 'active';
    db.users = db.users.map((u) => (u.id === req.params.id ? { ...u, status: nextStatus } : u));
    writeDb(db);
    res.json({ users: db.users });
  });

  app.delete('/api/admin/logs', requireAdmin, (_req, res) => {
    const db = readDb();
    db.generationLogs = [];
    db.errorLogs = [];
    writeDb(db);
    res.json({ ok: true });
  });

  // Sync active signed-in creator profile cleanly
  app.post('/api/users/sync', (req, res) => {
    const { id, label, email } = req.body || {};
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid user id' });
    const db = readDb();
    const now = new Date().toISOString();
    const isAdmin = String(email || '').toLowerCase() === 'injarapusivaraghava@gmail.com';
    const idx = db.users.findIndex((u) => u.id === id);
    if (idx >= 0) {
      db.users[idx] = { ...db.users[idx], label: label || db.users[idx].label, email: email || db.users[idx].email, lastActive: now };
    } else {
      db.users.unshift({
        id,
        label: String(label || 'Creator').slice(0, 100),
        email: email ? String(email).slice(0, 150) : undefined,
        role: isAdmin ? 'admin' : 'creator',
        status: 'active',
        lastActive: now,
      });
    }
    db.users = db.users.slice(0, 50);
    writeDb(db);
    res.json({ ok: true });
  });

  // Games & Assets History CRUD
  app.get('/api/games', (_req, res) => {
    const db = readDb();
    res.json({ games: db.games });
  });

  app.post('/api/games', (req, res) => {
    const game = req.body?.game;
    if (!game || !game.id) return res.status(400).json({ error: 'Invalid game payload' });
    const db = readDb();
    const updated = { ...game, updatedAt: new Date().toISOString() };
    const idx = db.games.findIndex((g) => g.id === game.id);
    if (idx >= 0) db.games[idx] = updated;
    else db.games.unshift(updated);
    writeDb(db);
    res.json({ game: updated });
  });

  app.delete('/api/games/:id', (req, res) => {
    const db = readDb();
    db.games = db.games.filter((g) => g.id !== req.params.id);
    writeDb(db);
    res.json({ ok: true });
  });

  app.get('/api/assets', (_req, res) => {
    const db = readDb();
    res.json({ assets: db.assets });
  });

  app.post('/api/assets', (req, res) => {
    const asset = req.body?.asset;
    if (!asset || !asset.id) return res.status(400).json({ error: 'Invalid asset payload' });
    const db = readDb();
    db.assets.unshift({ ...asset, createdAt: asset.createdAt || new Date().toISOString() });
    db.assets = db.assets.slice(0, 60);
    writeDb(db);
    res.json({ assets: db.assets });
  });

  app.delete('/api/assets/:id', (req, res) => {
    const db = readDb();
    db.assets = db.assets.filter((a) => a.id !== req.params.id);
    writeDb(db);
    res.json({ ok: true });
  });

  // Generate AI Video Storyboard (Text-to-Video, Cartoon Maker, Story Maker — Short & Long)
  app.post('/api/studio/generate-storyboard', async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment.' });
    }
    const db = readDb();
    if (db.adminSettings.maintenanceMode) {
      return res.status(503).json({ error: 'Studio is currently in maintenance mode set by Admin.' });
    }
    if (db.usageStats.todayCount >= db.adminSettings.freeDailyLimit) {
      return res.status(429).json({
        error: `Daily free limit (${db.adminSettings.freeDailyLimit}) reached. Admin can raise this limit in Admin Controls.`,
      });
    }

    const { prompt, style, aspectRatio, contentLanguage, mode, targetDurationSec = 30 } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const numericTarget = Math.min(900, Math.max(5, Number(targetDurationSec) || 30));
    const sceneCount =
      numericTarget <= 8 ? 2 : numericTarget <= 15 ? 3 : numericTarget <= 30 ? 5 : numericTarget <= 60 ? 8 : numericTarget <= 120 ? 10 : 12;
    const perSceneSec = Math.min(60, Math.max(2, Number((numericTarget / sceneCount).toFixed(1))));

    const langInstruction =
      contentLanguage === 'te'
        ? 'Write narration and title in natural, expressive Telugu script (తెలుగు). Also provide English subtitle translation.'
        : contentLanguage === 'en'
          ? 'Write narration and title in engaging English. Also provide natural Telugu subtitle translation.'
          : 'Write narration in natural Telugu script (తెలుగు), and fill both subtitleTe (Telugu) and subtitleEn (English) accurately.';

    const styleInstruction =
      style === 'cartoon'
        ? 'Style is vibrant Kids AI Cartoon animation. Pick fitting cartoon characters (rabbit, turtle, kid, elder, owl, robot) and cheerful palettes.'
        : style === 'anime'
          ? 'Style is expressive Anime visual storytelling with dramatic twilight/sky gradients, petals or stars FX, and dynamic zoom/pan camera motion.'
          : style === '3d-render'
            ? 'Style is sleek 3D Motion Art with deep volumetric color palettes, futuristic robots/scenery, and smooth pan/zoom camera motion.'
            : style === 'devotional'
              ? 'Style is Telugu Heritage / Village / Devotional storytelling with warm golden oil-lamp tones, river/temple/village settings.'
              : style === 'explainer'
                ? 'Style is crisp Tech & Educational explainer with sleek contrast palettes, short visualCallout headlines (2-4 words), and clear structured narration.'
                : 'Style is Realistic Cinematic storytelling with dramatic atmospheric palettes, camera pans, and poetic narration.';

    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Create a ${sceneCount}-scene video storyboard (total target duration ~${numericTarget} seconds, ~${perSceneSec}s per scene) for this text description: "${prompt}". Mode: ${mode || 'text-to-video'}. Aspect ratio: ${aspectRatio || '16:9'}.`,
          config: {
            systemInstruction: `You are an expert Telugu and English AI Video Director and Storyboard Writer for YouTube creators. ${langInstruction} ${styleInstruction} Keep each scene narration paced naturally for ~${perSceneSec} seconds (about ${perSceneSec * 2.5} words). Choose valid enum values for cameraMotion, weatherFx, character, setting, and mood.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                videoTitle: { type: Type.STRING, description: 'Catchy title for the video project' },
                scenes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      narration: { type: Type.STRING, description: 'Spoken voiceover text for TTS' },
                      subtitleTe: { type: Type.STRING, description: 'Telugu subtitle text' },
                      subtitleEn: { type: Type.STRING, description: 'English subtitle text' },
                      visualCallout: { type: Type.STRING, description: 'Short 2-4 word visual highlight caption for explainer/title overlay' },
                      durationSec: { type: Type.INTEGER, description: `Recommended duration around ${perSceneSec} seconds (between 4 and 10)` },
                      cameraMotion: {
                        type: Type.STRING,
                        description: 'One of: zoom-in, zoom-out, pan-left, pan-right, ken-burns, bounce-cartoon',
                      },
                      weatherFx: {
                        type: Type.STRING,
                        description: 'One of: none, fireflies, golden-dust, rain, stars, petals',
                      },
                      suggestedBackdrop: {
                        type: Type.STRING,
                        description: 'One of: procedural, cartoon-jungle, realistic-cinema, shorts-ridge, telugu-village',
                      },
                      skyTop: { type: Type.STRING, description: 'Hex color for top of sky' },
                      skyBottom: { type: Type.STRING, description: 'Hex color for horizon' },
                      ground: { type: Type.STRING, description: 'Hex color for foreground terrain' },
                      accent: { type: Type.STRING, description: 'Hex color for sun/moon/glow highlight' },
                      character: {
                        type: Type.STRING,
                        description: 'One of: rabbit, turtle, kid, elder, owl, robot, none',
                      },
                      secondaryCharacter: {
                        type: Type.STRING,
                        description: 'One of: rabbit, turtle, kid, elder, owl, robot, none',
                      },
                      setting: {
                        type: Type.STRING,
                        description: 'One of: forest, village, ocean, mountains, temple, space, city',
                      },
                      mood: {
                        type: Type.STRING,
                        description: 'One of: sunny, sunset, night, magical',
                      },
                    },
                    required: [
                      'title',
                      'narration',
                      'subtitleTe',
                      'subtitleEn',
                      'durationSec',
                      'cameraMotion',
                      'weatherFx',
                      'suggestedBackdrop',
                      'skyTop',
                      'skyBottom',
                      'ground',
                      'accent',
                      'character',
                      'setting',
                      'mood',
                    ],
                  },
                },
              },
              required: ['videoTitle', 'scenes'],
            },
          },
        })
      );

      const raw = (response.text ?? '{}').trim();
      const parsed = JSON.parse(raw);

      const backdropMap: Record<string, string> = {
        'cartoon-jungle': '/src/assets/images/studio_cartoon_jungle_1795115468069.jpg',
        'realistic-cinema': '/src/assets/images/studio_realistic_cinema_1795115468140.jpg',
        'shorts-ridge': '/src/assets/images/studio_shorts_portrait_1795115467460.jpg',
        'telugu-village': '/src/assets/images/studio_telugu_village_1795115467329.jpg',
      };

      const mappedScenes = (parsed.scenes || []).map((s: any, idx: number) => {
        const templateUrl = backdropMap[s.suggestedBackdrop];
        const useTemplate = Boolean(templateUrl) && idx === 0 && style !== 'anime' && style !== '3d-render';
        return {
          id: `scene-${Date.now()}-${idx}`,
          title: s.title || `Scene ${idx + 1}`,
          narration: s.narration || '',
          subtitleTe: s.subtitleTe || s.narration || '',
          subtitleEn: s.subtitleEn || s.narration || '',
          visualCallout: s.visualCallout || '',
          durationSec:
            numericTarget < 12
              ? perSceneSec
              : Math.min(12, Math.max(2, Number(s.durationSec) || perSceneSec)),
          cameraMotion: s.cameraMotion || (style === 'cartoon' ? 'bounce-cartoon' : 'ken-burns'),
          weatherFx: s.weatherFx || 'golden-dust',
          backdropType: useTemplate ? 'template' : 'procedural',
          imageUrl: useTemplate ? templateUrl : undefined,
          palette: {
            skyTop: normalizeHexColor(s.skyTop, '#0F172A'),
            skyBottom: normalizeHexColor(s.skyBottom, '#1E3A8A'),
            ground: normalizeHexColor(s.ground, '#14532D'),
            accent: normalizeHexColor(s.accent, '#F59E0B'),
          },
          cartoonElements: {
            character: style === 'realistic' ? 'none' : s.character || 'none',
            secondaryCharacter: style === 'realistic' ? 'none' : s.secondaryCharacter || 'none',
            setting: s.setting || 'forest',
            mood: s.mood || 'sunny',
          },
        };
      });

      db.usageStats.totalStoryboards += 1;
      db.usageStats.todayCount += 1;
      writeDb(db);
      recordGenerationLog('video-storyboard', `${parsed.videoTitle || prompt.slice(0, 48)} (${aspectRatio || '16:9'})`, 'gemini-4-hydrogen');

      res.json({
        videoTitle: parsed.videoTitle || prompt.slice(0, 48),
        scenes: mappedScenes,
      });
    } catch (err: any) {
      handleGeminiError(res, err, '/api/studio/generate-storyboard');
    }
  });

  // Generate AI Voiceover via gemini-3.8-flash-lite-tts (Interactions API)
  app.post('/api/studio/generate-voice', async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment.' });
    }
    const { text, voiceName = 'Kore', voiceStyle = 'storyteller' } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Narration text is required' });
    }

    const styleDescMap: Record<string, string> = {
      storyteller: 'Warm, expressive storyteller narration with natural pacing',
      cartoon: 'Cheerful, animated, friendly kids cartoon narrator',
      documentary: 'Clear, authoritative, calm documentary film narrator',
      energetic: 'Upbeat, energetic YouTube Shorts creator voice',
    };

    const safeVoiceName = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'].includes(voiceName)
      ? voiceName
      : 'Kore';

    try {
      const interaction = await withRetry(() =>
        aiBeta.interactions.create({
          model: 'gemini-3.8-flash-lite-tts',
          input: [
            {
              type: 'text',
              text,
              annotations: [
                {
                  type: 'speech_metadata',
                  style: styleDescMap[voiceStyle] || styleDescMap.storyteller,
                },
              ],
            },
          ],
          response_format: { type: 'audio' },
          generation_config: {
            speech_config: [
              {
                voice: safeVoiceName,
              },
            ],
          },
        })
      );

      let audioData = interaction.output_audio?.data;
      let audioMime = interaction.output_audio?.mime_type || 'audio/wav';

      if (!audioData && Array.isArray((interaction as any).steps)) {
        for (const step of (interaction as any).steps) {
          if (step?.type === 'model_output' && Array.isArray(step.content)) {
            const audioPart = step.content.find((c: any) => c?.type === 'audio' && c?.data);
            if (audioPart?.data) {
              audioData = audioPart.data;
              audioMime = audioPart.mime_type || audioMime;
            }
          }
        }
      }

      if (!audioData) {
        return res.status(502).json({ error: 'No audio generated by TTS model.' });
      }

      const db = readDb();
      db.usageStats.totalVoices += 1;
      writeDb(db);
      recordGenerationLog('ai-voice', `${safeVoiceName} (${voiceStyle})`, 'gemini-3.8-flash-lite-tts');

      res.json({
        audioBase64: audioData,
        mimeType: audioMime,
      });
    } catch (err: any) {
      handleGeminiError(res, err, '/api/studio/generate-voice');
    }
  });

  // Generate YouTube Upload SEO Metadata
  app.post('/api/studio/youtube-seo', async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment.' });
    }
    const { title, scenes = [], aspectRatio = '16:9', contentLanguage = 'bilingual', style = 'cartoon' } = req.body || {};
    const scriptSummary = (scenes as any[])
      .map((s, i) => `Scene ${i + 1} (${s.durationSec}s): ${s.title} - ${s.narration}`)
      .join('\n');

    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Generate YouTube SEO metadata for this AI video.\nTitle: ${title}\nFormat: ${aspectRatio === '9:16' ? 'YouTube Shorts (9:16)' : 'YouTube Full Video (16:9)'}\nStyle: ${style}\nLanguage: ${contentLanguage}\nStoryboard:\n${scriptSummary}`,
          config: {
            systemInstruction:
              'You are a YouTube growth strategist specializing in Telugu and English channels. Generate a high-CTR title, detailed SEO description with scene timestamps, 12 relevant tags, 5 hashtags, and a 3-5 word bold thumbnail hook text.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                thumbnailHook: { type: Type.STRING },
              },
              required: ['title', 'description', 'tags', 'hashtags', 'thumbnailHook'],
            },
          },
        })
      );

      const seo = JSON.parse((response.text ?? '{}').trim());
      const db = readDb();
      db.usageStats.totalYouTubePreps += 1;
      writeDb(db);

      res.json({
        seo: {
          ...seo,
          uploadedStatus: 'ready',
        },
      });
    } catch (err: any) {
      handleGeminiError(res, err);
    }
  });

  // Clear starter demo projects
  app.post('/api/projects/clear-demos', (_req, res) => {
    const db = readDb();
    db.projects = db.projects.filter(
      (p) => p.id !== 'proj-cartoon-rabbit' && p.id !== 'proj-kakinada-short'
    );
    writeDb(db);
    res.json({ projects: db.projects });
  });

  // AI Photo Studio: generate enhanced prompt + safe SVG illustration artwork (free-tier Gemini 4 Hydrogen)
  app.post('/api/studio/generate-photo', async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment.' });
    }
    const { prompt, style = '3D Cartoon', size = '1024x1024' } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Image description is required' });
    }

    const [wStr, hStr] = String(size).split('x');
    const vw = Number(wStr) || 1024;
    const vh = Number(hStr) || 1024;

    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Create a detailed visual illustration and enhanced AI image prompt for: "${prompt}". Style: ${style}. Target viewBox: 0 0 ${vw} ${vh}.`,
          config: {
            systemInstruction: `You are an expert visual illustrator and AI prompt engineer. Return JSON with:
1. "title": short Telugu or English artwork title
2. "enhancedPrompt": rich, professional photography/illustration prompt describing lighting, composition, textures, and colors
3. "svgMarkup": a complete, rich, layered, artistic <svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg">...</svg> scene matching the prompt and style (use linearGradient/radialGradient, paths, circles, hills, characters/objects, lighting highlights). Do NOT include <script>, <foreignObject>, or event attributes.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                enhancedPrompt: { type: Type.STRING },
                svgMarkup: { type: Type.STRING },
              },
              required: ['title', 'enhancedPrompt', 'svgMarkup'],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      let cleanSvg = String(parsed.svgMarkup || '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
        .replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '');

      if (!cleanSvg.includes('<svg')) {
        cleanSvg = `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg"><rect width="${vw}" height="${vh}" fill="#0F172A"/></svg>`;
      }

      res.json({
        title: parsed.title || 'AI Artwork',
        enhancedPrompt: parsed.enhancedPrompt || prompt,
        svgMarkup: cleanSvg,
        width: vw,
        height: vh,
      });
    } catch (err: any) {
      handleGeminiError(res, err);
    }
  });

  // Telugu & English Story Studio: generate structured story & scene plan
  app.post('/api/studio/generate-story', async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment.' });
    }
    const {
      topic,
      storyType = 'పిల్లల కథ',
      sceneCount = 3,
      language = 'te',
    } = req.body || {};

    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'Story topic is required' });
    }

    const count = Math.min(8, Math.max(2, Number(sceneCount) || 3));
    const langRule =
      language === 'en'
        ? 'Write the story, moral, and scene narrations in clear, vivid English, with Telugu subtitle translations.'
        : 'Write the story, moral, and scene narrations in natural, engaging Telugu (తెలుగు), with English subtitle translations.';

    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Write a ${count}-scene story on topic: "${topic}". Category: ${storyType}.`,
          config: {
            systemInstruction: `You are a master Telugu & English storyteller. ${langRule} Return JSON with title, moral, fullStory (formatted paragraphs), and ${count} scenes ready to turn into a video.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                moral: { type: Type.STRING },
                fullStory: { type: Type.STRING },
                scenes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      narration: { type: Type.STRING },
                      subtitleTe: { type: Type.STRING },
                      subtitleEn: { type: Type.STRING },
                      durationSec: { type: Type.INTEGER },
                      character: { type: Type.STRING },
                      setting: { type: Type.STRING },
                      skyTop: { type: Type.STRING },
                      skyBottom: { type: Type.STRING },
                      ground: { type: Type.STRING },
                      accent: { type: Type.STRING },
                    },
                    required: [
                      'title',
                      'narration',
                      'subtitleTe',
                      'subtitleEn',
                      'durationSec',
                      'character',
                      'setting',
                      'skyTop',
                      'skyBottom',
                      'ground',
                      'accent',
                    ],
                  },
                },
              },
              required: ['title', 'moral', 'fullStory', 'scenes'],
            },
          },
        })
      );

      const data = JSON.parse((response.text ?? '{}').trim());
      const scenes = (data.scenes || []).map((s: any, idx: number) => ({
        id: `story-sc-${Date.now()}-${idx}`,
        title: s.title || `Scene ${idx + 1}`,
        narration: s.narration || '',
        subtitleTe: s.subtitleTe || s.narration || '',
        subtitleEn: s.subtitleEn || s.narration || '',
        durationSec: Math.min(10, Math.max(4, Number(s.durationSec) || 6)),
        cameraMotion: 'ken-burns',
        weatherFx: 'golden-dust',
        backdropType: 'procedural',
        palette: {
          skyTop: normalizeHexColor(s.skyTop, '#0F172A'),
          skyBottom: normalizeHexColor(s.skyBottom, '#1E3A8A'),
          ground: normalizeHexColor(s.ground, '#14532D'),
          accent: normalizeHexColor(s.accent, '#F59E0B'),
        },
        cartoonElements: {
          character: ['rabbit', 'turtle', 'kid', 'elder', 'owl', 'robot'].includes(s.character)
            ? s.character
            : 'kid',
          setting: ['forest', 'village', 'ocean', 'mountains', 'temple', 'space', 'city'].includes(s.setting)
            ? s.setting
            : 'village',
          mood: 'sunny',
        },
      }));

      res.json({
        title: data.title || topic,
        moral: data.moral || '',
        fullStory: data.fullStory || '',
        scenes,
      });
    } catch (err: any) {
      handleGeminiError(res, err, '/api/studio/generate-story');
    }
  });

  // AI Game Maker Studio: design playable 2D games (Racing, Platformer, Puzzle, Quiz, Educational)
  app.post('/api/studio/generate-game', async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment.' });
    }
    const { prompt, genre = 'platformer', language = 'bilingual' } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Game prompt is required' });
    }

    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Design a playable 2D mini-game for: "${prompt}". Genre: ${genre}. Language: ${language}.`,
          config: {
            systemInstruction:
              'You are a creative 2D mobile game designer for Telugu and English creators. Generate a complete game configuration JSON with catchy Telugu & English title, storyTe, storyEn, concise instructions, fitting heroEmoji, enemyEmoji, collectibleEmoji, vibrant hex palette (heroColor, enemyColor, bgTop, bgBottom), speed (3-7), winScore (50-200), and 5 bilingual multiple-choice questions (4 options each, correctIndex 0-3) especially useful for quiz or educational games.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                storyTe: { type: Type.STRING },
                storyEn: { type: Type.STRING },
                instructions: { type: Type.STRING },
                heroEmoji: { type: Type.STRING },
                enemyEmoji: { type: Type.STRING },
                collectibleEmoji: { type: Type.STRING },
                heroColor: { type: Type.STRING },
                enemyColor: { type: Type.STRING },
                bgTop: { type: Type.STRING },
                bgBottom: { type: Type.STRING },
                speed: { type: Type.INTEGER },
                winScore: { type: Type.INTEGER },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      correctIndex: { type: Type.INTEGER },
                    },
                    required: ['question', 'options', 'correctIndex'],
                  },
                },
              },
              required: [
                'title',
                'storyTe',
                'storyEn',
                'instructions',
                'heroEmoji',
                'enemyEmoji',
                'collectibleEmoji',
                'heroColor',
                'enemyColor',
                'bgTop',
                'bgBottom',
                'speed',
                'winScore',
                'questions',
              ],
            },
          },
        })
      );

      const g = JSON.parse((response.text ?? '{}').trim());
      const now = new Date().toISOString();
      const game = {
        id: `game-${Date.now()}`,
        title: g.title || prompt.slice(0, 48),
        genre,
        prompt,
        storyTe: g.storyTe || '',
        storyEn: g.storyEn || '',
        instructions: g.instructions || 'Use arrow keys or touch controls to play.',
        heroEmoji: g.heroEmoji || '🦸',
        enemyEmoji: g.enemyEmoji || '👾',
        collectibleEmoji: g.collectibleEmoji || '⭐',
        heroColor: normalizeHexColor(g.heroColor, '#F59E0B'),
        enemyColor: normalizeHexColor(g.enemyColor, '#EF4444'),
        bgTop: normalizeHexColor(g.bgTop, '#0F172A'),
        bgBottom: normalizeHexColor(g.bgBottom, '#1E293B'),
        speed: Math.min(8, Math.max(2, Number(g.speed) || 4)),
        winScore: Math.min(300, Math.max(50, Number(g.winScore) || 100)),
        questions: Array.isArray(g.questions) ? g.questions.slice(0, 5) : [],
        createdAt: now,
        updatedAt: now,
      };

      const db = readDb();
      db.games.unshift(game);
      db.usageStats.totalGames = (db.usageStats.totalGames || 0) + 1;
      writeDb(db);
      recordGenerationLog('ai-game', `${game.title} (${genre})`, 'gemini-4-hydrogen');

      res.json({ game });
    } catch (err: any) {
      handleGeminiError(res, err, '/api/studio/generate-game');
    }
  });

  // AI Automatic Creation: generates complete Story + Scene Descriptions + Image Prompts + Music suggestion
  app.post('/api/studio/auto-create-plan', async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment.' });
    }
    const { prompt, durationSec = 30, language = 'bilingual', aspectRatio = '16:9' } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const numericTarget = Math.min(180, Math.max(10, Number(durationSec) || 30));
    const sceneCount = numericTarget <= 15 ? 3 : numericTarget <= 30 ? 5 : numericTarget <= 60 ? 7 : 9;
    const perScene = Math.max(3, Math.round(numericTarget / sceneCount));

    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Auto-plan a ${numericTarget}-second ${aspectRatio} video for: "${prompt}". Language mode: ${language}. Number of scenes: ${sceneCount}.`,
          config: {
            systemInstruction:
              'You are an automated AI Video Producer. Generate a full story, clear scene descriptions, rich image generation prompts for external image models, Telugu & English voiceover scripts, subtitles, and suggest one musicTrack from: kids-playful, cinematic-dawn, devotional-flute, shorts-beat, calm-documentary.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                videoTitle: { type: Type.STRING },
                storySummary: { type: Type.STRING },
                suggestedMusic: { type: Type.STRING },
                suggestedStyle: { type: Type.STRING },
                scenes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      sceneDescription: { type: Type.STRING },
                      imagePrompt: { type: Type.STRING },
                      narration: { type: Type.STRING },
                      subtitleTe: { type: Type.STRING },
                      subtitleEn: { type: Type.STRING },
                      character: { type: Type.STRING },
                      setting: { type: Type.STRING },
                      skyTop: { type: Type.STRING },
                      skyBottom: { type: Type.STRING },
                      ground: { type: Type.STRING },
                      accent: { type: Type.STRING },
                    },
                    required: [
                      'title',
                      'sceneDescription',
                      'imagePrompt',
                      'narration',
                      'subtitleTe',
                      'subtitleEn',
                      'character',
                      'setting',
                      'skyTop',
                      'skyBottom',
                      'ground',
                      'accent',
                    ],
                  },
                },
              },
              required: ['videoTitle', 'storySummary', 'suggestedMusic', 'suggestedStyle', 'scenes'],
            },
          },
        })
      );

      const data = JSON.parse((response.text ?? '{}').trim());
      const scenes = (data.scenes || []).map((s: any, idx: number) => ({
        id: `auto-sc-${Date.now()}-${idx}`,
        title: s.title || `Scene ${idx + 1}`,
        sceneDescription: s.sceneDescription || '',
        imagePrompt: s.imagePrompt || '',
        narration: s.narration || '',
        subtitleTe: s.subtitleTe || s.narration || '',
        subtitleEn: s.subtitleEn || s.narration || '',
        durationSec: perScene,
        cameraMotion: idx % 2 === 0 ? 'ken-burns' : 'zoom-in',
        weatherFx: 'golden-dust',
        transition: 'fade',
        backdropType: 'procedural',
        palette: {
          skyTop: normalizeHexColor(s.skyTop, '#0F172A'),
          skyBottom: normalizeHexColor(s.skyBottom, '#1E3A8A'),
          ground: normalizeHexColor(s.ground, '#14532D'),
          accent: normalizeHexColor(s.accent, '#F59E0B'),
        },
        cartoonElements: {
          character: ['rabbit', 'turtle', 'kid', 'elder', 'owl', 'robot'].includes(s.character)
            ? s.character
            : 'kid',
          setting: ['forest', 'village', 'ocean', 'mountains', 'temple', 'space', 'city'].includes(s.setting)
            ? s.setting
            : 'village',
          mood: 'sunny',
        },
      }));

      recordGenerationLog('auto-creator', `${data.videoTitle || prompt.slice(0, 40)}`, 'gemini-4-hydrogen');

      res.json({
        videoTitle: data.videoTitle || prompt.slice(0, 48),
        storySummary: data.storySummary || '',
        suggestedMusic: ['kids-playful', 'cinematic-dawn', 'devotional-flute', 'shorts-beat', 'calm-documentary'].includes(
          data.suggestedMusic
        )
          ? data.suggestedMusic
          : 'kids-playful',
        suggestedStyle: ['cartoon', 'realistic', 'anime', '3d-render', 'devotional', 'explainer'].includes(
          data.suggestedStyle
        )
          ? data.suggestedStyle
          : 'cartoon',
        scenes,
        capabilities: {
          rasterImageModelConnected: false,
          videoDiffusionModelConnected: false,
          ttsModelConnected: true,
        },
      });
    } catch (err: any) {
      handleGeminiError(res, err, '/api/studio/auto-create-plan');
    }
  });

  // Bilingual AI Assistant: workflow planning & creator help
  app.post('/api/studio/assistant', async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment.' });
    }
    const { message, language = 'te' } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    try {
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `User question/request: "${message}". Preferred response language: ${language === 'te' ? 'Telugu (తెలుగు) with helpful English terms' : 'English'}.`,
          config: {
            systemInstruction:
              'You are the helpful AI Creator Studio Assistant for AI VIDEO MAKER PRO. Answer concisely, plan actionable creative workflows for Video, Photo, Audio, Story, or 2D Games, suggest the best studio tool ("video" | "auto" | "photo" | "audio" | "story" | "game"), provide a ready-to-use suggestedPrompt, and list 3-5 clear workflowSteps.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reply: { type: Type.STRING },
                suggestedTool: { type: Type.STRING },
                suggestedPrompt: { type: Type.STRING },
                workflowSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['reply', 'suggestedTool', 'suggestedPrompt', 'workflowSteps'],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      recordGenerationLog('ai-assistant', message.slice(0, 60), 'gemini-4-hydrogen');
      res.json(parsed);
    } catch (err: any) {
      handleGeminiError(res, err, '/api/studio/assistant');
    }
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: !hmrDisabled,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`AI VIDEO MAKER PRO running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
