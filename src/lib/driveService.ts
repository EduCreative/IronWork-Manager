import { GoogleAuthProvider } from 'firebase/auth';
import { auth } from './firebase';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

async function getAccessToken() {
  const token = localStorage.getItem('googleAccessToken');
  if (!token) throw new Error('Google Drive access token missing. Please sign in with Google again.');
  return token;
}

export async function uploadToDrive(filename: string, content: string) {
  try {
    const token = await getAccessToken();
    
    const metadata = {
      name: filename,
      mimeType: 'application/json',
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: 'application/json' }));

    const response = await fetch(DRIVE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });

    if (!response.ok) {
      const errData = await response.json();
      if (response.status === 401) {
        throw new Error('Unauthorized. Please sign in with Google again to refresh token.');
      }
      throw new Error(errData.error?.message || 'Failed to upload to Drive');
    }

    return { success: true, message: 'Backup successfully uploaded to Google Drive' };
  } catch (error: any) {
    console.error('Drive Upload Error:', error);
    return { success: false, message: error.message };
  }
}

export async function listBackupsFromDrive() {
  try {
    const token = await getAccessToken();
    const query = encodeURIComponent("name contains 'FORGE_STEEL_BACKUP_' and mimeType = 'application/json'");
    const response = await fetch(`${DRIVE_API_URL}?q=${query}&orderBy=createdTime desc&fields=files(id, name, createdTime, size)`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return [];
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('Drive List Error:', error);
    return [];
  }
}
