
import { EvidenceFile } from '../types';

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // The API expects just the base64 data, not the data URL prefix
            const base64Data = result.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = (error) => reject(error);
    });
};

export const fileToText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => {
            resolve(reader.result as string);
        };
        reader.onerror = (error) => reject(error);
    });
};

export const hashFile = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}


export const extractVideoFrames = async (videoFile: File, maxFrames: number): Promise<{ base64: string; mimeType: string; }[]> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const frames: { base64: string; mimeType: string; }[] = [];

        if (!ctx) {
            return reject(new Error('Could not get canvas context'));
        }

        video.preload = 'metadata';
        const url = URL.createObjectURL(videoFile);
        video.src = url;
        video.muted = true;

        video.onloadedmetadata = async () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const duration = video.duration;
            if (duration === 0 || !isFinite(duration)) { // Handle cases where duration is not available
                URL.revokeObjectURL(url);
                return resolve([]);
            }
            const interval = duration / maxFrames;

            const captureFrame = async (time: number) => {
                 return new Promise<void>((resolve_frame) => {
                    video.currentTime = time;
                    video.onseeked = () => {
                        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                        const dataUrl = canvas.toDataURL('image/jpeg');
                        frames.push({
                            base64: dataUrl.split(',')[1],
                            mimeType: 'image/jpeg',
                        });
                        resolve_frame();
                    };
                });
            };

            for (let i = 0; i < maxFrames; i++) {
                await captureFrame(i * interval);
            }

            URL.revokeObjectURL(url);
            resolve(frames);
        };

        video.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(new Error(`Video load error: ${e}`));
        };
    });
};

export const generateReportText = (file: EvidenceFile): string => {
    if (!file.analysis) {
        return "No analysis has been performed on this file.";
    }

    const { analysis } = file;
    const separator = '---------------------------------\n';
    let content = '';
    
    content += `This document contains the AI-generated analysis of ${file.name}, including time-stamped findings and flagged content for use in case documentation.\n\n`;

    content += 'OFFICIAL ANALYSIS REPORT\n';
    content += '=========================================\n';
    content += `File Name: ${file.name}\n`;
    content += `File Type: ${file.type}\n`;
    content += `Location: ${file.location || 'Not Specified'}\n`;
    content += `Children Detected by AI: ${analysis.childrenDetected ? 'Yes' : 'No'}\n`;
    content += `SHA-256 Hash: ${file.hash || 'Not Calculated'}\n`;
    content += `Report Generated: ${new Date().toUTCString()}\n`;
    content += '=========================================\n\n';

    content += 'NEW FINDINGS SUMMARY (This File)\n';
    content += separator;
    content += `${analysis.newFindingsSummary}\n\n`;

    content += 'OVERALL SUMMARY\n';
    content += separator;
    content += `${analysis.summary}\n\n`;

    content += `AI CONFIDENCE: ${analysis.confidenceScore}%\n`;
    content += `SEVERITY SCORE: ${analysis.severityScore}/10\n\n`;

    content += 'KEY OBSERVATIONS\n';
    content += separator;
    if (analysis.keyObservations.length > 0) {
        analysis.keyObservations.forEach(obs => {
            content += `[${obs.timestamp}] ${obs.description}\n`;
        });
    } else {
        content += 'No specific concerning observations were flagged.\n';
    }
    content += '\n';

    content += 'TIMELINE EVENTS\n';
    content += separator;
    if (analysis.timelineEvents.length > 0) {
        analysis.timelineEvents.forEach(event => {
            content += `[${event.timestamp}] ${event.description} (Subjects: ${event.subjects.join(', ') || 'Unknown'})\n`;
        });
    } else {
        content += 'No timeline events were extracted.\n';
    }
    content += '\n';

    content += 'CROSS-REFERENCES TO OTHER EVIDENCE\n';
    content += separator;
    if (analysis.crossReferences.length > 0) {
        analysis.crossReferences.forEach(ref => {
            content += `- File "${ref.fileName}": ${ref.observation}\n`;
        });
    } else {
        content += 'No direct cross-references were identified.\n';
    }
    content += '\n';

    content += 'EMOTIONAL & TONE ANALYSIS\n';
    content += separator;
    if (analysis.emotionalAnalysis.length > 0) {
        analysis.emotionalAnalysis.forEach(emo => {
            content += `- ${emo.emotion}: ${emo.evidence}\n`;
        });
    } else {
        content += 'No distinct emotional cues were detected.\n';
    }
    content += '\n';

    content += 'RECOGNIZED EMPLOYEES\n';
    content += separator;
    if (analysis.recognizedEmployees.length > 0) {
        analysis.recognizedEmployees.forEach(emp => {
            content += `- ${emp.name} (at ${emp.timestamp})\n`;
        });
    } else {
        content += 'No registered employees were recognized in the file.\n';
    }
    content += '\n';
    
    content += 'POTENTIAL ETHICAL/POLICY VIOLATIONS\n';
    content += separator;
    if (analysis.potentialViolations.length > 0) {
        analysis.potentialViolations.forEach(v => {
            content += `- ${v}\n`;
        });
    } else {
        content += 'No potential violations were flagged based on the analysis.\n';
    }
    content += '\n';

    if (analysis.fullTranscript && analysis.fullTranscript !== 'N/A') {
        content += 'FULL TRANSCRIPT\n';
        content += separator;
        content += `${analysis.fullTranscript}\n\n`;
    }

    content += '=========================================\n';
    content += 'Disclaimer: This report was generated by an AI assistant. It is intended for informational purposes and does not constitute legal advice or a definitive finding of fact. All observations should be reviewed by a qualified human investigator.\n';

    return content;
};

export const fetchProfileImageAsBase64 = async (relativeImagePath: string): Promise<{ base64: string; mimeType: string } | null> => {
    try {
        // relativeImagePath is like: app/data/profiles/<name>.reference.<ext>
        const parts = relativeImagePath.split('/');
        const fileName = parts[parts.length - 1];
        const response = await fetch(`/api/storage/profile-file/${encodeURIComponent(fileName)}`);
        if (!response.ok) {
            return null;
        }
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const mimeType = blob.type || 'image/png';
        return { base64, mimeType };
    } catch {
        return null;
    }
};