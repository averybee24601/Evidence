
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, EvidenceFile, AnalysisResult, Employee, RelationshipMapData } from "../types";
import { fileToBase64, extractVideoFrames, fileToText, fetchProfileImageAsBase64 } from "./utils";

const GOOGLE_API_KEY =
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    throw new Error("Set GEMINI_API_KEY in your environment to use Google AI Studio.");
}

const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

export const CURRENT_MODEL_NAME = 'gemini-3-pro-preview';

// Keep model randomness low to reduce hallucinations
const DEFAULT_MODEL_CONFIG = {
    temperature: 0.2,
    topP: 0.9,
    topK: 40,
    maxOutputTokens: 8192,
};

const SYSTEM_INSTRUCTION = `You are an AI Evidence Companion. Your mission is to help users review and understand multimedia materials related to potential abuse or manipulation in a workplace serving adults with disabilities — objectively, safely, and in context.

Your core principles are:
1.  **Objectivity & Respect:** Describe what you see and hear factually using neutral, respectful language (e.g., "suggestive dance movements" not judgmental terms). Report actions, tones, and environmental details without interpretation. Treat all findings as observations, not conclusions of intent or guilt. Always note uncertainties (e.g., "unclear video quality").
2.  **Safety & Ethics:** You are not a legal expert. Do not offer legal advice or conclusions of guilt. Instead, identify potential indicators or concerning cues based on the evidence provided. Identify potential violations of workplace policy or ethics, framing them as possibilities, not certainties.
3.  **Context is Key:** Always review the user's testimony and the summary of past evidence before analyzing a new file. Your goal is to connect the dots and build a coherent narrative over time.
4.  **Precision:** Always include precise timestamps (HH:MM:SS) for any event or observation you describe from a video or audio file. If a file is a document or image, use "N/A" for timestamps.
5.  **Confidentiality:** Treat all information as private and sensitive.
6.  **No Speculation:** If something is not visible/audible in the provided media, or is uncertain, say "unclear" and DO NOT infer. Stay within the provided JSON schema strictly.
7.  **Empty Arrays for No Data:** If you do not find specific evidence for a field (e.g., no children detected, no employees recognized, no cross-references), YOU MUST RETURN AN EMPTY ARRAY or FALSE. Do not make up data to fill the schema.`;

const SYSTEM_INSTRUCTION_QA = `You are an AI Legal Information Assistant. Your purpose is to provide general information about legal topics, procedures, and concepts using web search. 

**IMPORTANT RULES:**
1.  **You are NOT a lawyer.** You MUST NOT provide legal advice.
2.  **Always include a disclaimer** at the end of every response stating: "This information is for educational purposes only and does not constitute legal advice. You should consult with a qualified legal professional for advice regarding your individual situation."
3.  Use Google Search to find relevant and up-to-date information.
4.  Answer the user's question clearly and concisely.
5.  Cite your sources from the web search results.`;

