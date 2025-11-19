import { fileToBase64 } from './utils';
import type { AnalysisResult, Employee, EvidenceFile, EvidenceType, EmployeeTestimony } from '../types';

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

const GITHUB_REPO = 'averybee24601/Evidence';
const GITHUB_BRANCH = 'main';
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO}/contents`;
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}`;

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
    // Try fetching from GitHub first as requested
    try {
        const githubProfiles = await listProfilesFromGitHub();
        if (githubProfiles.length > 0) return githubProfiles;
    } catch (e) {
        console.warn('Failed to list profiles from GitHub, falling back to local:', e);
    }

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

// --- GitHub Integration ---

interface GitHubContent {
    name: string;
    path: string;
    sha: string;
    size: number;
    url: string;
    html_url: string;
    git_url: string;
    download_url: string;
    type: 'file' | 'dir';
}

async function fetchGitHubDir(path: string): Promise<GitHubContent[]> {
    const response = await fetch(`${GITHUB_API_BASE}/${path}`);
    if (!response.ok) {
        // If 404, directory might not exist, return empty
        if (response.status === 404) return [];
        throw new Error(`Failed to fetch GitHub dir: ${path}`);
    }
    return response.json();
}

async function fetchGitHubFileText(path: string): Promise<string> {
    // Encode path components properly
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const url = `${GITHUB_RAW_BASE}/${encodedPath}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch file: ${url}`);
    return response.text();
}

// Helper to guess evidence type from extension
function guessEvidenceType(filename: string): EvidenceType {
    const ext = filename.toLowerCase().split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'image';
    if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext || '')) return 'video';
    if (['mp3', 'wav', 'm4a', 'ogg'].includes(ext || '')) return 'audio';
    return 'document';
}

/**
 * Loads profiles from app/data/profiles and app/data/Profiles in the GitHub repo.
 */
export async function listProfilesFromGitHub(): Promise<ListedProfile[]> {
    const profiles: ListedProfile[] = [];
    
    // Helper to process a directory
    const processDir = async (dirName: string) => {
        const files = await fetchGitHubDir(`app/data/${dirName}`);
        const jsonFiles = files.filter(f => f.name.toLowerCase().endsWith('.profile.json'));
        
        for (const f of jsonFiles) {
            try {
                const content = await fetchGitHubFileText(f.path);
                const data = JSON.parse(content);
                const baseName = f.name.replace(/\.profile\.json$/i, '');
                
                // Check for reference image in same dir
                const imageFile = files.find(img => 
                    img.name.startsWith(`${baseName}.reference.`)
                );
                
                const imagePathRel = imageFile ? `app/data/${dirName}/${imageFile.name}` : undefined;

                profiles.push({
                    id: `emp-${baseName}`,
                    name: data.name || baseName,
                    details: data.description || '',
                    aiEnhancedDetails: data.aiEnhancedDetails || undefined,
                    referenceUrl: data.referenceUrl || undefined,
                    referenceImagePath: imagePathRel, // We will handle URL transformation in the UI or here?
                                                      // Ideally here: convert to raw URL
                    profileJsonPath: f.path,
                    status: 'ready',
                });
            } catch (e) {
                console.error(`Error parsing profile ${f.name}:`, e);
            }
        }
    };

    await Promise.all([
        processDir('profiles').catch(() => {}),
        processDir('Profiles').catch(() => {})
    ]);

    // Transform image paths to raw URLs
    return profiles.map(p => {
        if (p.referenceImagePath) {
            const encoded = p.referenceImagePath.split('/').map(encodeURIComponent).join('/');
            return { ...p, referenceImagePath: `${GITHUB_RAW_BASE}/${encoded}` };
        }
        return p;
    });
}

export interface GitHubEvidenceData {
    evidenceFiles: EvidenceFile[];
    evidenceCases: any[]; // Todo: type strictly
}

/**
 * Loads evidence files and analyses from GitHub.
 * Scans 'analyzed files' and 'Unified files'.
 * Scans 'analysis reports' and 'Unified analysis reports'.
 * Matches them up.
 */
