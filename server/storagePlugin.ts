import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { spawn } from 'child_process';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Resolve the root data directory. Preference order:
// 1) AI_EVIDENCE_DATA_DIR / AIEC_DATA_DIR / DATA_DIR / VITE_DATA_DIR (from env/.env)
// 2) If AIEC_USE_ONEDRIVE=1, place under the user's OneDrive root
// 3) Default to repo-local app/data
const resolveDataDir = (): string => {
    const envCandidate = (
        process.env.AI_EVIDENCE_DATA_DIR ||
        process.env.AIEC_DATA_DIR ||
        process.env.DATA_DIR ||
        process.env.VITE_DATA_DIR ||
        ''
    ).trim();

    if (envCandidate) {
        // Expand common tokens like %OneDrive% and %USERPROFILE% on Windows and leading ~
        const expandToken = (input: string): string => {
            let out = input;
            const oneDriveRoot = process.env.OneDrive || process.env.OneDriveCommercial || process.env.OneDriveConsumer || '';
            const userProfile = process.env.USERPROFILE || process.env.HOME || '';
            out = out.replace(/%OneDrive%/gi, oneDriveRoot);
            out = out.replace(/%USERPROFILE%/gi, userProfile);
            out = out.replace(/^~(?=\\|\/)/, userProfile);
            return out;
        };
        return path.resolve(expandToken(envCandidate));
    }

    if ((process.env.AIEC_USE_ONEDRIVE || '').trim() === '1') {
        const oneDriveRoot = process.env.OneDrive || process.env.OneDriveCommercial || process.env.OneDriveConsumer;
        if (oneDriveRoot) {
            return path.resolve(oneDriveRoot, 'AIEC Shared', 'data');
        }
    }

    return path.resolve(ROOT_DIR, 'app', 'data');
};

const DATA_DIR = resolveDataDir();
const PROFILES_DIR = path.resolve(DATA_DIR, 'profiles');
const LEGACY_PROFILES_DIR = path.resolve(DATA_DIR, 'Profiles');
const TESTIMONIES_DIR = path.resolve(DATA_DIR, 'testimonies');
const ANALYSIS_REPORTS_DIR = path.resolve(DATA_DIR, 'analysis reports');
const ANALYZED_FILES_DIR = path.resolve(DATA_DIR, 'analyzed files');
const UNIFIED_REPORTS_DIR = path.resolve(DATA_DIR, 'Unified analysis reports');
const UNIFIED_FILES_DIR = path.resolve(DATA_DIR, 'Unified files');

const ensureDataDirectory = async () => {
    await fsp.mkdir(DATA_DIR, { recursive: true });
};

const ensureProfilesDirectory = async () => {
    await ensureDataDirectory();
    await fsp.mkdir(PROFILES_DIR, { recursive: true });
};

const ensureTestimoniesDirectory = async () => {
    await ensureDataDirectory();
    await fsp.mkdir(TESTIMONIES_DIR, { recursive: true });
};

const ensureAnalysisReportsDirectory = async () => {
    await ensureDataDirectory();
    await fsp.mkdir(ANALYSIS_REPORTS_DIR, { recursive: true });
};

const ensureAnalyzedFilesDirectory = async () => {
    await ensureDataDirectory();
    await fsp.mkdir(ANALYZED_FILES_DIR, { recursive: true });
};

const ensureUnifiedReportsDirectory = async () => {
    await ensureDataDirectory();
    await fsp.mkdir(UNIFIED_REPORTS_DIR, { recursive: true });
};

const ensureUnifiedFilesDirectory = async () => {
    await ensureDataDirectory();
    await fsp.mkdir(UNIFIED_FILES_DIR, { recursive: true });
};