const SYSTEM_INSTRUCTION_QA_CONTEXT = `You are an AI Case Analyst Assistant. Your purpose is to help the user understand their entire case by synthesizing all provided context.

**IMPORTANT RULES:**
1.  **Synthesize, Don't Speculate:** Base your answers *exclusively* on the provided "CASE CONTEXT" (which includes testimony, evidence summaries, and profiles). Do not invent facts or assume information not present.
2.  **Identify Patterns:** Your primary goal is to identify patterns, connections, and overarching themes across all the evidence.
3.  **Use Web Search for Concepts:** Use Google Search to understand and explain general legal or procedural concepts mentioned in the user's query (e.g., "retaliation," "hostile work environment"), but apply these concepts *only* to the facts within the provided CASE CONTEXT.
4.  **You are NOT a lawyer.** You MUST NOT provide legal advice. Your analysis is for informational purposes to help the user organize their thoughts.
5.  **Always include a disclaimer** at the end of every response stating: "This information is for educational purposes only and does not constitute legal advice. You should consult with a qualified legal professional for advice regarding your individual situation."
6.  Cite any web sources used for defining concepts.`;

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING, description: 'A brief, objective summary of the content in 2-3 sentences, considering all context provided.' },
        newFindingsSummary: { type: Type.STRING, description: 'A very short summary of what this specific file adds to the case that was not present in the past evidence summary.' },
        severityScore: { type: Type.NUMBER, description: 'A score from 1 (minor/neutral) to 10 (severe/abusive) based on concerning cues. The presence of children should dramatically increase this score for any negative behavior.' },
        confidenceScore: { type: Type.NUMBER, description: 'A score from 1-100 representing your confidence in this analysis, considering factors like media quality and clarity.' },
        childrenDetected: { type: Type.BOOLEAN, description: 'Analyze the media and determine if children are present. Return true if children are visually or audibly detected, otherwise false.' },
        keyObservations: {
            type: Type.ARRAY,
            description: 'A list of specific, timestamped observations of concerning behavior. THIS IS CRITICAL: EVERY observation MUST have a precise HH:MM:SS timestamp.',
            items: {
                type: Type.OBJECT,
                properties: {
                    timestamp: { type: Type.STRING, description: 'Timestamp in HH:MM:SS format for video/audio. Use "N/A" for images/documents. This is mandatory for time-based media.' },
                    description: { type: Type.STRING, description: 'A factual, objective description of a single, distinct observation.' }
                },
                required: ['timestamp', 'description']
            }
        },
        timelineEvents: {
            type: Type.ARRAY,
            description: 'A list of key events from this file to build a timeline. Extract factual events, not just concerning ones.',
            items: {
                type: Type.OBJECT,
                properties: {
                    timestamp: { type: Type.STRING, description: 'Timestamp in HH:MM:SS format. "N/A" for images/documents.' },
                    description: { type: Type.STRING, description: 'A neutral description of the event (e.g., "Jose and Maria are talking in the kitchen.").' },
                    subjects: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'A list of names of people involved in this event.' }
                },
                required: ['timestamp', 'description', 'subjects']
            }
        },
        crossReferences: {
            type: Type.ARRAY,
            description: 'Identify patterns or connections between THIS file and the "PAST EVIDENCE SUMMARY".',
            items: {
                type: Type.OBJECT,
                properties: {
                    fileName: { type: Type.STRING, description: 'The name of the past file this new evidence connects to.' },
                    observation: { type: Type.STRING, description: 'Describe the connection or pattern (e.g., "This conversation continues the topic of finances mentioned in transcript-01.txt").' }
                },
                required: ['fileName', 'observation']
            }
        },
        emotionalAnalysis: {
            type: Type.ARRAY,
            description: 'Analyze the emotional tone. Identify emotions like anger, fear, distress, or intimidation.',
            items: {
                type: Type.OBJECT,
                properties: {
                    emotion: { type: Type.STRING, description: 'The detected emotion (e.g., "Anger", "Fear").' },
                    evidence: { type: Type.STRING, description: 'The evidence for this emotion (e.g., "Raised voice, sharp tone at 01:23").' }
                },
                required: ['emotion', 'evidence']
            }
        },
        recognizedEmployees: {
            type: Type.ARRAY,
            description: 'A list of known employees recognized in the media. If no one is recognized, return an empty array.',
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: 'The name of the recognized employee.' },
                    timestamp: { type: Type.STRING, description: 'Timestamp of their appearance. "N/A" for images/documents.' },
                    confidence: { type: Type.NUMBER, description: 'Confidence score from 0 to 100 for this recognition match.' }
                },
                required: ['name', 'timestamp', 'confidence']
            }
        },
        potentialViolations: {
            type: Type.ARRAY,
            description: 'List potential legal or ethical categories violated, without making definitive claims.',
            items: { type: Type.STRING }
        },
        fullTranscript: { type: Type.STRING, description: 'A full transcription of any speech in the audio or video, or the full text of a document. Use "N/A" if not applicable.' }
    },
    required: ['summary', 'newFindingsSummary', 'severityScore', 'confidenceScore', 'childrenDetected', 'keyObservations', 'timelineEvents', 'crossReferences', 'emotionalAnalysis', 'recognizedEmployees', 'potentialViolations', 'fullTranscript']
};

const relationshipMapSchema = {
    type: Type.OBJECT,
    properties: {
        overallSummary: { type: Type.STRING, description: 'A high-level summary of the overall relationship dynamics and key patterns observed across all evidence.' },
        nodes: {
            type: Type.ARRAY,
            description: 'A list of all unique individuals identified in the evidence.',
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: 'The full name of the individual.' }
                },
                required: ['id']
            }
        },
        links: {
            type: Type.ARRAY,
            description: 'A list of connections representing interactions between pairs of individuals.',
            items: {
                type: Type.OBJECT,
                properties: {
                    source: { type: Type.STRING, description: 'The name of the first person in the interaction.' },
                    target: { type: Type.STRING, description: 'The name of the second person in the interaction.' },
                    value: { type: Type.NUMBER, description: 'The total count of distinct interactions between these two people.' },
                    sentiment: {
                        type: Type.STRING,
                        description: 'The overall sentiment of the interactions: "positive", "negative", "neutral", or "mixed".',
                        enum: ['positive', 'negative', 'neutral', 'mixed']
                    },
                    summary: { type: Type.STRING, description: 'A brief summary describing the nature of the relationship and common interaction themes.' },
                    interactions: {
                        type: Type.ARRAY,
                        description: 'A list of specific, concrete examples of their interactions.',
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                file: { type: Type.STRING, description: 'The file name where the interaction occurred.' },
                                timestamp: { type: Type.STRING, description: 'The timestamp (HH:MM:SS or N/A) of the interaction.' },
                                description: { type: Type.STRING, description: 'A brief description of the specific interaction.' }
                            },
                            required: ['file', 'timestamp', 'description']
                        }
                    }
                },
                required: ['source', 'target', 'value', 'sentiment', 'summary', 'interactions']
            }
        }
    },
    required: ['overallSummary', 'nodes', 'links']
};

