export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  iconLink?: string;
  parents?: string[];
}

export type DriveFilterCategory = 'all' | 'image' | 'audio' | 'video' | 'project';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const STUDIO_FOLDER_NAME = 'AI VIDEO MAKER PRO';

export class DriveAuthError extends Error {
  constructor(message = 'Google Drive session expired. Please reconnect.') {
    super(message);
    this.name = 'DriveAuthError';
  }
}

async function handleDriveResponse(res: Response) {
  if (res.status === 401) {
    throw new DriveAuthError('Google Drive access token expired. Please sign in again.');
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody?.error?.message || `Google Drive API error (${res.status})`;
    throw new Error(msg);
  }
  return res;
}

export async function ensureStudioDriveFolder(token: string): Promise<string> {
  const q = encodeURIComponent(
    `name='${STUDIO_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const searchRes = await handleDriveResponse(
    await fetch(`${DRIVE_API_BASE}/files?q=${q}&fields=files(id,name)&pageSize=5`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  const searchData = await searchRes.json();
  if (Array.isArray(searchData.files) && searchData.files.length > 0) {
    return searchData.files[0].id as string;
  }

  const createRes = await handleDriveResponse(
    await fetch(`${DRIVE_API_BASE}/files?fields=id,name`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: STUDIO_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    })
  );
  const created = await createRes.json();
  return created.id as string;
}

export async function listDriveFiles(params: {
  token: string;
  query?: string;
  category?: DriveFilterCategory;
  studioOnly?: boolean;
}): Promise<{ files: DriveFileItem[]; studioFolderId?: string }> {
  const { token, query, category = 'all', studioOnly = false } = params;
  const clauses: string[] = ['trashed = false'];

  let studioFolderId: string | undefined;
  if (studioOnly) {
    studioFolderId = await ensureStudioDriveFolder(token);
    clauses.push(`'${studioFolderId}' in parents`);
  }

  if (query && query.trim()) {
    const escaped = query.trim().replace(/'/g, "\\'");
    clauses.push(`name contains '${escaped}'`);
  }

  if (category === 'image') {
    clauses.push("mimeType contains 'image/'");
  } else if (category === 'audio') {
    clauses.push("mimeType contains 'audio/'");
  } else if (category === 'video') {
    clauses.push("mimeType contains 'video/'");
  } else if (category === 'project') {
    clauses.push("(mimeType = 'application/json' or name contains '.json')");
  } else {
    clauses.push("mimeType != 'application/vnd.google-apps.folder'");
  }

  const url =
    `${DRIVE_API_BASE}/files?` +
    new URLSearchParams({
      q: clauses.join(' and '),
      orderBy: 'modifiedTime desc',
      pageSize: '40',
      fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,iconLink,parents)',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    }).toString();

  const res = await handleDriveResponse(
    await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  const data = await res.json();
  return {
    files: Array.isArray(data.files) ? (data.files as DriveFileItem[]) : [],
    studioFolderId,
  };
}

export async function uploadBlobToDrive(params: {
  token: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  description?: string;
  useStudioFolder?: boolean;
}): Promise<DriveFileItem> {
  const { token, fileName, mimeType, blob, description, useStudioFolder = true } = params;

  const parents: string[] = [];
  if (useStudioFolder) {
    const folderId = await ensureStudioDriveFolder(token);
    parents.push(folderId);
  }

  const metadata = {
    name: fileName,
    mimeType,
    ...(description ? { description } : {}),
    ...(parents.length > 0 ? { parents } : {}),
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob, fileName);

  const res = await handleDriveResponse(
    await fetch(
      `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }
    )
  );
  return (await res.json()) as DriveFileItem;
}

export async function downloadDriveFileBlob(token: string, fileId: string): Promise<Blob> {
  const res = await handleDriveResponse(
    await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return await res.blob();
}

export async function renameDriveFile(
  token: string,
  fileId: string,
  newName: string
): Promise<DriveFileItem> {
  const res = await handleDriveResponse(
    await fetch(
      `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,modifiedTime,webViewLink`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName.trim() }),
      }
    )
  );
  return (await res.json()) as DriveFileItem;
}

export async function deleteDriveFile(token: string, fileId: string): Promise<void> {
  await handleDriveResponse(
    await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  );
}