const sanitizeFileName = (input: string): string => {
    const trimmed = input.trim();
    const base = path.basename(trimmed);
    return base.replace(/[\u0000-\u001f<>:"/\\|?*\u007f]/g, '_');
};

const getUniqueFilePath = async (desiredName: string) => {
    const parsed = path.parse(desiredName);
    let candidate = desiredName;
    let counter = 1;

    while (fs.existsSync(path.join(DATA_DIR, candidate))) {
        counter += 1;
        candidate = `${parsed.name} (${counter})${parsed.ext}`;
    }

    const fullPath = path.join(DATA_DIR, candidate);
    return { fileName: candidate, fullPath };
};

const getUniqueFilePathIn = async (dir: string, desiredName: string) => {
    const parsed = path.parse(desiredName);
    let candidate = desiredName;
    let counter = 1;
    while (fs.existsSync(path.join(dir, candidate))) {
        counter += 1;
        candidate = `${parsed.name} (${counter})${parsed.ext}`;
    }
    const fullPath = path.join(dir, candidate);
    return { fileName: candidate, fullPath };
};

const getContentTypeFor = (fileName: string): string => {
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
        case '.mp4': return 'video/mp4';
        case '.webm': return 'video/webm';
        case '.mov': return 'video/quicktime';
        case '.mkv': return 'video/x-matroska';
        case '.mp3': return 'audio/mpeg';
        case '.wav': return 'audio/wav';
        case '.m4a': return 'audio/mp4';
        case '.ogg': return 'audio/ogg';
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.gif': return 'image/gif';
        case '.txt': return 'text/plain; charset=utf-8';
        case '.md': return 'text/markdown; charset=utf-8';
        case '.pdf': return 'application/pdf';
        default: return 'application/octet-stream';
    }
};

// Resolve a relative path like "app/data/analysis reports/Report.txt" into an absolute path.
// Returns null if the path escapes the data directory or is invalid.
const resolveAppRelativePath = (rel: string | undefined): string | null => {
    if (!rel) return null;
    const normalized = rel.replace(/^[.\\/]+/, ''); // strip leading ./ or .\
    const prefix = 'app/data/';
    let sub = normalized;
    if (normalized.toLowerCase().startsWith(prefix)) {
        sub = normalized.slice(prefix.length);
    }
    const abs = path.resolve(DATA_DIR, sub);
    if (!abs.startsWith(DATA_DIR)) {
        return null;
    }
    return abs;
};

// Open the containing folder and select the specified file if supported by the OS
const revealInFileManager = async (absPath: string): Promise<boolean> => {
    if (!fs.existsSync(absPath)) {
        return false;
    }
    const platform = process.platform;
    return await new Promise<boolean>((resolve) => {
        let child;
        if (platform === 'win32') {
            // explorer.exe /select,"C:\full\path\file.ext"
            child = spawn('explorer.exe', ['/select,', absPath], { detached: true, stdio: 'ignore' });
        } else if (platform === 'darwin') {
            // Reveal in Finder
            child = spawn('open', ['-R', absPath], { detached: true, stdio: 'ignore' });
        } else {
            // Best effort on Linux - open the folder (selection varies by DE)
            const dir = path.dirname(absPath);
            // Preferably try "xdg-open"
            child = spawn('xdg-open', [dir], { detached: true, stdio: 'ignore' });
        }
        try {
            child.unref();
        } catch {}
        // We cannot reliably know if the explorer opened; assume success when spawn didn't throw
        resolve(true);
    });
};

// POST /api/storage/reveal { relativePath?: string, name?: string, kind?: 'analyzed'|'report'|'auto' }
const handleReveal = async (req: IncomingMessage, res: ServerResponse) => {
    try {
        await ensureDataDirectory();
        await ensureAnalyzedFilesDirectory();
        await ensureAnalysisReportsDirectory();
        await ensureUnifiedReportsDirectory();
        await ensureUnifiedFilesDirectory();
        const body = await readJsonBody(req);
        const relativePath: string | undefined = body?.relativePath;
        const name: string | undefined = body?.name;
        const kind: 'analyzed' | 'report' | 'auto' = (body?.kind === 'analyzed' || body?.kind === 'report') ? body.kind : 'auto';

        let absPath: string | null = null;

        if (relativePath) {
            absPath = resolveAppRelativePath(String(relativePath));
        } else if (name) {
            // Try to find by file name in the known evidence directories
            let located = findEvidencePath(String(name));
            if (!located && kind !== 'auto') {
                // Try forcing directory by kind - check unified dirs too if needed
                let candidate = path.join(kind === 'analyzed' ? ANALYZED_FILES_DIR : ANALYSIS_REPORTS_DIR, sanitizeFileName(String(name)));
                if (fs.existsSync(candidate)) {
                    located = { fullPath: candidate, kind: kind === 'analyzed' ? 'analyzed' : 'report' };
                } else {
                    // Fallback check in unified dirs
                    candidate = path.join(kind === 'analyzed' ? UNIFIED_FILES_DIR : UNIFIED_REPORTS_DIR, sanitizeFileName(String(name)));
                    if (fs.existsSync(candidate)) {
                        located = { fullPath: candidate, kind: kind === 'analyzed' ? 'analyzed' : 'report' };
                    }
                }
            }
            absPath = located?.fullPath || null;
        }

        if (!absPath || !fs.existsSync(absPath)) {
            res.statusCode = 404;
            res.end('File not found.');
            return;
        }

        const ok = await revealInFileManager(absPath);
        if (!ok) {
            res.statusCode = 500;
            res.end('Unable to reveal in file manager.');
            return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
    } catch (error) {
        console.error('Error revealing file:', error);
        res.statusCode = 500;
        res.end('Unable to reveal file.');
    }
};

const handleOpenFile = async (req: IncomingMessage, res: ServerResponse, url: string) => {
    try {
        await ensureDataDirectory();
        // URL format: /api/storage/file/<filename>
        const prefix = '/api/storage/file/';
        const name = decodeURIComponent(url.slice(prefix.length));
        const safeName = sanitizeFileName(name);
        // Search across known data subdirectories, including root for backwards compatibility
        const candidates = [
            path.join(DATA_DIR, safeName),
            path.join(ANALYZED_FILES_DIR, safeName),
            path.join(ANALYSIS_REPORTS_DIR, safeName),
            path.join(UNIFIED_REPORTS_DIR, safeName),
            path.join(UNIFIED_FILES_DIR, safeName),
            path.join(TESTIMONIES_DIR, safeName),
            path.join(PROFILES_DIR, safeName),
            path.join(LEGACY_PROFILES_DIR, safeName),
        ];
        const fullPath = candidates.find(p => fs.existsSync(p));
        if (!fullPath) {
            res.statusCode = 404;
            res.end('File not found.');
            return;
        }

        const type = getContentTypeFor(fullPath);
        res.statusCode = 200;
        res.setHeader('Content-Type', type);
        const stream = fs.createReadStream(fullPath);
        stream.on('error', () => {
            res.statusCode = 500;
            res.end('Unable to read file.');
        });
        stream.pipe(res);
    } catch (error) {
        console.error('Error serving file:', error);
        res.statusCode = 500;
        res.end('Unable to open file.');
    }
};

// Helper: find an evidence file by name in known evidence dirs
const findEvidencePath = (name: string): { fullPath: string; kind: 'analyzed' | 'report' } | null => {
    const safe = sanitizeFileName(name);
    // Check standard analyzed
    let p = path.join(ANALYZED_FILES_DIR, safe);
    if (fs.existsSync(p)) return { fullPath: p, kind: 'analyzed' };
    // Check unified analyzed
    p = path.join(UNIFIED_FILES_DIR, safe);
    if (fs.existsSync(p)) return { fullPath: p, kind: 'analyzed' };
    
    // Check standard report
    p = path.join(ANALYSIS_REPORTS_DIR, safe);
    if (fs.existsSync(p)) return { fullPath: p, kind: 'report' };
    // Check unified report
    p = path.join(UNIFIED_REPORTS_DIR, safe);
    if (fs.existsSync(p)) return { fullPath: p, kind: 'report' };
    
    return null;
};

const tryUnlink = async (filePath: string) => {
    try {
        await fsp.unlink(filePath);
        return true;
    } catch {
        return false;
    }
};

const listFilesSafe = async (dir: string): Promise<string[]> => {
    try {
        const entries = await fsp.readdir(dir);
        return entries;
    } catch {
        return [];
    }
};

// Given an analyzed file name, return all matching analysis report names to remove/rename
const getReportNamesForAnalyzed = async (analyzedName: string): Promise<string[]> => {
    const base = sanitizeFileName(analyzedName);
    // Scan both report dirs
    const files1 = await listFilesSafe(ANALYSIS_REPORTS_DIR);
    const files2 = await listFilesSafe(UNIFIED_REPORTS_DIR);
    const files = [...files1, ...files2]; // Potential duplicates if name collision, but unlikely

    // Match "Analysis of <base>.txt" plus any "(n)" suffix before .txt
    const mainPrefix = `Analysis of ${base}`;
    const matches = files.filter(f => {
        const lower = f.toLowerCase();
        return lower.startsWith(mainPrefix.toLowerCase()) && lower.endsWith('.txt');
    });

    // Extra: also match any reports that reference this analyzed file inside content
    // by scanning a few candidates to avoid heavy IO for very large dirs
    const additional: string[] = [];
    const needle = `app/data/analyzed files/${base}`.toLowerCase();
    // Also check new unified path just in case
    const needleUnified = `app/data/Unified files/${base}`.toLowerCase();

    // Helper to check file content
    const checkContent = async (dir: string, f: string) => {
         if (matches.includes(f)) return;
         if (!f.toLowerCase().endsWith('.txt')) return;
         const full = path.join(dir, f);
         try {
             const content = await fsp.readFile(full, { encoding: 'utf8' });
             if (content.toLowerCase().includes(needle) || content.toLowerCase().includes(needleUnified)) {
                 additional.push(f);
             }
         } catch {
             // ignore read errors
         }
    };

    for (const f of files1) await checkContent(ANALYSIS_REPORTS_DIR, f);
    for (const f of files2) await checkContent(UNIFIED_REPORTS_DIR, f);

    return Array.from(new Set([...matches, ...additional]));
};

const tryRenameUnique = async (dir: string, oldName: string, desiredName: string): Promise<{ newName: string; fullPath: string; }> => {
    const safeDesired = sanitizeFileName(desiredName);
    const desiredFull = path.join(dir, safeDesired);
    let finalName = safeDesired;
    if (fs.existsSync(desiredFull)) {
        const { fileName, fullPath } = await getUniqueFilePathIn(dir, safeDesired);
        finalName = fileName;
        await fsp.rename(path.join(dir, oldName), fullPath);
        return { newName: fileName, fullPath };
    } else {
        await fsp.rename(path.join(dir, oldName), desiredFull);
        return { newName: safeDesired, fullPath: desiredFull };
    }
};

// Delete an evidence file or report and its linked counterpart(s)
const handleEvidenceDelete = async (req: IncomingMessage, res: ServerResponse) => {
    try {
        await ensureAnalyzedFilesDirectory();
        await ensureAnalysisReportsDirectory();
        await ensureUnifiedReportsDirectory();
        await ensureUnifiedFilesDirectory();
        const body = await readJsonBody(req);
        const inputName: string | undefined = body?.name || (body?.path ? path.basename(String(body?.path)) : undefined);
        const kind: 'analyzed' | 'report' | 'auto' = (body?.kind === 'analyzed' || body?.kind === 'report') ? body.kind : 'auto';
        const password: string | undefined = (body?.password || '').trim();

        // NOTE: Password is hard-coded per requirements.
        if (!password) {
            res.statusCode = 401;
            res.end('Password is required to delete evidence.');
            return;
        }
        if (password !== 'Supertoilet@24601!') {
            res.statusCode = 403;
            res.end('Invalid password for delete operation.');
            return;
        }

        if (!inputName) {
            res.statusCode = 400;
            res.end('Missing file name.');
            return;
        }

        let located = findEvidencePath(inputName);
        if (!located && kind !== 'auto') {
            // Try forcing directory by kind
            const dirs = kind === 'analyzed' 
                ? [ANALYZED_FILES_DIR, UNIFIED_FILES_DIR] 
                : [ANALYSIS_REPORTS_DIR, UNIFIED_REPORTS_DIR];
            
            for (const d of dirs) {
                const candidate = path.join(d, sanitizeFileName(inputName));
                if (fs.existsSync(candidate)) {
                    located = { fullPath: candidate, kind: kind === 'analyzed' ? 'analyzed' : 'report' };
                    break;
                }
            }
        }
        if (!located) {
            res.statusCode = 404;
            res.end('File not found.');
            return;
        }

        const deleted: { file: string; }[] = [];
        const basename = path.basename(located.fullPath);
        
        // Identify which directory it was in to return correct path info
        let dirName = 'analyzed files';
        if (located.fullPath.startsWith(ANALYSIS_REPORTS_DIR)) dirName = 'analysis reports';
        else if (located.fullPath.startsWith(UNIFIED_REPORTS_DIR)) dirName = 'Unified analysis reports';
        else if (located.fullPath.startsWith(UNIFIED_FILES_DIR)) dirName = 'Unified files';
        
        // Delete primary
        if (await tryUnlink(located.fullPath)) {
            deleted.push({ file: `app/data/${dirName}/${basename}` });
        }

        if (located.kind === 'analyzed') {
            // Delete all linked reports
            const reportNames = await getReportNamesForAnalyzed(basename);
            for (const r of reportNames) {
                // Check both report dirs
                const p1 = path.join(ANALYSIS_REPORTS_DIR, r);
                const p2 = path.join(UNIFIED_REPORTS_DIR, r);
                if (fs.existsSync(p1)) {
                    if (await tryUnlink(p1)) deleted.push({ file: `app/data/analysis reports/${r}` });
                } else if (fs.existsSync(p2)) {
                    if (await tryUnlink(p2)) deleted.push({ file: `app/data/Unified analysis reports/${r}` });
                }
            }
        } else {
            // If report, try infer analyzed file as "Analysis of <name>.txt"
            const m = /^Analysis of (.+)\.txt$/i.exec(basename);
            if (m && m[1]) {
                const analyzedName = sanitizeFileName(m[1]);
                const p1 = path.join(ANALYZED_FILES_DIR, analyzedName);
                const p2 = path.join(UNIFIED_FILES_DIR, analyzedName);
                if (fs.existsSync(p1)) {
                    if (await tryUnlink(p1)) deleted.push({ file: `app/data/analyzed files/${analyzedName}` });
                } else if (fs.existsSync(p2)) {
                    if (await tryUnlink(p2)) deleted.push({ file: `app/data/Unified files/${analyzedName}` });
                }
            }
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, deleted }));
    } catch (error) {
        console.error('Error deleting evidence:', error);
        res.statusCode = 500;
        res.end('Unable to delete evidence.');
    }
};