function validateAndFixAnalysisResult(data: any): AnalysisResult {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid analysis result: not an object');
    }
    return {
        summary: typeof data.summary === 'string' ? data.summary : 'No summary available.',
        newFindingsSummary: typeof data.newFindingsSummary === 'string' ? data.newFindingsSummary : 'No new findings.',
        severityScore: typeof data.severityScore === 'number' ? data.severityScore : 0,
        confidenceScore: typeof data.confidenceScore === 'number' ? data.confidenceScore : 0,
        childrenDetected: typeof data.childrenDetected === 'boolean' ? data.childrenDetected : false,
        keyObservations: Array.isArray(data.keyObservations) ? data.keyObservations : [],
        timelineEvents: Array.isArray(data.timelineEvents) ? data.timelineEvents : [],
        crossReferences: Array.isArray(data.crossReferences) ? data.crossReferences : [],
        emotionalAnalysis: Array.isArray(data.emotionalAnalysis) ? data.emotionalAnalysis : [],
        recognizedEmployees: Array.isArray(data.recognizedEmployees) ? data.recognizedEmployees : [],
        potentialViolations: Array.isArray(data.potentialViolations) ? data.potentialViolations : [],
        fullTranscript: typeof data.fullTranscript === 'string' ? data.fullTranscript : 'N/A',
    };
}

function cleanJson(text: string): string {
    let cleaned = text.trim();
    // Remove markdown code blocks if present
    if (cleaned.startsWith('```')) {
        const firstNewline = cleaned.indexOf('\n');
        const lastNewline = cleaned.lastIndexOf('```');
        if (firstNewline !== -1 && lastNewline !== -1) {
            cleaned = cleaned.substring(firstNewline + 1, lastNewline).trim();
        }
    }
    return cleaned;
}

export async function researchEmployee(employee: Omit<Employee, 'id' | 'status' | 'aiEnhancedDetails'>): Promise<string> {
    const model = CURRENT_MODEL_NAME;
    const geminiModel = ai.models;

    let prompt = `Analyze the provided information for a person named ${employee.name} to create a detailed, objective physical description for identification purposes. Focus on stable features.
    
    User-provided details: "${employee.details}"`;

    const parts: any[] = [];

    if (employee.referenceUrl) {
        prompt += `\nReference URL (analyze public information if possible): ${employee.referenceUrl}`;
    }

    parts.push({ text: prompt });

    if (employee.referenceImage) {
        parts.push({ text: "\n\nUse the following reference image as the primary source for the physical description:" });
        parts.push({ inlineData: { mimeType: employee.referenceImage.mimeType, data: employee.referenceImage.base64 } });
    }

    const response = await geminiModel.generateContent({
        model,
        contents: { parts },
        config: {
            ...DEFAULT_MODEL_CONFIG,
            systemInstruction: "You are an AI assistant tasked with creating objective physical descriptions for identification. Do not infer personality or make assumptions. Be factual and detailed based ONLY on the provided information.",
        }
    });

    return response.text ? response.text.trim() : "";
}


export async function summarizeTestimony(testimony: string): Promise<string> {
    const model = CURRENT_MODEL_NAME;
    const geminiModel = ai.models;

    const prompt = `Read the following user testimony and provide a very brief, one-sentence summary of the main context or concern. This summary will be shown to the user to confirm you've understood their situation. Testimony: "${testimony}"`;

    const response = await geminiModel.generateContent({
        model,
        contents: { parts: [{ text: prompt }] },
        config: {
            ...DEFAULT_MODEL_CONFIG,
            systemInstruction: "You are an AI assistant helping a user analyze evidence. Your task is to summarize their testimony concisely to show you've understood it.",
        }
    });

    return response.text ? response.text.trim() : "No summary available.";
}