export async function loadEvidenceFromGitHub(): Promise<GitHubEvidenceData> {
    const evidenceFiles: EvidenceFile[] = [];
    
    // 1. Fetch lists of files
    const [analyzedFiles, unifiedFiles, analysisReports, unifiedReports] = await Promise.all([
        fetchGitHubDir('app/data/analyzed files').catch(() => []),
        fetchGitHubDir('app/data/Unified files').catch(() => []),
        fetchGitHubDir('app/data/analysis reports').catch(() => []),
        fetchGitHubDir('app/data/Unified analysis reports').catch(() => []),
    ]);

    const allEvidenceAssets = [...analyzedFiles, ...unifiedFiles];
    const allReports = [...analysisReports, ...unifiedReports];

    // 2. Build EvidenceFiles
    for (const asset of allEvidenceAssets) {
        // Skip .gitkeep or similar
        if (asset.name.startsWith('.')) continue;

        const type = guessEvidenceType(asset.name);
        
        // Construct raw URL
        const encodedPath = asset.path.split('/').map(encodeURIComponent).join('/');
        const rawUrl = `${GITHUB_RAW_BASE}/${encodedPath}`;

        const evidence: EvidenceFile = {
            id: `gh-${asset.sha}`,
            name: asset.name,
            type,
            url: rawUrl,
            file: new File([], asset.name, { type: 'application/octet-stream' }), // Mock file object
            status: 'new', // Default
            storedFileName: asset.name,
            storedFilePath: asset.path,
            analysisDocuments: [],
        };

        // 3. Check for analysis reports
        // Naming convention: "Analysis of {filename}.txt"
        // Or "Analysis of {filename} (n).txt"
        const baseName = asset.name;
        const escapedBase = baseName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&');
        // Regex to match "Analysis of <filename>.txt" or "Analysis of <filename> (2).txt"
        // Note: sanitization might have changed special chars to underscores. 
        // For simplicity, we just look for startsWith "Analysis of " + baseName
        
        // Ideally we fetch the content of the report to be sure, but that's too many requests.
        // We'll just match by name for now.
        
        const relatedReports = allReports.filter(r => 
            r.name.startsWith(`Analysis of ${baseName}`) && r.name.endsWith('.txt')
        );

        if (relatedReports.length > 0) {
            // Load the first report to parse analysis
            // We can only do this for a few, or do it on demand?
            // The user wants "it loads all". We should probably try to load the analysis content for at least the latest one.
            // To avoid rate limits, maybe we only load the list of documents, and let the UI fetch content on demand?
            // But the UI expects `file.analysis` to be populated for the status to be 'analyzed'.
            
            // Let's try to fetch the most recent report (based on name sorting usually works for (2), (3))
            const latestReport = relatedReports.sort((a, b) => b.name.localeCompare(a.name))[0];
            
            try {
                const reportText = await fetchGitHubFileText(latestReport.path);
                // Parse report text back to AnalysisResult structure (approximate)
                const analysis = parseAnalysisFromText(reportText);
                evidence.status = 'analyzed';
                evidence.analysis = analysis;
                evidence.recognitionVerified = true; // Assume verified if saved
            } catch (e) {
                console.error(`Failed to load report ${latestReport.name}`, e);
            }

            evidence.analysisDocuments = relatedReports.map(r => r.path);
        }

        evidenceFiles.push(evidence);
    }

    return { evidenceFiles, evidenceCases: [] };
}

// Helper to parse the text report back into JSON-like object
function parseAnalysisFromText(text: string): AnalysisResult {
    // This is a rough parser matching handleAnalysisSave output
    const extract = (key: string) => {
        const regex = new RegExp(`${key}:\\s*([\\s\\S]*?)(?=\\n[A-Z][a-z ]+:|$)`, 'i');
        const m = text.match(regex);
        return m ? m[1].trim() : '';
    };

    const extractList = (section: string) => {
        const start = text.indexOf(section);
        if (start === -1) return [];
        const nextSection = text.indexOf('\n\n', start); // Sections separated by empty line usually
        const content = text.substring(start + section.length, nextSection === -1 ? undefined : nextSection);
        return content.split('\n').filter(l => l.trim().startsWith('-')).map(l => l.trim().replace(/^- \[.*?\] /, '').replace(/^- /, ''));
    };

    // Helper for structured lists like timeline/observations
    const extractStructured = (section: string) => {
        const start = text.indexOf(section);
        if (start === -1) return [];
        let end = text.indexOf('\n\n', start);
        if (end === -1) end = text.length;
        
        const block = text.substring(start + section.length, end);
        return block.split('\n').filter(l => l.trim().startsWith('-')).map(line => {
            // - [timestamp] description
            const m = line.match(/^- \[(.*?)\] (.*)/);
            if (m) return { timestamp: m[1], description: m[2] };
            return { timestamp: 'N/A', description: line.replace(/^- /, '') };
        });
    };

    return {
        summary: extract('Summary'),
        newFindingsSummary: extract('New Findings Summary'),
        confidenceScore: parseInt(extract('Confidence Score').replace('%', '')) || 0,
        severityScore: parseInt(extract('Severity Score')) || 0,
        childrenDetected: extract('Children Detected').toLowerCase() === 'yes',
        keyObservations: extractStructured('Key Observations:'),
        timelineEvents: extractStructured('Timeline Events:'), // Note: subjects parsing lost
        crossReferences: extractList('Cross-References:').map(s => ({ fileName: 'Ref', observation: s })),
        emotionalAnalysis: extractList('Emotional Analysis:').map(s => {
            const parts = s.split(':');
            return { emotion: parts[0] || 'Unknown', evidence: parts.slice(1).join(':').trim() };
        }),
        recognizedEmployees: extractList('Recognized Employees:').map(s => {
             // - Name (at time) - Conf%
             const m = s.match(/^(.*?) \(at (.*?)\) - (\d+)%/);
             if (m) return { name: m[1], timestamp: m[2], confidence: parseInt(m[3]) };
             return { name: s, timestamp: '0:00', confidence: 0 };
        }),
        potentialViolations: extractList('Potential Violations:'),
        fullTranscript: extract('Full Transcript'),
    };
}