// Rename an analyzed evidence file (and its linked reports). If renaming a report, also rename the analyzed file.
const handleEvidenceRename = async (req: IncomingMessage, res: ServerResponse) => {
    try {
        await ensureAnalyzedFilesDirectory();
        await ensureAnalysisReportsDirectory();
        await ensureUnifiedReportsDirectory();
        await ensureUnifiedFilesDirectory();
        const body = await readJsonBody(req);
        const oldNameRaw: string | undefined = body?.oldName || (body?.oldPath ? path.basename(String(body.oldPath)) : undefined);
        let newNameRaw: string | undefined = body?.newName;
        const kind: 'analyzed' | 'report' | 'auto' = (body?.kind === 'analyzed' || body?.kind === 'report') ? body.kind : 'auto';
        const password: string | undefined = (body?.password || '').trim();

        if (!password) {
            res.statusCode = 401;
            res.end('Password is required to rename evidence.');
            return;
        }
        if (!process.env.AIEC_DELETE_PASSWORD || password !== process.env.AIEC_DELETE_PASSWORD) {
            res.statusCode = 403;
            res.end('Invalid password for rename operation.');
            return;
        }

        if (!oldNameRaw || !newNameRaw) {
            res.statusCode = 400;
            res.end('Missing oldName or newName.');
            return;
        }

        // Preserve extension if user omitted it
        const oldExt = path.extname(oldNameRaw);
        if (!path.extname(newNameRaw) && oldExt) {
            newNameRaw = `${newNameRaw}${oldExt}`;
        }

        let located = findEvidencePath(oldNameRaw);
        if (!located && kind !== 'auto') {
            const dirs = kind === 'analyzed' 
                ? [ANALYZED_FILES_DIR, UNIFIED_FILES_DIR] 
                : [ANALYSIS_REPORTS_DIR, UNIFIED_REPORTS_DIR];
            for (const d of dirs) {
                const candidate = path.join(d, sanitizeFileName(oldNameRaw));
                if (fs.existsSync(candidate)) {
                    located = { fullPath: candidate, kind: kind === 'analyzed' ? 'analyzed' : 'report' };
                    break;
                }
            }
        }
        if (!located) {
            res.statusCode = 404;
            res.end('File not found.');
            return;
        }

        const changes: { old: string; next: string; }[] = [];
        const oldBase = path.basename(located.fullPath);
        const parentDir = path.dirname(located.fullPath);

        // Determine relative path prefix for response
        const getRelPrefix = (abs: string) => {
            if (abs.startsWith(ANALYSIS_REPORTS_DIR)) return 'app/data/analysis reports';
            if (abs.startsWith(UNIFIED_REPORTS_DIR)) return 'app/data/Unified analysis reports';
            if (abs.startsWith(UNIFIED_FILES_DIR)) return 'app/data/Unified files';
            return 'app/data/analyzed files';
        };

        if (located.kind === 'analyzed') {
            const desired = sanitizeFileName(newNameRaw);
            // Rename in the SAME directory it was found
            const result = await tryRenameUnique(parentDir, oldBase, desired);
            changes.push({ old: `${getRelPrefix(located.fullPath)}/${oldBase}`, next: `${getRelPrefix(result.fullPath)}/${result.newName}` });

            // Rename any linked reports
            const reportNames = await getReportNamesForAnalyzed(oldBase);
            for (const r of reportNames) {
                // Check which dir this report is in
                let reportDir = ANALYSIS_REPORTS_DIR;
                let reportPath = path.join(ANALYSIS_REPORTS_DIR, r);
                if (!fs.existsSync(reportPath)) {
                    reportPath = path.join(UNIFIED_REPORTS_DIR, r);
                    reportDir = UNIFIED_REPORTS_DIR;
                }
                
                if (fs.existsSync(reportPath)) {
                    // Preserve suffix like " (2).txt"
                    const parsed = path.parse(r);
                    const suffix = parsed.name.replace(new RegExp(`^Analysis of ${oldBase.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`), '');
                    const desiredReportName = `Analysis of ${result.newName}${suffix}.txt`.replace(/\.txt\.txt$/i, '.txt');
                    const renamed = await tryRenameUnique(reportDir, r, desiredReportName);
                    changes.push({ old: `${getRelPrefix(reportPath)}/${r}`, next: `${getRelPrefix(renamed.fullPath)}/${renamed.newName}` });

                    // Update file path inside report content
                    try {
                        const content = await fsp.readFile(renamed.fullPath, { encoding: 'utf8' });
                        let updated = content.replace(/File Path:\s*app\/data\/analyzed files\/.+/i, `File Path: app/data/analyzed files/${result.newName}`);
                        updated = updated.replace(/File Path:\s*app\/data\/Unified files\/.+/i, `File Path: app/data/Unified files/${result.newName}`);
                        await fsp.writeFile(renamed.fullPath, updated, { encoding: 'utf8' });
                    } catch {
                        // ignore
                    }
                }
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, newStoredFileName: result.newName, changes }));
            return;
        } else {
            // Renaming a report; attempt to also rename analyzed file if it matches single-file pattern
            const oldReportBase = oldBase;
            const m = /^Analysis of (.+)\.txt$/i.exec(oldReportBase);
            let analyzedOriginal: string | undefined = m?.[1];
            // Desired report name
            let desiredReport = sanitizeFileName(newNameRaw);
            if (!/\.txt$/i.test(desiredReport)) desiredReport = `${desiredReport}.txt`;

            const reportResult = await tryRenameUnique(parentDir, oldReportBase, desiredReport);
            changes.push({ old: `${getRelPrefix(located.fullPath)}/${oldReportBase}`, next: `${getRelPrefix(reportResult.fullPath)}/${reportResult.newName}` });

            if (analyzedOriginal) {
                const analyzedName = sanitizeFileName(analyzedOriginal);
                let analyzedFull = path.join(ANALYZED_FILES_DIR, analyzedName);
                let analyzedDir = ANALYZED_FILES_DIR;
                if (!fs.existsSync(analyzedFull)) {
                    analyzedFull = path.join(UNIFIED_FILES_DIR, analyzedName);
                    analyzedDir = UNIFIED_FILES_DIR;
                }

                if (fs.existsSync(analyzedFull)) {
                    // Infer new analyzed name from "Analysis of <X>.txt" -> extract X
                    const mNew = /^Analysis of (.+)\.txt$/i.exec(reportResult.newName);
                    const newAnalyzedName = mNew?.[1];
                    if (newAnalyzedName) {
                        const analyzedOldBase = path.basename(analyzedFull);
                        const analyzedRename = await tryRenameUnique(analyzedDir, analyzedOldBase, sanitizeFileName(newAnalyzedName));
                        changes.push({ old: `${getRelPrefix(analyzedFull)}/${analyzedOldBase}`, next: `${getRelPrefix(analyzedRename.fullPath)}/${analyzedRename.newName}` });
                        // Update path line in report
                        try {
                            const content = await fsp.readFile(reportResult.fullPath, { encoding: 'utf8' });
                            let updated = content.replace(/File Path:\s*app\/data\/analyzed files\/.+/i, `File Path: app/data/analyzed files/${analyzedRename.newName}`);
                            updated = updated.replace(/File Path:\s*app\/data\/Unified files\/.+/i, `File Path: app/data/Unified files/${analyzedRename.newName}`);
                            await fsp.writeFile(reportResult.fullPath, updated, { encoding: 'utf8' });
                        } catch {}
                    }
                }
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, changes }));
            return;
        }
    } catch (error) {
        console.error('Error renaming evidence:', error);
        res.statusCode = 500;
        res.end('Unable to rename evidence.');
    }
};