export async function analyzeEvidence(
    file: EvidenceFile,
    allEmployees: Employee[],
    caseSummary: string,
    testimony: string,
    instructions?: string,
    manualTags?: string[],
): Promise<AnalysisResult> {
    const modelName = CURRENT_MODEL_NAME;
    const geminiModel = ai.models;

    const ensureFileObject = async (ef: EvidenceFile): Promise<File | null> => {
        if (ef.file) return ef.file;
        if (!ef.storedFileName) return null;
        try {
            const resp = await fetch(`/api/storage/file/${encodeURIComponent(ef.storedFileName)}`);
            if (!resp.ok) return null;
            const blob = await resp.blob();
            const type = blob.type || (ef.type === 'image' ? 'image/png' : ef.type === 'audio' ? 'audio/mpeg' : ef.type === 'video' ? 'video/mp4' : 'text/plain');
            return new File([blob], ef.name, { type });
        } catch {
            return null;
        }
    };

    const fileObj = await ensureFileObject(file);
    if (!fileObj) {
        throw new Error(`Could not retrieve file content for ${file.name}`);
    }

    let parts: any[] = [];

    let contextPrompt = "--- START OF CONTEXT ---\n";
    if (testimony) {
        contextPrompt += `**User's Testimony:**\n${testimony}\n\n`;
    }
    if (caseSummary) {
        contextPrompt += `**PAST EVIDENCE SUMMARY (Use this to find patterns and connections):**\n${caseSummary}\n\n`;
    }
    contextPrompt += `**Current File Context:**\n- Location: ${file.location || 'Not Specified'}\n`;
    contextPrompt += "--- END OF CONTEXT ---\n\n";

    let prompt: string;

    if (manualTags && manualTags.length > 0) {
        // Fallback prompt for re-analysis
        prompt = `${contextPrompt}RE-ANALYSIS INSTRUCTION: The user has manually identified that the following employees are present in this file: **${manualTags.join(', ')}**. Please re-analyze this ${file.type} file named "${file.name}" with this new information. Your primary goal is to find their interactions and analyze their behavior. All other instructions still apply.`;
    } else {
        // Standard initial analysis prompt
        prompt = `${contextPrompt}Analyze this ${file.type} file named "${file.name}". Follow your core principles and use all the context provided. Extract timeline events, find cross-references to the past evidence, and summarize what new information this file provides.

**CRITICAL TASKS:**
1.  **Child Detection:** You MUST analyze the media to determine if children are present. Any negative behavior is significantly more severe if children are present. Report your finding in the 'childrenDetected' field.
2.  **Employee Recognition:** Review the full list of employee profiles below. Scan the media to automatically identify if any of these individuals are present, using their names, descriptions, and reference images. Only include a person in 'recognizedEmployees' if you are reasonably confident based on visible evidence; otherwise return an empty array. Provide a confidence score 0-100.
3.  **Connect to Testimony:** If you find evidence that corroborates or contradicts the user's testimony, explicitly state the connection in your observation description (e.g., "This event at [timestamp] aligns with the user's testimony about...").
4.  **Avoid Speculation:** Only describe what is visible/audible in the provided media. If uncertain, write "unclear" and do not infer.
`;
    }

    if (instructions) {
        prompt += `\n**User's Specific Instructions for this File:** ${instructions}\n`;
    }


    if (allEmployees.length > 0) {
        prompt += `\n**EMPLOYEE PROFILES FOR RECOGNITION:**\n`;
        allEmployees.forEach(emp => {
            prompt += `- Name: ${emp.name}, User Details: ${emp.details}, AI Description: ${emp.aiEnhancedDetails || 'N/A'}\n`;
        });
    }

    // Add reference images for employees if available
    // Add reference images for employees using either in-memory base64 or disk-backed files
    const employeesWithAnyImage = allEmployees.filter(e => e.referenceImage || e.referenceImagePath);
    if (employeesWithAnyImage.length > 0) {
        prompt += `\nHere are reference images for the employees. Use them for identification.\n`;
        for (const emp of employeesWithAnyImage) {
            let image: { base64: string; mimeType: string } | null = null;
            if (emp.referenceImage) {
                image = { base64: emp.referenceImage.base64, mimeType: emp.referenceImage.mimeType };
            } else if (emp.referenceImagePath) {
                image = await fetchProfileImageAsBase64(emp.referenceImagePath);
            }
            if (image) {
                parts.push({ text: `Reference image for ${emp.name}:` });
                parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
            }
        }
    }

    if (file.type === 'image') {
        const base64Data = await fileToBase64(fileObj);
        parts.unshift({ text: prompt });
        parts.push({ inlineData: { mimeType: fileObj.type, data: base64Data } });
    } else if (file.type === 'video') {
        let frames: { base64: string; mimeType: string }[] = [];
        try {
            frames = await extractVideoFrames(fileObj, 16);
        } catch (err) { }

        if (frames && frames.length > 0) {
            const frameParts = frames.map(frame => ({ inlineData: { mimeType: frame.mimeType, data: frame.base64 } }));
            prompt = `The user has uploaded a video. Here are sequential frames sampled evenly across the video. Analyze ONLY what is visible in these frames; do not assume anything between frames. ${prompt}`;
            parts.unshift({ text: prompt });
            parts.push(...frameParts);
        } else {
            // As a safer fallback, attach just the first frame to avoid oversized payloads
            try {
                const singleFrame = await extractVideoFrames(fileObj, 1);
                if (singleFrame && singleFrame.length === 1) {
                    parts.unshift({ text: `A video was provided but only a single frame could be extracted. Analyze conservatively and avoid speculation. ${prompt}` });
                    parts.push({ inlineData: { mimeType: singleFrame[0].mimeType, data: singleFrame[0].base64 } });
                } else {
                    throw new Error('No frames extracted');
                }
            } catch {
                const base64Data = await fileToBase64(fileObj);
                parts.unshift({ text: `A video was provided. Raw content attached. If decoding fails, state 'unclear' rather than speculating. ${prompt}` });
                parts.push({ inlineData: { mimeType: fileObj.type || 'video/mp4', data: base64Data } });
            }
        }
    } else if (file.type === 'audio') {
        const base64Data = await fileToBase64(fileObj);
        parts.unshift({ text: prompt });
        parts.push({ inlineData: { mimeType: fileObj.type, data: base64Data } });
    } else if (file.type === 'document') {
        const textContent = await fileToText(fileObj);
        prompt += `\n\n**DOCUMENT CONTENT TO ANALYZE:**\n${textContent}`;
        parts.unshift({ text: prompt });
    }

    const response = await geminiModel.generateContent({
        model: modelName,
        contents: { parts },
        config: {
            ...DEFAULT_MODEL_CONFIG,
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: analysisSchema,
        }
    });

    const jsonString = cleanJson(response.text || "{}");
    try {
        const raw = JSON.parse(jsonString);
        return validateAndFixAnalysisResult(raw);
    } catch (e) {
        console.error('Failed to parse single-file analysis result:', jsonString);
        throw new Error('The analysis failed to produce valid JSON output.');
    }
}


