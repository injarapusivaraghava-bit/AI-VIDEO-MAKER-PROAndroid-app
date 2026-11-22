import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AdminSettings,
  SceneItem,
  UsageStats,
  VideoProject,
  YouTubeSeo,
} from '../types/studio';

export const ADMIN_EMAIL = 'injarapusivaraghava@gmail.com';

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  const s = typeof val === 'string' ? val.trim() : fallback;
  return s.slice(0, maxLen);
}

export function sanitizeId(raw: string, prefix = 'id'): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 128);
  if (cleaned.length >= 1 && VALID_ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${prefix}_${Date.now()}`;
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (val && typeof (val as any).toDate === 'function') {
    return (val as any).toDate().toISOString();
  }
  if (typeof val === 'string' && val.length > 0) {
    return val;
  }
  return new Date().toISOString();
}

export async function ensureUserProfile(user: User): Promise<void> {
  const uid = sanitizeId(user.uid, 'user');
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  const displayName = clampStr(user.displayName || user.email?.split('@')[0] || 'Creator', 120, 'Creator');
  const photoURL = user.photoURL ? clampStr(user.photoURL, 512) : '';

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        uid,
        displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (photoURL) payload.photoURL = photoURL;
      await setDoc(userRef, payload);
    } else {
      const payload: Record<string, unknown> = {
        displayName,
        updatedAt: serverTimestamp(),
      };
      if (photoURL) payload.photoURL = photoURL;
      await updateDoc(userRef, payload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }

  if (user.email) {
    const privatePath = `users/${uid}/private/info`;
    const privateRef = doc(db, 'users', uid, 'private', 'info');
    try {
      const privSnap = await getDoc(privateRef);
      const email = clampStr(user.email, 254);
      if (!privSnap.exists()) {
        await setDoc(privateRef, {
          uid,
          email,
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(privateRef, {
          email,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, privatePath);
    }
  }
}

function sanitizeSceneForFirestore(sc: SceneItem, idx: number): Record<string, unknown> {
  const safeImageUrl =
    sc.imageUrl && !sc.imageUrl.startsWith('data:')
      ? clampStr(sc.imageUrl, 512)
      : undefined;

  const clean: Record<string, unknown> = {
    id: sanitizeId(sc.id || `scene_${idx + 1}`, `scene_${idx}`),
    title: clampStr(sc.title || `Scene ${idx + 1}`, 200, `Scene ${idx + 1}`),
    narration: clampStr(sc.narration, 2000),
    subtitleTe: clampStr(sc.subtitleTe, 1000),
    subtitleEn: clampStr(sc.subtitleEn, 1000),
    visualCallout: clampStr(sc.visualCallout, 200),
    durationSec: Math.min(60, Math.max(1, Math.round(Number(sc.durationSec) || 5))),
    speed: Math.min(2, Math.max(0.5, Number(sc.speed || 1))),
    rotation: sc.rotation || 0,
    cropZoom: Math.min(2, Math.max(1, Number(sc.cropZoom || 1))),
    fitMode: sc.fitMode === 'contain' ? 'contain' : 'cover',
    sticker: clampStr(sc.sticker, 16),
    enhance: Boolean(sc.enhance),
    chromaKey: Boolean(sc.chromaKey),
    sfx: sc.sfx || 'none',
    cameraMotion: sc.cameraMotion || 'ken-burns',
    weatherFx: sc.weatherFx || 'none',
    filterPreset: sc.filterPreset || 'none',
    transition: sc.transition || 'fade',
    backdropType: safeImageUrl ? sc.backdropType || 'template' : 'procedural',
    palette: {
      skyTop: clampStr(sc.palette?.skyTop, 16, '#0F172A'),
      skyBottom: clampStr(sc.palette?.skyBottom, 16, '#1E3A8A'),
      ground: clampStr(sc.palette?.ground, 16, '#14532D'),
      accent: clampStr(sc.palette?.accent, 16, '#F59E0B'),
    },
    cartoonElements: {
      character: sc.cartoonElements?.character || 'none',
      secondaryCharacter: sc.cartoonElements?.secondaryCharacter || 'none',
      setting: sc.cartoonElements?.setting || 'forest',
      mood: sc.cartoonElements?.mood || 'sunny',
    },
  };

  if (safeImageUrl) {
    clean.imageUrl = safeImageUrl;
  }
  return clean;
}

function sanitizeYoutubeSeoForFirestore(seo: YouTubeSeo): Record<string, unknown> {
  const clean: Record<string, unknown> = {
    title: clampStr(seo.title, 200),
    description: clampStr(seo.description, 5000),
    tags: Array.isArray(seo.tags) ? seo.tags.slice(0, 30).map((t) => clampStr(t, 60)) : [],
    hashtags: Array.isArray(seo.hashtags) ? seo.hashtags.slice(0, 15).map((h) => clampStr(h, 60)) : [],
    thumbnailHook: clampStr(seo.thumbnailHook, 160),
    uploadedStatus: ['draft', 'ready', 'uploaded'].includes(seo.uploadedStatus)
      ? seo.uploadedStatus
      : 'draft',
  };
  if (seo.uploadedAt) {
    clean.uploadedAt = clampStr(seo.uploadedAt, 64);
  }
  return clean;
}

export function sanitizeProjectForFirestore(project: VideoProject, ownerId: string) {
  const id = sanitizeId(project.id, 'proj');
  const validModes = ['text-to-video', 'image-to-video', 'cartoon-maker', 'story-maker'];
  const validStyles = ['cartoon', 'realistic', 'anime', '3d-render', 'devotional', 'explainer'];
  const validVoices = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];
  const validVoiceStyles = ['storyteller', 'cartoon', 'documentary', 'energetic'];
  const validMusic = [
    'none',
    'cinematic-dawn',
    'kids-playful',
    'devotional-flute',
    'shorts-beat',
    'calm-documentary',
  ];
  const validSubtitles = ['cinema', 'shorts-pop', 'minimal', 'off'];

  const boundedScenes = (project.scenes?.length ? project.scenes : [])
    .slice(0, 15)
    .map((sc, idx) => sanitizeSceneForFirestore(sc, idx));

  if (boundedScenes.length === 0) {
    boundedScenes.push({
      id: `scene_1`,
      title: 'Scene 1',
      narration: '',
      subtitleTe: '',
      subtitleEn: '',
      visualCallout: '',
      durationSec: 5,
      cameraMotion: 'ken-burns',
      weatherFx: 'none',
      backdropType: 'procedural',
      palette: { skyTop: '#0F172A', skyBottom: '#1E3A8A', ground: '#14532D', accent: '#F59E0B' },
      cartoonElements: { character: 'none', secondaryCharacter: 'none', setting: 'forest', mood: 'sunny' },
    });
  }

  const base: Record<string, unknown> = {
    id,
    ownerId: sanitizeId(ownerId, 'user'),
    title: clampStr(project.title || 'Untitled AI Video', 200, 'Untitled AI Video'),
    mode: validModes.includes(project.mode) ? project.mode : 'text-to-video',
    style: validStyles.includes(project.style) ? project.style : 'cartoon',
    aspectRatio: project.aspectRatio === '9:16' ? '9:16' : '16:9',
    contentLanguage: ['te', 'en', 'bilingual'].includes(project.contentLanguage)
      ? project.contentLanguage
      : 'bilingual',
    prompt: clampStr(project.prompt, 2000),
    voiceName: validVoices.includes(project.voiceName) ? project.voiceName : 'Kore',
    voiceStyle: validVoiceStyles.includes(project.voiceStyle) ? project.voiceStyle : 'storyteller',
    musicTrack: validMusic.includes(project.musicTrack) ? project.musicTrack : 'none',
    musicVolume: Math.min(1, Math.max(0, Number(project.musicVolume ?? 0.25))),
    voiceVolume: Math.min(1, Math.max(0, Number(project.voiceVolume ?? 1.0))),
    subtitleStyle: validSubtitles.includes(project.subtitleStyle) ? project.subtitleStyle : 'cinema',
    scenes: boundedScenes,
    exportCount: Math.min(100000, Math.max(0, Math.round(Number(project.exportCount || 0)))),
  };

  if (typeof project.targetDurationSec === 'number') {
    base.targetDurationSec = Math.min(120, Math.max(5, Math.round(project.targetDurationSec)));
  }

  if (project.youtubeSeo) {
    base.youtubeSeo = sanitizeYoutubeSeoForFirestore(project.youtubeSeo);
  }

  return { id, data: base };
}

export async function saveUserProjectToFirestore(
  uid: string,
  project: VideoProject
): Promise<VideoProject> {
  const safeUid = sanitizeId(uid, 'user');
  const { id, data } = sanitizeProjectForFirestore(project, safeUid);
  const path = `users/${safeUid}/projects/${id}`;
  const ref = doc(db, 'users', safeUid, 'projects', id);

  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const { id: _id, ownerId: _ownerId, exportCount: _exp, ...updatable } = data;
      await updateDoc(ref, {
        ...updatable,
        updatedAt: serverTimestamp(),
      });
    }
    return {
      ...project,
      id,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function incrementProjectExportInFirestore(
  uid: string,
  projectId: string
): Promise<void> {
  const safeUid = sanitizeId(uid, 'user');
  const safeProjId = sanitizeId(projectId, 'proj');
  const path = `users/${safeUid}/projects/${safeProjId}`;
  const ref = doc(db, 'users', safeUid, 'projects', safeProjId);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const currentCount = Number(snap.data()?.exportCount || 0);
    await updateDoc(ref, {
      exportCount: Math.min(100000, currentCount + 1),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteUserProjectFromFirestore(
  uid: string,
  projectId: string
): Promise<void> {
  const safeUid = sanitizeId(uid, 'user');
  const safeProjId = sanitizeId(projectId, 'proj');
  const path = `users/${safeUid}/projects/${safeProjId}`;

  try {
    await deleteDoc(doc(db, 'users', safeUid, 'projects', safeProjId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeUserProjects(
  uid: string,
  onData: (projects: VideoProject[]) => void
): Unsubscribe {
  const safeUid = sanitizeId(uid, 'user');
  const path = `users/${safeUid}/projects`;
  const q = query(collection(db, 'users', safeUid, 'projects'), where('ownerId', '==', safeUid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: VideoProject[] = snapshot.docs.map((d) => {
        const raw = d.data() as any;
        return {
          ...raw,
          id: raw.id || d.id,
          createdAt: timestampToIso(raw.createdAt),
          updatedAt: timestampToIso(raw.updatedAt),
        } as VideoProject;
      });
      list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeStudioConfig(
  onData: (settings: Partial<Omit<AdminSettings, 'adminPin'>>) => void
): Unsubscribe {
  const path = 'studioConfig/public';
  return onSnapshot(
    doc(db, 'studioConfig', 'public'),
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() as any;
      onData({
        studioName: d.studioName,
        proprietorName: d.proprietorName,
        adminNote: d.adminNote || '',
        freeDailyLimit: d.freeDailyLimit,
        watermarkEnabled: Boolean(d.watermarkEnabled),
        watermarkText: d.watermarkText,
        enableCartoon: Boolean(d.enableCartoon),
        enableRealistic: Boolean(d.enableRealistic),
        enableImageToVideo: Boolean(d.enableImageToVideo),
        pricingMode: d.pricingMode === 'freemium' ? 'freemium' : 'free-starter',
        proMonthlyInr: Number(d.proMonthlyInr ?? 199),
        maintenanceMode: Boolean(d.maintenanceMode),
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function saveStudioConfigToFirestore(
  uid: string,
  settings: Omit<AdminSettings, 'adminPin'>
): Promise<void> {
  const safeUid = sanitizeId(uid, 'admin');
  const path = 'studioConfig/public';
  const ref = doc(db, 'studioConfig', 'public');

  const payload = {
    studioName: clampStr(settings.studioName || 'AI VIDEO MAKER PRO', 100, 'AI VIDEO MAKER PRO'),
    proprietorName: clampStr(settings.proprietorName || 'Injarapu Siva Raghava', 100, 'Injarapu Siva Raghava'),
    adminNote: clampStr(settings.adminNote, 500),
    freeDailyLimit: Math.min(1000, Math.max(1, Math.round(Number(settings.freeDailyLimit) || 25))),
    watermarkEnabled: Boolean(settings.watermarkEnabled),
    watermarkText: clampStr(settings.watermarkText, 100),
    enableCartoon: Boolean(settings.enableCartoon),
    enableRealistic: Boolean(settings.enableRealistic),
    enableImageToVideo: Boolean(settings.enableImageToVideo),
    pricingMode: settings.pricingMode === 'freemium' ? 'freemium' : 'free-starter',
    proMonthlyInr: Math.min(100000, Math.max(0, Math.round(Number(settings.proMonthlyInr) || 199))),
    maintenanceMode: Boolean(settings.maintenanceMode),
    updatedBy: safeUid,
    updatedAt: serverTimestamp(),
  };

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, payload);
    } else {
      await updateDoc(ref, payload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeUserStats(
  uid: string,
  onStats: (stats: UsageStats) => void
): Unsubscribe {
  const safeUid = sanitizeId(uid, 'user');
  const path = `users/${safeUid}/stats/summary`;

  return onSnapshot(
    doc(db, 'users', safeUid, 'stats', 'summary'),
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() as any;
      onStats({
        totalStoryboards: Number(d.totalStoryboards || 0),
        totalVoices: Number(d.totalVoices || 0),
        totalExports: Number(d.totalExports || 0),
        totalYouTubePreps: Number(d.totalYouTubePreps || 0),
        todayCount: Number(d.todayCount || 0),
        lastResetDate: String(d.lastResetDate || new Date().toISOString().slice(0, 10)),
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function syncUserStatsToFirestore(uid: string, stats: UsageStats): Promise<void> {
  const safeUid = sanitizeId(uid, 'user');
  const path = `users/${safeUid}/stats/summary`;
  const ref = doc(db, 'users', safeUid, 'stats', 'summary');

  const payload = {
    ownerId: safeUid,
    totalStoryboards: Math.min(1000000, Math.max(0, Math.round(stats.totalStoryboards || 0))),
    totalVoices: Math.min(1000000, Math.max(0, Math.round(stats.totalVoices || 0))),
    totalExports: Math.min(1000000, Math.max(0, Math.round(stats.totalExports || 0))),
    totalYouTubePreps: Math.min(1000000, Math.max(0, Math.round(stats.totalYouTubePreps || 0))),
    todayCount: Math.min(10000, Math.max(0, Math.round(stats.todayCount || 0))),
    lastResetDate: clampStr(stats.lastResetDate || new Date().toISOString().slice(0, 10), 20),
    updatedAt: serverTimestamp(),
  };

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, payload);
    } else {
      const { ownerId: _ownerId, ...updatable } = payload;
      await updateDoc(ref, updatable);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