const saveBufferToFile = async (dir: string, name: string, buffer: Buffer) => {
    const fullPath = path.join(dir, name);
    await fsp.writeFile(fullPath, buffer);
    return fullPath;
};

const handleSaveProfile = async (req: IncomingMessage, res: ServerResponse) => {
    try {
        await ensureProfilesDirectory();
        const body = await readJsonBody(req);
        const employee = body?.employee || {};

        const name: string = sanitizeFileName(employee?.name || 'profile');
        const description: string = String(employee?.details || '');
        const aiEnhancedDetails: string | undefined = employee?.aiEnhancedDetails || undefined;
        const referenceUrl: string | undefined = employee?.referenceUrl || undefined;
        const referenceImage = employee?.referenceImage || undefined;

        const baseName = name || 'profile';
        const jsonFileName = `${baseName}.profile.json`;
        let imagePathRel: string | undefined = undefined;

        if (referenceImage && referenceImage.base64) {
            const mime = String(referenceImage.mimeType || 'image/png');
            const ext = mime.includes('jpeg') ? '.jpg' : (mime.includes('png') ? '.png' : (mime.includes('gif') ? '.gif' : '.png'));
            const imageFileName = `${baseName}.reference${ext}`;
            const buffer = Buffer.from(referenceImage.base64, 'base64');
            const imageFull = await saveBufferToFile(PROFILES_DIR, imageFileName, buffer);
            imagePathRel = `app/data/profiles/${path.basename(imageFull)}`;
        }

        const jsonFullPath = path.join(PROFILES_DIR, jsonFileName);
        const payload = {
            name: employee?.name || '',
            description,
            aiEnhancedDetails: aiEnhancedDetails || null,
            referenceUrl: referenceUrl || null,
            referenceImagePath: imagePathRel || null,
            savedAt: new Date().toISOString(),
        };
        await fsp.writeFile(jsonFullPath, JSON.stringify(payload, null, 2), { encoding: 'utf8' });

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ jsonPath: `app/data/profiles/${path.basename(jsonFullPath)}`, imagePath: imagePathRel }));
    } catch (error) {
        console.error('Error saving profile:', error);
        res.statusCode = 500;
        res.end('Unable to save profile to app/data/Profiles.');
    }
};