// Analyze two files together, focusing the output on `primary` but cross-referencing `partner`.
export async function analyzeEvidenceWithPartner(
    primary: EvidenceFile,
    partner: EvidenceFile,
    allEmployees: Employee[],
    caseSummary: string,
    testimony: string,
    instructions?: string,
): Promise<AnalysisResult> {
    // Pick a stronger model if any is a video
    const modelName = CURRENT_MODEL_NAME;
    const geminiModel = ai.models;

    // Helper: ensure we have a File object for attachment
    const ensureFileObject = async (ef: EvidenceFile): Promise<File | null> => {
        if (ef.file) return ef.file;
        if (!ef.storedFileName) return null;
        try {
            const resp = await fetch(`/api/storage/file/${encodeURIComponent(ef.storedFileName)}`);
            if (!resp.ok) return null;
            const blob = await resp.blob();
            const type = blob.type || (ef.type === 'image' ? 'image/png' : ef.type === 'audio' ? 'audio/mpeg' : ef.type === 'video' ? 'video/mp4' : 'text/plain');
            return new File([blob], ef.name, { type });
        } catch {
            return null;
        }
    };

    // Build shared context
    let parts: any[] = [];
    let contextPrompt = "--- START OF CONTEXT ---\n";
    if (testimony) {
        contextPrompt += `**User's Testimony:**\n${testimony}\n\n`;
    }
    if (caseSummary) {
        contextPrompt += `**PAST EVIDENCE SUMMARY (Use this to find patterns and connections):**\n${caseSummary}\n\n`;
    }
    contextPrompt += `**Current File Context:**\n- Primary File: ${primary.name}\n- Partner File: ${partner.name}\n- Primary Location: ${primary.location || 'Not Specified'}\n`;
    contextPrompt += "--- END OF CONTEXT ---\n\n";

    let prompt = `${contextPrompt}Analyze BOTH provided files together. Focus this report on the PRIMARY file "${primary.name}", but reference the PARTNER file "${partner.name}" wherever relevant. Align their timelines, highlight corroborations or contradictions, and populate 'crossReferences' with connections to the partner file by name.

**CRITICAL TASKS (PAIR ANALYSIS):**
1. Consider both files jointly. When describing any observation from the primary file, include matching/related moments from the partner when applicable.
2. Maintain all requirements from the standard analysis (timestamps, recognition, childrenDetected, etc.).
3. Prefer concise, factual descriptions and avoid speculation.
`;

    if (instructions) {
        prompt += `\n**User's Additional Instructions:** ${instructions}\n`;
    }

    if (allEmployees.length > 0) {
        prompt += `\n**EMPLOYEE PROFILES FOR RECOGNITION:**\n`;
        allEmployees.forEach(emp => {
            prompt += `- Name: ${emp.name}, User Details: ${emp.details}, AI Description: ${emp.aiEnhancedDetails || 'N/A'}\n`;
        });
    }

    // Attach employee reference images if available
    const employeesWithAnyImage = allEmployees.filter(e => e.referenceImage || e.referenceImagePath);
    if (employeesWithAnyImage.length > 0) {
        prompt += `\nHere are reference images for the employees. Use them for identification.\n`;
        for (const emp of employeesWithAnyImage) {
            let image: { base64: string; mimeType: string } | null = null;
            if (emp.referenceImage) {
                image = { base64: emp.referenceImage.base64, mimeType: emp.referenceImage.mimeType };
            } else if (emp.referenceImagePath) {
                image = await fetchProfileImageAsBase64(emp.referenceImagePath);
            }
            if (image) {
                parts.push({ text: `Reference image for ${emp.name}:` });
                parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
            }
        }
    }

    const attachFile = async (ef: EvidenceFile, label: string, isPrimary: boolean) => {
        const f = await ensureFileObject(ef);
        if (!f) return;
        if (ef.type === 'image') {
            const base64Data = await fileToBase64(f);
            parts.push({ text: `${label} (${isPrimary ? 'primary' : 'partner'}) image:` });
            parts.push({ inlineData: { mimeType: f.type, data: base64Data } });
        } else if (ef.type === 'video') {
            let frames: { base64: string; mimeType: string }[] = [];
            try {
                frames = await extractVideoFrames(f, isPrimary ? 16 : 8);
            } catch { }
            if (frames && frames.length > 0) {
                parts.push({ text: `${label} (${isPrimary ? 'primary' : 'partner'}) video frames:` });
                parts.push(...frames.map(fr => ({ inlineData: { mimeType: fr.mimeType, data: fr.base64 } })));
            } else {
                const base64Data = await fileToBase64(f);
                parts.push({ text: `${label} (${isPrimary ? 'primary' : 'partner'}) raw video:` });
                parts.push({ inlineData: { mimeType: f.type || 'video/mp4', data: base64Data } });
            }
        } else if (ef.type === 'audio') {
            const base64Data = await fileToBase64(f);
            parts.push({ text: `${label} (${isPrimary ? 'primary' : 'partner'}) audio:` });
            parts.push({ inlineData: { mimeType: f.type, data: base64Data } });
        } else if (ef.type === 'document') {
            const textContent = await fileToText(f);
            parts.push({ text: `\n\n**${label} (${isPrimary ? 'primary' : 'partner'}) DOCUMENT CONTENT:**\n${textContent}` });
        }
    };

    // Put prompt at the beginning
    parts.unshift({ text: prompt });

    // Attach primary first, then partner
    await attachFile(primary, primary.name, true);
    await attachFile(partner, partner.name, false);

    const response = await geminiModel.generateContent({
        model: modelName,
        contents: { parts },
        config: {
            ...DEFAULT_MODEL_CONFIG,
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: analysisSchema,
        }
    });

    const jsonString = cleanJson(response.text || "{}");
    try {
        const raw = JSON.parse(jsonString);
        return validateAndFixAnalysisResult(raw);
    } catch (e) {
        console.error('Failed to parse pair analysis result:', jsonString);
        throw new Error('The analysis failed to produce valid JSON output.');
    }
}

