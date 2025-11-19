import { fileToBase64 } from './utils';
import type { AnalysisResult, Employee } from '../types';

interface SaveFileResponse {
    fileName: string;
    relativePath: string;
}

interface SaveAnalysisResponse {
    fileName: string;
    relativePath: string;
    analysisDate: string;
}

const JSON_HEADERS = {
    'Content-Type': 'application/json',
};

/**
 * Simple client-side wrapper to include a delete/rename password.
 * The server will validate this for sensitive operations.
 */
export const getDeletePassword = async (): Promise<string | null> => {
    const pwd = window.prompt('Enter password to perform this action:');
    if (!pwd || !pwd.trim()) {
        return null;
    }
    return pwd.trim();
};

export async function saveUploadedFile(file: File): Promise<SaveFileResponse> {
    const base64Data = await fileToBase64(file);
    const response = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
            fileName: file.name,
            fileData: base64Data,
        }),
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to save uploaded file.');
    }

    return response.json();
}

export async function saveAnalysisDocument(
    originalFileName: string,
    storedFileName: string,
    analysis: AnalysisResult
): Promise<SaveAnalysisResponse> {
    const response = await fetch('/api/storage/analysis', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
            originalFileName,
            storedFileName,
            analysis,
        }),
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to save analysis document.');
    }

    return response.json();
}

export async function saveUnifiedAnalysisDocument(
	originalFileNames: string[],
	storedFileNames: string[],
	combinedName: string,
	analysis: AnalysisResult
): Promise<SaveAnalysisResponse> {
	const response = await fetch('/api/storage/analysis', {
		method: 'POST',
		headers: JSON_HEADERS,
		body: JSON.stringify({
			originalFileNames,
			storedFileNames,
			combinedName,
			analysis,
		}),
	});

	if (!response.ok) {
		const message = await response.text();
		throw new Error(message || 'Failed to save unified analysis document.');
	}

	return response.json();
}

export async function deleteEvidence(opts: { name?: string; path?: string; kind?: 'analyzed' | 'report' | 'auto'; password: string; }): Promise<{ success: boolean; deleted: { file: string; }[]; }> {
    const response = await fetch('/api/storage/evidence-delete', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(opts),
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to delete evidence.');
    }
    return response.json();
}

export async function renameEvidence(opts: { oldName: string; newName: string; kind?: 'analyzed' | 'report' | 'auto'; password: string; }): Promise<{ success: boolean; newStoredFileName?: string; changes: { old: string; next: string; }[]; }> {
    const response = await fetch('/api/storage/evidence-rename', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(opts),
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to rename evidence.');
    }
    return response.json();
}

export async function revealOnDisk(opts: { relativePath?: string; name?: string; kind?: 'analyzed' | 'report' | 'auto'; }): Promise<void> {
    const response = await fetch('/api/storage/reveal', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(opts),
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to reveal file location.');
    }
}

export async function saveProfileToDisk(employee: Employee): Promise<{ jsonPath: string; imagePath?: string; }> {
    const response = await fetch('/api/storage/profile', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ employee }),
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to save profile.');
    }

    return response.json();
}

export interface ListedProfile extends Omit<Employee, 'status'> {
    status: Employee['status'];
}

export async function listProfiles(): Promise<ListedProfile[]> {
    const response = await fetch('/api/storage/profiles', { method: 'GET' });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to list profiles.');
    }
    const data = await response.json();
    return data?.profiles || [];
}

export async function deleteProfile(jsonPath?: string, baseName?: string): Promise<void> {
    const response = await fetch('/api/storage/profile-delete', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ jsonPath, baseName })
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to delete profile.');
    }
}

export async function saveTestimonyToDisk(payload: {
    kind: 'user' | 'employee';
    employeeName?: string;
    employeeId?: string;
    text: string;
    summary?: string;
}): Promise<{ fileName: string; relativePath: string; savedAt: string; }> {
    const response = await fetch('/api/storage/testimony', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to save testimony.');
    }
    return response.json();
}