const handleOpenProfileFile = async (req: IncomingMessage, res: ServerResponse, url: string) => {
    try {
        await ensureProfilesDirectory();
        const prefix = '/api/storage/profile-file/';
        const name = decodeURIComponent(url.slice(prefix.length));
        const safeName = sanitizeFileName(name);
        let fullPath = path.join(PROFILES_DIR, safeName);
        if (!fs.existsSync(fullPath)) {
            // Try legacy folder for backwards compatibility
            const legacy = path.join(LEGACY_PROFILES_DIR, safeName);
            if (fs.existsSync(legacy)) {
                fullPath = legacy;
            }
        }

        if (!fs.existsSync(fullPath)) {
            res.statusCode = 404;
            res.end('Profile file not found.');
            return;
        }

        const type = getContentTypeFor(fullPath);
        res.statusCode = 200;
        res.setHeader('Content-Type', type);
        fs.createReadStream(fullPath).pipe(res);
    } catch (error) {
        console.error('Error serving profile file:', error);
        res.statusCode = 500;
        res.end('Unable to open profile file.');
    }
};

const listJsonFiles = async (dir: string): Promise<string[]> => {
    try {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        return entries
            .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.profile.json'))
            .map(e => e.name);
    } catch {
        return [];
    }
};

const readProfileJson = async (fullPath: string): Promise<any | null> => {
    try {
        const content = await fsp.readFile(fullPath, { encoding: 'utf8' });
        return JSON.parse(content);
    } catch {
        return null;
    }
};