// Analyze two files together as a single unified case (no primary), producing one combined report
export async function analyzeEvidenceUnified(
    files: EvidenceFile[],
    allEmployees: Employee[],
    caseSummary: string,
    testimony: string,
    instructions?: string,
): Promise<AnalysisResult> {
    if (!Array.isArray(files) || files.length < 2) {
        throw new Error('Unified analysis requires at least two files.');
    }
    const modelName = CURRENT_MODEL_NAME;
    const geminiModel = ai.models;

    const ensureFileObject = async (ef: EvidenceFile): Promise<File | null> => {
        if (ef.file) return ef.file;
        if (!ef.storedFileName) return null;
        try {
            const resp = await fetch(`/api/storage/file/${encodeURIComponent(ef.storedFileName)}`);
            if (!resp.ok) {
                console.error(`Failed to fetch file for unified analysis: ${ef.name} (Status: ${resp.status})`);
                return null;
            }
            const blob = await resp.blob();
            const type = blob.type || (ef.type === 'image' ? 'image/png' : ef.type === 'audio' ? 'audio/mpeg' : ef.type === 'video' ? 'video/mp4' : 'text/plain');
            return new File([blob], ef.name, { type });
        } catch (error) {
            console.error(`Error retrieving file for unified analysis: ${ef.name}`, error);
            return null;
        }
    };

    let parts: any[] = [];
    let contextPrompt = "--- START OF CONTEXT ---\n";
    if (testimony) {
        contextPrompt += `**User's Testimony:**\n${testimony}\n\n`;
    }
    if (caseSummary) {
        contextPrompt += `**PAST EVIDENCE SUMMARY (Use this to find patterns and connections):**\n${caseSummary}\n\n`;
    }
    contextPrompt += `**Unified Case Context:**\n`;
    files.forEach((ef, index) => {
        const locationSuffix = ef.location ? ` @ ${ef.location}` : '';
        contextPrompt += `- File ${index + 1}: ${ef.name}${locationSuffix}\n`;
    });
    contextPrompt += "--- END OF CONTEXT ---\n\n";

    let prompt = `${contextPrompt}Analyze ALL provided files together as a SINGLE CASE. Your output must synthesize combined content and context from the full batch, surfacing connections, contradictions, and timelines that only appear when the files are considered together.\n
CRITICAL REQUIREMENTS:\n
1. Treat every file as part of one case; DO NOT produce separate mini-reports.\n
2. Build a unified timeline across all files. Reference file names and timestamps where helpful.\n
3. Populate 'crossReferences' using connections between the batch items as well as past evidence.\n
4. Maintain all standard requirements (timestamps, recognition, childrenDetected, etc.).\n
5. Be concise, factual, and avoid speculation.\n
6. **CRITICAL:** If you do not find specific evidence for a category (e.g., no children, no employees, no violations), return an empty array or false. DO NOT HALLUCINATE connections that do not exist.\n`;

    if (instructions) {
        prompt += `\n**User's Additional Instructions:** ${instructions}\n`;
    }

    if (allEmployees.length > 0) {
        prompt += `\n**EMPLOYEE PROFILES FOR RECOGNITION:**\n`;
        allEmployees.forEach(emp => {
            prompt += `- Name: ${emp.name}, User Details: ${emp.details}, AI Description: ${emp.aiEnhancedDetails || 'N/A'}\n`;
        });
    }

    // Attach employee reference images if available
    const employeesWithAnyImage = allEmployees.filter(e => e.referenceImage || e.referenceImagePath);
    if (employeesWithAnyImage.length > 0) {
        prompt += `\nHere are reference images for the employees. Use them for identification.\n`;
        for (const emp of employeesWithAnyImage) {
            let image: { base64: string; mimeType: string } | null = null;
            if (emp.referenceImage) {
                image = { base64: emp.referenceImage.base64, mimeType: emp.referenceImage.mimeType };
            } else if (emp.referenceImagePath) {
                image = await fetchProfileImageAsBase64(emp.referenceImagePath);
            }
            if (image) {
                parts.push({ text: `Reference image for ${emp.name}:` });
                parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
            }
        }
    }

    const attachFile = async (ef: EvidenceFile, label: string) => {
        const f = await ensureFileObject(ef);
        if (!f) {
            console.warn(`Skipping file attachment for ${label} because it could not be loaded.`);
            return;
        }
        if (ef.type === 'image') {
            const base64Data = await fileToBase64(f);
            parts.push({ text: `${label} image:` });
            parts.push({ inlineData: { mimeType: f.type, data: base64Data } });
        } else if (ef.type === 'video') {
            let frames: { base64: string; mimeType: string }[] = [];
            try {
                frames = await extractVideoFrames(f, 16);
            } catch (e) {
                console.warn(`Failed to extract frames for ${label}`, e);
            }
            if (frames && frames.length > 0) {
                parts.push({ text: `${label} video frames:` });
                parts.push(...frames.map(fr => ({ inlineData: { mimeType: fr.mimeType, data: fr.base64 } })));
            } else {
                const base64Data = await fileToBase64(f);
                parts.push({ text: `${label} raw video:` });
                parts.push({ inlineData: { mimeType: f.type || 'video/mp4', data: base64Data } });
            }
        } else if (ef.type === 'audio') {
            const base64Data = await fileToBase64(f);
            parts.push({ text: `${label} audio:` });
            parts.push({ inlineData: { mimeType: f.type, data: base64Data } });
        } else if (ef.type === 'document') {
            const textContent = await fileToText(f);
            parts.push({ text: `\n\n**${label} DOCUMENT CONTENT:**\n${textContent}` });
        }
    };

    parts.unshift({ text: prompt });
    for (const evidenceFile of files) {
        await attachFile(evidenceFile, evidenceFile.name);
    }

    const response = await geminiModel.generateContent({
        model: modelName,
        contents: { parts },
        config: {
            ...DEFAULT_MODEL_CONFIG,
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: analysisSchema,
        }
    });

    const jsonString = cleanJson(response.text || "{}");
    try {
        const raw = JSON.parse(jsonString);
        return validateAndFixAnalysisResult(raw);
    } catch (e) {
        console.error("Failed to parse unified analysis result:", jsonString);
        throw new Error("The analysis failed to produce valid JSON output.");
    }
}


