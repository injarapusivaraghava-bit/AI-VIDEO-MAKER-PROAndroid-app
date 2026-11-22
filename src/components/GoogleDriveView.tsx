import React, { useEffect, useRef, useState } from 'react';
import {
  HardDrive,
  Search,
  RefreshCw,
  Upload,
  FolderOpen,
  ExternalLink,
  Trash2,
  Pencil,
  Film,
  Image as ImageIcon,
  Mic,
  FileJson,
  File as FileIcon,
  Loader2,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { LanguageMode, VideoProject } from '../types/studio';
import { useFirebase } from '../contexts/FirebaseContext';
import {
  deleteDriveFile,
  downloadDriveFileBlob,
  DriveAuthError,
  DriveFileItem,
  DriveFilterCategory,
  listDriveFiles,
  renameDriveFile,
  uploadBlobToDrive,
} from '../utils/googleDriveService';
import { blobToBase64, encodeWavFromAudioBuffer } from '../utils/audioEngine';
import { GoogleSignInButton } from './GoogleSignInButton';

interface GoogleDriveViewProps {
  lang: LanguageMode;
  currentProject: VideoProject;
  onImportPhotoToStudio: (dataUrl: string, title: string) => void;
  onImportAudioToStudio: (base64: string, title: string) => void;
  onImportProjectFromDrive: (project: VideoProject) => void;
}

type PendingConfirmation =
  | { type: 'delete'; file: DriveFileItem }
  | { type: 'rename'; file: DriveFileItem; nextName: string };

function formatFileSize(bytesStr?: string): string {
  const bytes = Number(bytesStr || 0);
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const GoogleDriveView: React.FC<GoogleDriveViewProps> = ({
  lang,
  currentProject,
  onImportPhotoToStudio,
  onImportAudioToStudio,
  onImportProjectFromDrive,
}) => {
  const { driveToken, signingIn, connectGoogleDrive, clearDriveToken } = useFirebase();
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<DriveFilterCategory>('all');
  const [studioOnly, setStudioOnly] = useState(true);

  const [renameTarget, setRenameTarget] = useState<DriveFileItem | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmModal, setConfirmModal] = useState<PendingConfirmation | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadFiles = async (tokenOverride?: string) => {
    const token = tokenOverride || driveToken;
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await listDriveFiles({ token, query: search, category, studioOnly });
      setFiles(res.files);
    } catch (err: any) {
      if (err instanceof DriveAuthError) {
        clearDriveToken();
      }
      setError(err?.message || 'Failed to list Google Drive files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (driveToken) {
      void loadFiles(driveToken);
    }
  }, [driveToken, category, studioOnly]);

  const handleConnect = async () => {
    setError('');
    const token = await connectGoogleDrive();
    if (token) {
      await loadFiles(token);
    }
  };

  const handleUploadDeviceFile = async (fileList: FileList | null) => {
    if (!fileList || !fileList[0] || !driveToken) return;
    const file = fileList[0];
    setUploading(true);
    setError('');
    setNotice('');
    try {
      await uploadBlobToDrive({
        token: driveToken,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        blob: file,
        description: 'Uploaded from AI VIDEO MAKER PRO',
        useStudioFolder: true,
      });
      setNotice(
        lang === 'te' ? `"${file.name}" Google Drive లో సేవ్ అయింది.` : `"${file.name}" saved to Google Drive.`
      );
      await loadFiles();
    } catch (err: any) {
      if (err instanceof DriveAuthError) clearDriveToken();
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleBackupCurrentProject = async () => {
    if (!driveToken) return;
    setUploading(true);
    setError('');
    setNotice('');
    try {
      const jsonBlob = new Blob([JSON.stringify(currentProject, null, 2)], {
        type: 'application/json',
      });
      const safeTitle = (currentProject.title || 'ai_video_project').replace(/\s+/g, '_');
      await uploadBlobToDrive({
        token: driveToken,
        fileName: `${safeTitle}.json`,
        mimeType: 'application/json',
        blob: jsonBlob,
        description: 'AI VIDEO MAKER PRO Project Backup',
        useStudioFolder: true,
      });
      setNotice(
        lang === 'te'
          ? 'ప్రస్తుత వీడియో ప్రాజెక్ట్ Google Drive లో బ్యాకప్ అయింది.'
          : 'Current project backed up to Google Drive.'
      );
      await loadFiles();
    } catch (err: any) {
      if (err instanceof DriveAuthError) clearDriveToken();
      setError(err?.message || 'Backup failed');
    } finally {
      setUploading(false);
    }
  };

  const handleUseInStudio = async (file: DriveFileItem) => {
    if (!driveToken) return;
    setBusyId(file.id);
    setError('');
    try {
      const blob = await downloadDriveFileBlob(driveToken, file.id);
      if (file.mimeType.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          onImportPhotoToStudio(String(reader.result || ''), file.name.replace(/\.[^.]+$/, ''));
        };
        reader.readAsDataURL(blob);
      } else if (file.mimeType.startsWith('audio/')) {
        const arr = await blob.arrayBuffer();
        const ctx = new AudioContext();
        try {
          const decoded = await ctx.decodeAudioData(arr);
          const wavBlob = encodeWavFromAudioBuffer(decoded);
          const base64 = await blobToBase64(wavBlob);
          onImportAudioToStudio(base64, file.name.replace(/\.[^.]+$/, ''));
        } finally {
          await ctx.close().catch(() => {});
        }
      } else if (file.mimeType === 'application/json' || file.name.endsWith('.json')) {
        const text = await blob.text();
        const parsed = JSON.parse(text) as VideoProject;
        if (parsed && Array.isArray(parsed.scenes)) {
          onImportProjectFromDrive(parsed);
        } else {
          throw new Error('Selected JSON is not a valid AI VIDEO MAKER PRO project.');
        }
      }
    } catch (err: any) {
      if (err instanceof DriveAuthError) clearDriveToken();
      setError(err?.message || 'Failed to import file from Google Drive');
    } finally {
      setBusyId(null);
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmModal || !driveToken) return;
    setConfirmLoading(true);
    setError('');
    setNotice('');
    try {
      if (confirmModal.type === 'delete') {
        await deleteDriveFile(driveToken, confirmModal.file.id);
        setFiles((prev) => prev.filter((f) => f.id !== confirmModal.file.id));
        setNotice(
          lang === 'te'
            ? `"${confirmModal.file.name}" Google Drive నుండి తొలగించబడింది.`
            : `"${confirmModal.file.name}" deleted from Google Drive.`
        );
      } else if (confirmModal.type === 'rename') {
        const updated = await renameDriveFile(driveToken, confirmModal.file.id, confirmModal.nextName);
        setFiles((prev) => prev.map((f) => (f.id === updated.id ? { ...f, name: updated.name } : f)));
        setNotice(
          lang === 'te'
            ? `ఫైల్ పేరు "${updated.name}" గా మార్చబడింది.`
            : `Renamed file to "${updated.name}".`
        );
      }
      setConfirmModal(null);
      setRenameTarget(null);
    } catch (err: any) {
      if (err instanceof DriveAuthError) clearDriveToken();
      setError(err?.message || 'Google Drive operation failed');
    } finally {
      setConfirmLoading(false);
    }
  };

  const renderIcon = (mime: string) => {
    if (mime.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-sky-400" />;
    if (mime.startsWith('audio/')) return <Mic className="w-5 h-5 text-emerald-400" />;
    if (mime.startsWith('video/')) return <Film className="w-5 h-5 text-amber-400" />;
    if (mime === 'application/json') return <FileJson className="w-5 h-5 text-violet-400" />;
    return <FileIcon className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <HardDrive className="w-6 h-6 text-amber-400" />
            <span>{lang === 'te' ? 'Google Drive స్టూడియో స్టోరేజ్' : 'Google Drive Studio Storage'}</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {lang === 'te'
              ? 'మీ AI వీడియోలు, ఫొటోలు, వాయిస్ ఆడియోలు మరియు ప్రాజెక్టులను నేరుగా మీ Google Drive లో సేవ్ చేసి వాడుకోండి.'
              : 'Browse your Google Drive, import photos/audio/projects into the studio, and save finished exports directly to Drive.'}
          </p>
        </div>

        {driveToken && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => handleUploadDeviceFile(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-100 text-xs font-medium flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-amber-400" />}
              <span>{lang === 'te' ? 'Drive కు అప్లోడ్' : 'Upload to Drive'}</span>
            </button>

            <button
              type="button"
              onClick={handleBackupCurrentProject}
              disabled={uploading}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 text-xs font-semibold flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <FileJson className="w-4 h-4" />
              <span>{lang === 'te' ? 'ప్రస్తుత ప్రాజెక్ట్ సేవ్' : 'Save Current Project'}</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-xs underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {!driveToken ? (
        <div className="bg-[#13161F] border border-white/10 rounded-2xl p-8 sm:p-10 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
            <HardDrive className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-semibold text-slate-100">
            {lang === 'te' ? 'Google Drive ను కనెక్ట్ చేయండి' : 'Connect Your Google Drive'}
          </h2>
          <p className="text-sm text-slate-400 max-w-md leading-relaxed">
            {lang === 'te'
              ? 'Google ఖాతాతో సైన్-ఇన్ చేసి మీ Drive లోని ఫొటోలు & వాయిస్ ఫైళ్లను ఎడిట్ చేయండి లేదా తయారు చేసిన వీడియోలను సేవ్ చేయండి.'
              : 'Sign in with Google to authorize Google Drive access. Your token stays strictly in memory for this session.'}
          </p>
          <GoogleSignInButton
            onClick={handleConnect}
            disabled={signingIn}
            label={
              signingIn
                ? '...'
                : lang === 'te'
                  ? 'Google Drive తో సైన్-ఇన్ చేయండి'
                  : 'Sign in with Google'
            }
          />
        </div>
      ) : (
        <>
          {/* Search & Filter Toolbar */}
          <div className="bg-[#13161F] border border-white/10 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void loadFiles();
                  }}
                  placeholder={lang === 'te' ? 'Google Drive ఫైళ్లు వెతకండి...' : 'Search Drive files...'}
                  className="w-full min-h-[40px] bg-[#0B0D12] border border-white/10 rounded-xl pl-10 pr-4 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="button"
                onClick={() => void loadFiles()}
                disabled={loading}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{lang === 'te' ? 'రిఫ్రెష్' : 'Refresh'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-[#0B0D12] border border-white/10 rounded-xl">
                {(
                  [
                    { id: 'all', labelTe: 'అన్నీ', labelEn: 'All' },
                    { id: 'image', labelTe: 'ఫొటోలు', labelEn: 'Images' },
                    { id: 'audio', labelTe: 'ఆడియో', labelEn: 'Audio' },
                    { id: 'video', labelTe: 'వీడియోలు', labelEn: 'Videos' },
                    { id: 'project', labelTe: 'ప్రాజెక్టులు', labelEn: 'Projects' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                      category === cat.id
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {lang === 'te' ? cat.labelTe : cat.labelEn}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 bg-[#0B0D12] border border-white/10 rounded-xl px-3 min-h-[40px] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={studioOnly}
                  onChange={(e) => setStudioOnly(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
                <span>{lang === 'te' ? 'స్టూడియో ఫోల్డర్ మాత్రమే' : 'Studio Folder Only'}</span>
              </label>
            </div>
          </div>

          {/* Drive Files Grid */}
          {loading && files.length === 0 ? (
            <div className="bg-[#13161F] border border-white/10 rounded-2xl p-12 flex items-center justify-center gap-3 text-slate-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
              <span>{lang === 'te' ? 'Google Drive ఫైళ్లు లోడ్ అవుతున్నాయి...' : 'Loading Google Drive files...'}</span>
            </div>
          ) : files.length === 0 ? (
            <div className="bg-[#13161F] border border-white/10 rounded-2xl p-10 text-center flex flex-col items-center gap-3">
              <FolderOpen className="w-10 h-10 text-slate-600" />
              <p className="text-sm text-slate-400 max-w-md">
                {studioOnly
                  ? lang === 'te'
                    ? 'మీ "AI VIDEO MAKER PRO" Google Drive ఫోల్డర్ ఖాళీగా ఉంది. ఏదైనా ఫైల్ అప్లోడ్ చేయండి లేదా "Studio Folder Only" ఆఫ్ చేసి మీ Drive ఫైళ్లు చూడండి.'
                    : 'Your "AI VIDEO MAKER PRO" Drive folder has no matching files yet. Upload a file or uncheck "Studio Folder Only" to browse all your Drive files.'
                  : lang === 'te'
                    ? 'సరిపోయే ఫైళ్లు దొరకలేదు.'
                    : 'No matching files found in your Google Drive.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {files.map((file) => {
                const isImage = file.mimeType.startsWith('image/');
                const isAudio = file.mimeType.startsWith('audio/');
                const isJson = file.mimeType === 'application/json' || file.name.endsWith('.json');
                const isBusy = busyId === file.id;

                return (
                  <div
                    key={file.id}
                    className="bg-[#13161F] border border-white/10 rounded-2xl p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#0B0D12] border border-white/10 flex items-center justify-center shrink-0">
                        {renderIcon(file.mimeType)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-100 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-400 font-mono-tabular mt-0.5">
                          {formatFileSize(file.size)} ·{' '}
                          {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}
                        </p>
                      </div>
                    </div>

                    {renameTarget?.id === file.id && (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          className="flex-1 min-h-[36px] bg-[#0B0D12] border border-amber-500/50 rounded-lg px-2.5 text-xs text-slate-100 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (renameDraft.trim() && renameDraft.trim() !== file.name) {
                              setConfirmModal({ type: 'rename', file, nextName: renameDraft.trim() });
                            }
                          }}
                          className="min-h-[36px] px-3 rounded-lg bg-amber-500 text-slate-950 text-xs font-semibold cursor-pointer"
                        >
                          {lang === 'te' ? 'మార్చు' : 'Save'}
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                      {(isImage || isAudio || isJson) ? (
                        <button
                          type="button"
                          onClick={() => void handleUseInStudio(file)}
                          disabled={isBusy}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                          <span>
                            {isImage
                              ? lang === 'te'
                                ? 'ఫొటో ఎడిటర్ లో తెరవండి'
                                : 'Use in Photo Studio'
                              : isAudio
                                ? lang === 'te'
                                  ? 'వాయిస్ ఎడిటర్ లో తెరవండి'
                                  : 'Use in Voice Studio'
                                : lang === 'te'
                                  ? 'ప్రాజెక్ట్ లోడ్ చేయండి'
                                  : 'Open Project'}
                          </span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500 truncate max-w-[140px]">
                          {file.mimeType.split('/').pop()}
                        </span>
                      )}

                      <div className="flex items-center gap-1">
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-300"
                            title={lang === 'te' ? 'Drive లో చూడండి' : 'View in Google Drive'}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (renameTarget?.id === file.id) {
                              setRenameTarget(null);
                            } else {
                              setRenameTarget(file);
                              setRenameDraft(file.name);
                            }
                          }}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                          title={lang === 'te' ? 'పేరు మార్చండి' : 'Rename file'}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfirmModal({ type: 'delete', file })}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 cursor-pointer"
                          title={lang === 'te' ? 'తొలగించండి' : 'Delete from Drive'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Mandatory Explicit Confirmation Modal for Rename / Delete on Google Drive */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#13161F] border border-white/15 rounded-2xl max-w-md w-full p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {confirmModal.type === 'delete'
                    ? lang === 'te'
                      ? 'Google Drive ఫైల్ తొలగించాలా?'
                      : 'Delete File from Google Drive?'
                    : lang === 'te'
                      ? 'Google Drive ఫైల్ పేరు మార్చాలా?'
                      : 'Rename File in Google Drive?'}
                </h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {confirmModal.type === 'delete'
                    ? lang === 'te'
                      ? `"${confirmModal.file.name}" ఫైల్‌ను మీ Google Drive నుండి శాశ్వతంగా తొలగించాలనుకుంటున్నారా?`
                      : `Are you sure you want to permanently delete "${confirmModal.file.name}" from your Google Drive? This action cannot be undone.`
                    : lang === 'te'
                      ? `"${confirmModal.file.name}" పేరును "${confirmModal.nextName}" గా Google Drive లో మార్చాలా?`
                      : `Update the name of "${confirmModal.file.name}" to "${confirmModal.nextName}" in your Google Drive?`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={confirmLoading}
                onClick={() => setConfirmModal(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium cursor-pointer"
              >
                {lang === 'te' ? 'రద్దు చేయండి' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={confirmLoading}
                onClick={() => void executeConfirmedAction()}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  confirmModal.type === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                {confirmLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {confirmModal.type === 'delete'
                    ? lang === 'te'
                      ? 'తొలగించండి'
                      : 'Confirm Delete'
                    : lang === 'te'
                      ? 'పేరు మార్చండి'
                      : 'Confirm Rename'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