const handleListProfiles = async (_req: IncomingMessage, res: ServerResponse) => {
    try {
        await ensureProfilesDirectory();
        const list1 = await listJsonFiles(PROFILES_DIR);
        const list2 = await listJsonFiles(LEGACY_PROFILES_DIR);
        const combined = Array.from(new Set([...list1, ...list2]));

        const items: any[] = [];
        for (const name of combined) {
            let full = path.join(PROFILES_DIR, name);
            let source = 'profiles';
            if (!fs.existsSync(full)) {
                const legacy = path.join(LEGACY_PROFILES_DIR, name);
                if (fs.existsSync(legacy)) {
                    full = legacy;
                    source = 'Profiles';
                }
            }
            const data = await readProfileJson(full);
            if (!data) continue;
            const baseName = path.basename(name, '.profile.json');
            const id = `emp-${baseName}`;
            const jsonPath = `app/data/${source}/${name}`;
            items.push({
                id,
                name: data.name || baseName,
                details: data.description || '',
                aiEnhancedDetails: data.aiEnhancedDetails || undefined,
                referenceUrl: data.referenceUrl || undefined,
                referenceImagePath: data.referenceImagePath || undefined,
                profileJsonPath: jsonPath,
                status: 'ready',
            });
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ profiles: items }));
    } catch (error) {
        console.error('Error listing profiles:', error);
        res.statusCode = 500;
        res.end('Unable to list profiles.');
    }
};