export async function processChatMessage(prompt: string, history: ChatMessage[]): Promise<string> {
    const model = CURRENT_MODEL_NAME;
    const geminiModel = ai.models;

    const response = await geminiModel.generateContent({
        model,
        contents: { parts: [{ text: prompt }] },
        config: {
            ...DEFAULT_MODEL_CONFIG,
            systemInstruction: SYSTEM_INSTRUCTION,
        },
    });

    return response.text || "No response generated.";
}

export async function processGeneralQuery(prompt: string, caseContext?: string): Promise<string> {
    const model = CURRENT_MODEL_NAME;
    const geminiModel = ai.models;

    const systemInstruction = caseContext ? SYSTEM_INSTRUCTION_QA_CONTEXT : SYSTEM_INSTRUCTION_QA;
    const fullPrompt = caseContext
        ? `${caseContext}\n\nBased on the entire case context provided above, please answer the following question:\n\n${prompt}`
        : prompt;

    const response = await geminiModel.generateContent({
        model,
        contents: { parts: [{ text: fullPrompt }] },
        config: {
            ...DEFAULT_MODEL_CONFIG,
            tools: [{ googleSearch: {} }],
            systemInstruction: systemInstruction,
        },
    });

    let text = response.text || "";

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map(chunk => chunk.web?.uri)
        .filter(Boolean) ?? [];

    if (sources.length > 0) {
        text += '\n\n**Sources:**\n' + [...new Set(sources)].map(uri => `- ${uri}`).join('\n');
    }

    text += '\n\n---\n*This information is for educational purposes only and does not constitute legal advice. You should consult with a qualified legal professional for advice regarding your individual situation.*';

    return text;
}


