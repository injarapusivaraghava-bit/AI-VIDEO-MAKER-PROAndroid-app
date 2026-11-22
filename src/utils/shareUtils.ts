export async function shareMediaFile(params: {
  blob: Blob;
  fileName: string;
  title: string;
  text: string;
}): Promise<{ sharedNative: boolean }> {
  const { blob, fileName, title, text } = params;
  const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({
      title,
      text,
      files: [file],
    });
    return { sharedNative: true };
  }

  // Fallback on desktop browsers: download the file so user can attach to WhatsApp/Instagram
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return { sharedNative: false };
}

export function getWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function detectBestVideoExportCodec(): { mimeType: string; ext: 'mp4' | 'webm' } {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: 'video/webm', ext: 'webm' };
  }
  const mp4Candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
  ];
  for (const m of mp4Candidates) {
    if (MediaRecorder.isTypeSupported(m)) {
      return { mimeType: m, ext: 'mp4' };
    }
  }
  const webmCandidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (const m of webmCandidates) {
    if (MediaRecorder.isTypeSupported(m)) {
      return { mimeType: m, ext: 'webm' };
    }
  }
  return { mimeType: 'video/webm', ext: 'webm' };
}