const handleDeleteProfile = async (req: IncomingMessage, res: ServerResponse) => {
    try {
        await ensureProfilesDirectory();
        const body = await readJsonBody(req);
        const { jsonPath, baseName } = body || {};

        const targetName = jsonPath
            ? path.basename(jsonPath)
            : (baseName ? `${sanitizeFileName(baseName)}.profile.json` : null);

        if (!targetName) {
            res.statusCode = 400;
            res.end('Missing profile identifier.');
            return;
        }

        const candidates = [
            path.join(PROFILES_DIR, targetName),
            path.join(LEGACY_PROFILES_DIR, targetName),
        ];

        let foundPath: string | null = null;
        for (const p of candidates) {
            if (fs.existsSync(p)) {
                foundPath = p;
                break;
            }
        }

        if (!foundPath) {
            res.statusCode = 404;
            res.end('Profile not found.');
            return;
        }

        // Delete JSON
        await fsp.unlink(foundPath);

        // Try delete associated image if exists in same folder with baseName.reference.*
        const dir = path.dirname(foundPath);
        const bn = path.basename(foundPath, '.profile.json');
        const files = await fsp.readdir(dir);
        const img = files.find(n => n.startsWith(`${bn}.reference.`));
        if (img) {
            try { await fsp.unlink(path.join(dir, img)); } catch {}
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
    } catch (error) {
        console.error('Error deleting profile:', error);
        res.statusCode = 500;
        res.end('Unable to delete profile.');
    }
};

const readJsonBody = (req: IncomingMessage): Promise<any> => {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
            raw += chunk;
        });
        req.on('end', () => {
            try {
                resolve(raw ? JSON.parse(raw) : {});
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
};

const handleUpload = async (req: IncomingMessage, res: ServerResponse) => {
    try {
        await ensureAnalyzedFilesDirectory();
        const body = await readJsonBody(req);
        const { fileName, fileData } = body || {};

        if (!fileName || !fileData) {
            res.statusCode = 400;
            res.end('Missing file data.');
            return;
        }

        const sanitizedName = sanitizeFileName(fileName);
        const { fileName: storedFileName, fullPath } = await getUniqueFilePathIn(ANALYZED_FILES_DIR, sanitizedName);
        const buffer = Buffer.from(fileData, 'base64');

        await fsp.writeFile(fullPath, buffer);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(
            JSON.stringify({
                fileName: storedFileName,
                relativePath: `app/data/analyzed files/${storedFileName}`,
            })
        );
    } catch (error) {
        console.error('Error saving uploaded file:', error);
        res.statusCode = 500;
        res.end('Unable to save uploaded file.');
    }
};

const handleAnalysisSave = async (req: IncomingMessage, res: ServerResponse) => {
    try {
        await ensureAnalysisReportsDirectory();
        await ensureUnifiedReportsDirectory();
        const body = await readJsonBody(req);
		const { originalFileName, storedFileName, analysis } = body || {};
		// New unified-case fields (optional)
		const originalFileNames: string[] | undefined = Array.isArray(body?.originalFileNames) ? body.originalFileNames : undefined;
		const storedFileNames: string[] | undefined = Array.isArray(body?.storedFileNames) ? body.storedFileNames : undefined;
		const combinedName: string | undefined = body?.combinedName;

		if ((!originalFileName && !originalFileNames) || !analysis) {
            res.statusCode = 400;
            res.end('Missing analysis data.');
            return;
        }

		// Determine naming for single vs multi-file
		let headerFileName: string;
		let analysisBaseName: string;
		let filePathLines: string[] = [];
        let targetDir = ANALYSIS_REPORTS_DIR; // Default
        let relPathPrefix = 'app/data/analysis reports';

		if (originalFileNames && originalFileNames.length >= 2) {
            targetDir = UNIFIED_REPORTS_DIR;
            relPathPrefix = 'app/data/Unified analysis reports';
			const safeNames = originalFileNames.map(n => sanitizeFileName(n));
			const label = combinedName ? sanitizeFileName(combinedName) : `${safeNames[0]} + ${safeNames[1]}`;
			headerFileName = label;
			analysisBaseName = sanitizeFileName(`Analysis of ${label}.txt`);
			if (storedFileNames && storedFileNames.length >= 2) {
				filePathLines = storedFileNames.map(n => `app/data/analyzed files/${sanitizeFileName(n)}`);
			} else {
				filePathLines = safeNames.map(n => `app/data/analyzed files/${n}`);
			}
		} else {
			const safeStoredName = sanitizeFileName(storedFileName || originalFileName);
			headerFileName = originalFileName;
			analysisBaseName = sanitizeFileName(`Analysis of ${safeStoredName}.txt`);
			filePathLines = [`app/data/analyzed files/${safeStoredName}`];
		}

        const { fileName: analysisFileName, fullPath } = await getUniqueFilePathIn(targetDir, analysisBaseName);
        const analysisDate = new Date().toISOString();
        
        // Format full analysis content
        const a = analysis || {};
        const toLines = (arr?: any[], map?: (x: any) => string) => {
            if (!Array.isArray(arr) || arr.length === 0) return ['None.'];
            return arr.map(map || ((x) => String(x)));
        };

		const contentLines: string[] = [];
        contentLines.push('=====================================');
		if (originalFileNames && originalFileNames.length >= 2) {
			contentLines.push(`Files: ${originalFileNames.join(' + ')}`);
			if (filePathLines.length > 0) {
				contentLines.push(`File Paths:`);
				filePathLines.forEach((p, idx) => contentLines.push(`- [${idx + 1}] ${p}`));
			}
		} else {
			contentLines.push(`File Name: ${headerFileName}`);
			if (filePathLines.length > 0) {
				contentLines.push(`File Path: ${filePathLines[0]}`);
			}
		}
        contentLines.push(`Analysis Date: ${analysisDate}`);
        contentLines.push('-------------------------------------');
        contentLines.push('Summary:');
        contentLines.push('');
        contentLines.push(String(a.summary ?? 'No summary provided.'));
        contentLines.push('');
        contentLines.push('New Findings Summary:');
        contentLines.push(String(a.newFindingsSummary ?? 'N/A'));
        contentLines.push('');
        contentLines.push(`Confidence Score: ${a.confidenceScore ?? 'N/A'}%`);
        contentLines.push(`Severity Score: ${a.severityScore ?? 'N/A'}`);
        contentLines.push(`Children Detected: ${a.childrenDetected ? 'Yes' : 'No'}`);
        contentLines.push('');
        contentLines.push('Key Observations:');
        toLines(a.keyObservations, (o: any) => `- [${o?.timestamp ?? 'N/A'}] ${o?.description ?? ''}`).forEach(l => contentLines.push(l));
        contentLines.push('');
        contentLines.push('Timeline Events:');
        toLines(a.timelineEvents, (t: any) => `- [${t?.timestamp ?? 'N/A'}] ${t?.description ?? ''} (Subjects: ${(t?.subjects || []).join(', ') || 'Unknown'})`).forEach(l => contentLines.push(l));
        contentLines.push('');
        contentLines.push('Cross-References:');
        toLines(a.crossReferences, (c: any) => `- File "${c?.fileName ?? 'N/A'}": ${c?.observation ?? ''}`).forEach(l => contentLines.push(l));
        contentLines.push('');
        contentLines.push('Emotional Analysis:');
        toLines(a.emotionalAnalysis, (e: any) => `- ${e?.emotion ?? 'N/A'}: ${e?.evidence ?? ''}`).forEach(l => contentLines.push(l));
        contentLines.push('');
        contentLines.push('Recognized Employees:');
        toLines(a.recognizedEmployees, (r: any) => `- ${r?.name ?? 'Unknown'} (at ${r?.timestamp ?? 'N/A'}) - ${r?.confidence ?? 'N/A'}%`).forEach(l => contentLines.push(l));
        contentLines.push('');
        contentLines.push('Potential Violations:');
        toLines(a.potentialViolations, (v: any) => `- ${String(v)}`).forEach(l => contentLines.push(l));
        contentLines.push('');
        if (a.fullTranscript && a.fullTranscript !== 'N/A') {
            contentLines.push('Full Transcript:');
            contentLines.push(String(a.fullTranscript));
            contentLines.push('');
        }
        contentLines.push('=====================================');

        const content = contentLines.join('\n');

        await fsp.writeFile(fullPath, content, { encoding: 'utf8' });

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ fileName: analysisFileName, relativePath: `${relPathPrefix}/${analysisFileName}`, analysisDate }));
    } catch (error) {
        console.error('Error saving analysis file:', error);
        res.statusCode = 500;
        res.end('Error saving analysis. Please check write permissions in app/data/.');
    }
};

