# AI VIDEO MAKER PRO — Android APK Conversion & API Setup Guide

## 1. Local vs External AI / Cloud Requirements
- **Runs 100% locally in the browser / Android WebView (no external API needed)**:
  - Video Editor (Trim, Cut, Split, Merge, Reorder, Duplicate, Transitions, Color Filters, On-screen Text Overlays, Subtitles `.SRT`)
  - Canvas Video Rendering & Download (MP4 when device codec `avc1` is available, WebM VP9/VP8 fallback)
  - Photo Editor & Thumbnail/Poster Maker (Upload, Filters, Brightness/Contrast/Saturation, Rotate/Flip, Headline Badges, Logo Stamp, PNG export)
  - Voice Recorder & Audio Editor (Microphone Recording, WAV/MP3 Upload, Trim, Speed `0.85x–1.30x`, Tone EQ, Fade In/Out, WAV export)
  - Web Share API (WhatsApp & Instagram direct mobile media sharing)
- **Requires Server Environment / External API Configuration**:
  - `GEMINI_API_KEY` on Node/Express server (`server.ts`) for:
    - AI Text-to-Video Storyboard & Script Generation (`/api/studio/generate-storyboard`)
    - AI Photo & Prompt Generation (`/api/studio/generate-photo`)
    - Telugu & English AI Voice Synthesis (`/api/studio/generate-voice`)
    - AI Telugu Story Planner (`/api/studio/generate-story`)
    - AI YouTube SEO Generator (`/api/studio/youtube-seo`)
  - **Firebase Firestore & Auth** (`firebase-applet-config.json`): Cloud Project Sync & Admin Config
  - **Google Drive OAuth** (`set_up_oauth`): Saving & browsing videos, photos, audio, and backups in Google Drive

## 2. Converting to Android APK (Two Supported Paths)

### Option A: Capacitor Android APK (Recommended for Play Store / Standalone APK)
Because the app calls `/api/*` backend routes for Gemini AI features, set `server.url` in `capacitor.config.json` to your deployed Cloud Run URL (or point frontend `fetch('/api/...')` calls to your hosted backend URL) before building the APK:
```bash
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
npx cap open android   # Builds signed/debug .apk in Android Studio -> Build APK
```

### Option B: Bubblewrap TWA APK (Directly wraps your live HTTPS PWA URL)
Since `vite-plugin-pwa` generates `/manifest.webmanifest`, service worker, and adaptive maskable icons (`192x192`, `512x512`):
```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://YOUR_DEPLOYED_APP_URL/manifest.webmanifest
bubblewrap build
```
This outputs `app-release-signed.apk` ready for Android devices and Google Play Store.