export async function generateRelationshipMap(files: EvidenceFile[]): Promise<RelationshipMapData> {
    const model = CURRENT_MODEL_NAME; // Use a more powerful model for this complex synthesis
    const geminiModel = ai.models;

    const analyzedFiles = files.filter(f => f.status === 'analyzed' && f.analysis);
    if (analyzedFiles.length < 1) {
        throw new Error("Not enough analyzed evidence to generate a map.");
    }

    let evidenceContext = '--- START OF ANALYZED EVIDENCE ---\n';
    analyzedFiles.forEach(file => {
        evidenceContext += `
File Name: ${file.name}
File Type: ${file.type}
Recognized Employees: ${file.analysis!.recognizedEmployees.map(e => e.name).join(', ') || 'None'}
Timeline Events:
${file.analysis!.timelineEvents.map(e => `- [${e.timestamp}] ${e.description} (Subjects: ${e.subjects.join(', ')})`).join('\n')}
---
`;
    });
    evidenceContext += '--- END OF ANALYZED EVIDENCE ---\n\n';

    const prompt = `${evidenceContext}
You are a forensic analyst and relationship mapping expert. Your task is to synthesize all the provided evidence into a structured relationship map.

**Instructions:**
1.  **Identify Nodes:** Identify every unique person mentioned as a "Subject" in the timeline events or in "Recognized Employees". These are your nodes.
2.  **Establish Links:** For every pair of people who interact in an event, create a link.
3.  **Analyze Links:** For each link (pair of people):
    a. Count the total number of interactions they have across all files. This is 'value'.
    b. Summarize the a summary of their relationship based on all their interactions.
    c. Determine the overall 'sentiment' of their interactions ('positive', 'negative', 'neutral', 'mixed').
    d. Compile a list of all specific interactions, including the file name, timestamp, and a description of the event.
4.  **Overall Summary:** Provide a high-level summary of the case dynamics, pointing out key relationships, patterns of isolation, or conflicts.
5.  **Output:** Return the data strictly in the provided JSON schema. Ensure all fields are populated correctly. The names in 'source', 'target', and 'nodes' must match exactly.
`;

    const response = await geminiModel.generateContent({
        model,
        contents: { parts: [{ text: prompt }] },
        config: {
            ...DEFAULT_MODEL_CONFIG,
            systemInstruction: "You are an AI assistant that synthesizes complex information into a structured JSON relationship map.",
            responseMimeType: 'application/json',
            responseSchema: relationshipMapSchema,
        }
    });

    const jsonString = cleanJson(response.text || "{}");
    try {
        return JSON.parse(jsonString) as RelationshipMapData;
    } catch (e) {
        console.error('Failed to parse relationship map result:', jsonString);
        throw new Error('The relationship map failed to produce valid JSON output.');
    }
}