const handleSaveTestimony = async (req: IncomingMessage, res: ServerResponse) => {
    try {
        await ensureTestimoniesDirectory();
        const body = await readJsonBody(req);
        const { kind, employeeName, employeeId, text, summary } = body || {};
        const savedAt = new Date().toISOString();
        const base = kind === 'employee' ? `Employee Testimony - ${sanitizeFileName(employeeName || employeeId || 'unknown')}` : 'My Testimony';
        const fileNameDesired = `${base}.txt`;
        const { fileName, fullPath } = await getUniqueFilePathIn(TESTIMONIES_DIR, sanitizeFileName(fileNameDesired));

        const lines: string[] = [];
        lines.push('=====================================');
        lines.push(`Type: ${kind === 'employee' ? 'Employee' : 'User'}`);
        if (employeeName) lines.push(`Employee: ${employeeName}`);
        if (employeeId) lines.push(`Employee ID: ${employeeId}`);
        lines.push(`Saved At: ${savedAt}`);
        lines.push('-------------------------------------');
        if (summary) {
            lines.push('AI Context Summary:');
            lines.push(String(summary));
            lines.push('');
        }
        lines.push('Full Testimony:');
        lines.push(String(text || ''));
        lines.push('=====================================');
        await fsp.writeFile(fullPath, lines.join('\n'), { encoding: 'utf8' });

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ fileName, relativePath: `app/data/testimonies/${fileName}`, savedAt }));
    } catch (error) {
        console.error('Error saving testimony:', error);
        res.statusCode = 500;
        res.end('Unable to save testimony.');
    }
};

const storagePlugin = (): Plugin => {
    return {
        name: 'local-storage-plugin',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (!req.url) return next();

                if (req.method === 'GET' && req.url.startsWith('/api/storage/file/')) {
                    await handleOpenFile(req, res, req.url);
                    return;
                }

                if (req.method === 'GET' && req.url.startsWith('/api/storage/profile-file/')) {
                    await handleOpenProfileFile(req, res, req.url);
                    return;
                }

                if (req.method === 'POST' && req.url.startsWith('/api/storage/upload')) {
                    await handleUpload(req, res);
                    return;
                }

                if (req.method === 'POST' && req.url.startsWith('/api/storage/analysis')) {
                    await handleAnalysisSave(req, res);
                    return;
                }

                if (req.method === 'POST' && req.url.startsWith('/api/storage/testimony')) {
                    await handleSaveTestimony(req, res);
                    return;
                }

                if (req.method === 'POST' && req.url.startsWith('/api/storage/profile')) {
                    await handleSaveProfile(req, res);
                    return;
                }

                if (req.method === 'GET' && req.url.startsWith('/api/storage/profiles')) {
                    await handleListProfiles(req, res);
                    return;
                }

                if (req.method === 'POST' && req.url.startsWith('/api/storage/profile-delete')) {
                    await handleDeleteProfile(req, res);
                    return;
                }

                if (req.method === 'POST' && req.url.startsWith('/api/storage/evidence-delete')) {
                    await handleEvidenceDelete(req, res);
                    return;
                }

                if (req.method === 'POST' && req.url.startsWith('/api/storage/evidence-rename')) {
                    await handleEvidenceRename(req, res);
                    return;
                }

                if (req.method === 'POST' && req.url.startsWith('/api/storage/reveal')) {
                    await handleReveal(req, res);
                    return;
                }

                next();
            });
        },
        configurePreviewServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (!req.url) return next();

                if (req.method === 'GET' && req.url.startsWith('/api/storage/file/')) {
                    await handleOpenFile(req, res, req.url);
                    return;
                }

                if (req.method === 'GET' && req.url.startsWith('/api/storage/profile-file/')) {
                    await handleOpenProfileFile(req, res, req.url);
                    return;
                }

                if (req.method === 'POST' && req.url.startsWith('/api/storage/upload')) {
                    await handleUpload(req, res);
                    return;
                }

                if (req.method === 'POST' && req.url.startsWith('/api/storage/analysis')) {
                    await handleAnalysisSave(req, res);
                    return;
                }

                if (req.method === 'POST' && req.url.startsWith('/api/storage/testimony')) {
                    await handleSaveTestimony(req, res);
                    return;
                }

                if (req.method === 'POST' && req.url.startsWith('/api/storage/profile')) {
                    await handleSaveProfile(req, res);
                    return;
                }

                if (req.method === 'GET' && req.url.startsWith('/api/storage/profiles')) {
                    await handleListProfiles(req, res);
                    return;
                }

                if (req.method === 'POST' && req.url.startsWith('/api/storage/profile-delete')) {
                    await handleDeleteProfile(req, res);
                    return;
                }

                if (req.method === 'POST' && req.url.startsWith('/api/storage/evidence-delete')) {
                    await handleEvidenceDelete(req, res);
                    return;
                }

                if (req.method === 'POST' && req.url.startsWith('/api/storage/evidence-rename')) {
                    await handleEvidenceRename(req, res);
                    return;
                }

                if (req.method === 'POST' && req.url.startsWith('/api/storage/reveal')) {
                    await handleReveal(req, res);
                    return;
                }

                next();
            });
        },
    };
};

export default storagePlugin;
