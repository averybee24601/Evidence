import React, { useEffect, useRef, useState } from 'react';
import { EvidenceFile, TimelineEvent, CrossReference, RecognizedEmployee, Employee, EvidenceCase, AnalysisResult } from '../types';
import SeverityBar from './SeverityBar';
import ReportIcon from './icons/ReportIcon';
import SpeakerWaveIcon from './icons/SpeakerWaveIcon';
import PauseIcon from './icons/PauseIcon';
import StopIcon from './icons/StopIcon';
import RecognitionReview from './RecognitionReview';
import ManualRecognitionPanel from './ManualRecognitionPanel';
import { getPreferredVoice, pauseSpeaking, resumeSpeaking, speakInChunks, stopSpeaking } from '../services/tts';

interface AnalysisPanelProps {
    file: EvidenceFile | null;
    caseItem?: EvidenceCase | null;
    employees: Employee[];
    onRecognitionReview: (fileId: string, confirmedEmployees: RecognizedEmployee[]) => void;
    onRerunAnalysis: (fileId: string, manualTags: string[]) => void;
    onUpdateUnifiedAnalysis?: (caseId: string, updated: AnalysisResult) => void;
    onRerunUnifiedCase?: (caseId: string, instructions?: string) => void;
    onRerunSingle?: (fileId: string, instructions?: string) => void;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ file, caseItem = null, employees, onRecognitionReview, onRerunAnalysis, onUpdateUnifiedAnalysis, onRerunUnifiedCase, onRerunSingle }) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const voiceRef = useRef<SpeechSynthesisVoice | undefined>(undefined);
    const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

    // Unified edit state
    const [isEditingUnified, setIsEditingUnified] = useState(false);
    const [editUnified, setEditUnified] = useState<AnalysisResult | null>(null);
    const [rerunNotes, setRerunNotes] = useState<string>("These files are images only. Do not infer that children are present unless there is clear, direct, unambiguous visual evidence. If uncertain, set 'Children Detected by AI' to 'No' and include a brief uncertainty note.");

    // Sync unified edit buffer when the selected case changes (must be top-level, not conditional)
    useEffect(() => {
        if (caseItem && caseItem.analysis) {
            setIsEditingUnified(false);
            setEditUnified(caseItem.analysis);
        } else {
            setEditUnified(null);
        }
    }, [caseItem?.id]);

    // Single-file rerun notes
    const [singleNotes, setSingleNotes] = useState<string>("");
    useEffect(() => {
        if (file) {
            const defaultMsg = file.type === 'image'
                ? "This is an image file. Do not infer that children are present unless there is clear, direct, unambiguous visual evidence. If uncertain, set 'Children Detected by AI' to 'No'."
                : "Re-analyze this file. Be concise, factual, and avoid speculation.";
            setSingleNotes(defaultMsg);
        }
    }, [file?.id]);

    useEffect(() => {
        if (!speechSupported) return;
        let cancelled = false;
        (async () => {
            const preferred = await getPreferredVoice();
            if (!cancelled) {
                voiceRef.current = preferred;
            }
        })();
        return () => {
            cancelled = true;
            if (speechSynthesis.speaking || speechSynthesis.pending) {
                stopSpeaking();
            }
        };
    }, [speechSupported]);

    const speakAnalysisText = async (text: string) => {
        if (!speechSupported) {
            alert('Text-to-speech is not supported in this browser.');
            return;
        }
        const trimmed = text.trim();
        if (!trimmed) return;

        if (speechSynthesis.speaking || speechSynthesis.pending) {
            stopSpeaking();
        }
        setIsSpeaking(false);
        setIsPaused(false);

        let voice = voiceRef.current;
        if (!voice) {
            try {
                voice = await getPreferredVoice();
                if (voice) {
                    voiceRef.current = voice;
                }
            } catch (error) {
                console.error('Unable to resolve a preferred voice for speech synthesis.', error);
            }
        }

        speakInChunks(trimmed, {
            voice,
            rate: 1.0,
            pitch: 1.0,
            onstart: () => {
                setIsSpeaking(true);
                setIsPaused(false);
            },
            onend: () => {
                setIsSpeaking(false);
                setIsPaused(false);
            },
        });
    };

    const handlePauseResume = () => {
        if (!speechSupported || !isSpeaking) return;
        if (isPaused) {
            resumeSpeaking();
            setIsPaused(false);
        } else {
            pauseSpeaking();
            setIsPaused(true);
        }
    };

    const handleStop = () => {
        if (!speechSupported) return;
        stopSpeaking();
        setIsSpeaking(false);
        setIsPaused(false);
    };

    const handleGenerateReport = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow && file && file.analysis) {
            const analysis = file.analysis;
            const reportHtml = `
                <html>
                <head>
                    <title>Analysis Report: ${file.name}</title>
                    <link rel="stylesheet" href="/report.css">
                </head>
                <body>
                    <header>
                        <h1>Analysis Report</h1>
                        <p><strong>File:</strong> ${file.name}</p>
                        <p><strong>Type:</strong> ${file.type}</p>
                        <p><strong>Location:</strong> ${file.location || 'Not Specified'}</p>
                        <p><strong>Children Detected by AI:</strong> ${analysis.childrenDetected ? 'Yes' : 'No'}</p>
                        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                        <p><strong>SHA-256 Hash:</strong> ${file.hash}</p>
                    </header>
                    <main>
                        <section>
                            <h2>New Findings Summary (from this file)</h2>
                            <p>${analysis.newFindingsSummary}</p>
                        </section>
                        <section>
                            <h2>Overall Summary</h2>
                            <p>${analysis.summary}</p>
                        </section>
                        <section>
                            <h2>AI Confidence: ${analysis.confidenceScore}%</h2>
                            <h2>Severity Score: ${analysis.severityScore}/10</h2>
                        </section>
                        <section>
                            <h2>Key Observations</h2>
                            <ul>
                                ${analysis.keyObservations?.map(obs => `<li><strong>${obs.timestamp}:</strong> ${obs.description}</li>`).join('') || ''}
                            </ul>
                        </section>
                        <section>
                            <h2>Timeline Events</h2>
                            <ul>
                                ${analysis.timelineEvents?.map(evt => `<li><strong>${evt.timestamp}:</strong> ${evt.description} <em>(Subjects: ${evt.subjects.join(', ')})</em></li>`).join('') || ''}
                            </ul>
                        </section>
                        <section>
                            <h2>Cross-References to Past Evidence</h2>
                            <ul>
                                ${analysis.crossReferences?.map(cr => `<li><strong>File: ${cr.fileName}:</strong> ${cr.observation}</li>`).join('') || ''}
                            </ul>
                        </section>
                        <section>
                            <h2>Emotional Analysis</h2>
                             <ul>
                                ${analysis.emotionalAnalysis?.map(emo => `<li><strong>${emo.emotion}:</strong> ${emo.evidence}</li>`).join('') || ''}
                            </ul>
                        </section>
                         <section>
                            <h2>Recognized Employees</h2>
                            <ul>
                                ${(analysis.recognizedEmployees?.length || 0) > 0 ? analysis.recognizedEmployees.map(emp => `<li><strong>${emp.name}</strong> (at ${emp.timestamp}) - <em>${emp.confidence}% confidence</em></li>`).join('') : '<li>None specified or detected.</li>'}
                            </ul>
                        </section>
                         <section>
                            <h2>Potential Violations</h2>
                            <ul>
                                ${(analysis.potentialViolations?.length || 0) > 0 ? analysis.potentialViolations.map(v => `<li>${v}</li>`).join('') : '<li>None detected.</li>'}
                            </ul>
                        </section>
                        ${analysis.fullTranscript && analysis.fullTranscript !== "N/A" ? `
                        <section>
                            <h2>Full Transcript</h2>
                            <pre>${analysis.fullTranscript}</pre>
                        </section>
                        ` : ''}
                    </main>
                    <footer>
                        <p>This report was generated by the AI Evidence Companion. It is intended for informational purposes and does not constitute legal advice.</p>
                    </footer>
                </body>
                </html>
            `;
            printWindow.document.write(reportHtml);
            printWindow.document.close();
            printWindow.print();
        }
    };

    if (!file && (!caseItem || !caseItem.analysis)) {
        return (
            <aside className="w-full h-full bg-gray-800 p-6 border-l border-gray-700 flex flex-col items-center justify-center text-center">
                <div className="text-gray-500">
                    <h2 className="text-xl font-semibold mb-2">Analysis Report</h2>
                    <p>Select a file or unified case to view its analysis report.</p>
                </div>
            </aside>
        );
    }

    // Unified case view
    if (!file && caseItem && caseItem.analysis) {
        const analysis = caseItem.analysis;

        const buildUnifiedSpeech = (): string => {
            const lines: string[] = [];
            lines.push(`Unified analysis report for ${caseItem.name}.`);
            lines.push(`New findings summary: ${analysis.newFindingsSummary}.`);
            lines.push(`Overall summary: ${analysis.summary}.`);
            lines.push(`Confidence ${analysis.confidenceScore} percent. Severity ${analysis.severityScore} of 10.`);
            if (analysis.keyObservations && analysis.keyObservations.length > 0) {
                lines.push('Key observations:');
                analysis.keyObservations.slice(0, 12).forEach((o, i) => {
                    const ts = o.timestamp && o.timestamp !== 'N/A' ? `at ${o.timestamp}` : '';
                    lines.push(`${i + 1}. ${ts} ${o.description}`);
                });
            }
            if (analysis.timelineEvents && analysis.timelineEvents.length > 0) {
                lines.push('Timeline highlights:');
                analysis.timelineEvents.slice(0, 8).forEach((t, i) => {
                    lines.push(`${i + 1}. ${t.timestamp}: ${t.description}.`);
                });
            }
            return lines.join(' ');
        };
        const handleSpeakUnified = async () => speakAnalysisText(buildUnifiedSpeech());

        const renderSection = (title: string, content: React.ReactNode, defaultContent?: string) => {
            const isEmpty = !content || (Array.isArray(content) && content.length === 0);
            return (
                <div className="py-3">
                    <h4 className="font-semibold text-sm text-gray-300 mb-2">{title}</h4>
                    {isEmpty ? <p className="text-sm text-gray-400 italic">{defaultContent || 'None detected.'}</p> : content}
                </div>
            );
        };

        const handleUnifiedSave = () => {
            if (!caseItem || !editUnified || !onUpdateUnifiedAnalysis) return;
            onUpdateUnifiedAnalysis(caseItem.id, editUnified);
            setIsEditingUnified(false);
        };

        const handleUnifiedRerun = () => {
            if (!caseItem || !onRerunUnifiedCase) return;
            onRerunUnifiedCase(caseItem.id, rerunNotes);
        };

        const NumInput: React.FC<{ label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; suffix?: string; }> = ({ label, value, onChange, min = 0, max = 100, suffix }) => (
            <div>
                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                <input
                    type="number"
                    className="w-full bg-gray-700 rounded px-2 py-1 text-sm"
                    value={value}
                    min={min}
                    max={max}
                    onChange={(e) => onChange(Number(e.target.value))}
                />
                {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
            </div>
        );

        return (
            <aside className="w-full h-full bg-gray-800 p-4 border-l border-gray-700 flex flex-col">
                <div className="flex justify-between items-center pb-3 border-b border-gray-700 mb-2">
                    <h3 className="text-lg font-bold text-teal-400 truncate pr-4" title={caseItem.name}>
                        Unified Report: {caseItem.name}
                    </h3>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => { setIsEditingUnified(!isEditingUnified); setEditUnified(analysis); }}
                            className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-2 px-3 rounded-md transition-colors"
                        >
                            <span>{isEditingUnified ? 'Cancel Edit' : 'Edit'}</span>
                        </button>
                        {!isSpeaking ? (
                            <button onClick={handleSpeakUnified} className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-3 rounded-md transition-colors">
                                <SpeakerWaveIcon className="h-4 w-4" />
                                <span>Listen</span>
                            </button>
                        ) : (
                            <>
                                <button onClick={handlePauseResume} className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 px-3 rounded-md transition-colors">
                                    {isPaused ? <SpeakerWaveIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
                                    <span>{isPaused ? 'Resume' : 'Pause'}</span>
                                </button>
                                <button onClick={handleStop} className="flex items-center space-x-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2 px-3 rounded-md transition-colors">
                                    <StopIcon className="h-4 w-4" />
                                    <span>Stop</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {isEditingUnified && editUnified ? (
                    <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">New Findings Summary</label>
                            <textarea
                                className="w-full bg-gray-700 rounded p-2 text-sm"
                                rows={4}
                                value={editUnified.newFindingsSummary}
                                onChange={(e) => setEditUnified({ ...editUnified, newFindingsSummary: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Overall Summary</label>
                            <textarea
                                className="w-full bg-gray-700 rounded p-2 text-sm"
                                rows={5}
                                value={editUnified.summary}
                                onChange={(e) => setEditUnified({ ...editUnified, summary: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <NumInput label="Confidence" value={editUnified.confidenceScore} onChange={(n) => setEditUnified({ ...editUnified, confidenceScore: n })} min={0} max={100} suffix=" %" />
                            <NumInput label="Severity" value={editUnified.severityScore} onChange={(n) => setEditUnified({ ...editUnified, severityScore: n })} min={0} max={10} />
                            <div className="flex items-end">
                                <label className="inline-flex items-center space-x-2 mb-1">
                                    <input
                                        type="checkbox"
                                        checked={editUnified.childrenDetected}
                                        onChange={(e) => setEditUnified({ ...editUnified, childrenDetected: e.target.checked })}
                                        className="form-checkbox h-4 w-4 text-teal-500 bg-gray-700 border-gray-600 rounded"
                                    />
                                    <span className="text-xs text-gray-300">Children Detected by AI</span>
                                </label>
                            </div>
                        </div>
                        <div className="flex justify-end pt-2 border-t border-gray-700">
                            <button
                                onClick={handleUnifiedSave}
                                className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold py-2 px-4 rounded-md"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-grow overflow-y-auto pr-2 divide-y divide-gray-700">
                        {renderSection('New Findings Summary', <p className="text-sm">{analysis.newFindingsSummary}</p>)}
                        {renderSection('Overall Summary', <p className="text-sm">{analysis.summary}</p>)}

                        <div className="py-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-semibold text-sm text-gray-400 mb-2">Confidence</h4>
                                    <p className="text-2xl font-bold text-teal-300">{analysis.confidenceScore}<span className="text-lg">%</span></p>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm text-gray-300 mb-2">Severity</h4>
                                    <SeverityBar score={analysis.severityScore} />
                                </div>
                            </div>
                            <div className="mt-3">
                                <h4 className="font-semibold text-sm text-gray-300">Children Detected by AI</h4>
                                <p className={`text-sm font-bold ${analysis.childrenDetected ? 'text-red-400' : 'text-gray-300'}`}>
                                    {analysis.childrenDetected ? 'Yes' : 'No'}
                                </p>
                            </div>
                        </div>

                        {renderSection('Key Observations', (
                            <ul className="space-y-2 text-sm">
                                {(analysis.keyObservations || []).map((obs, index) => (
                                    <li key={index} className="flex items-start">
                                        {obs.timestamp !== "N/A" && <span className="bg-gray-600 text-xs font-mono rounded px-1.5 py-0.5 mr-2 mt-0.5">{obs.timestamp}</span>}
                                        <p className="flex-1">{obs.description}</p>
                                    </li>
                                ))}
                            </ul>
                        ), "No specific concerning observations were flagged.")}

                        {renderSection('Timeline Events', (
                            <ul className="space-y-2 text-sm">
                                {(analysis.timelineEvents || []).map((evt: TimelineEvent, index) => (
                                    <li key={index}>
                                        <span className="bg-gray-600 text-xs font-mono rounded px-1.5 py-0.5 mr-2">{evt.timestamp}</span>
                                        {evt.description} <span className="text-gray-400 text-xs">({evt.subjects.join(', ')})</span>
                                    </li>
                                ))}
                            </ul>
                        ), "No timeline events were extracted.")}

                        {renderSection('Cross-References to Past Evidence', (
                            <ul className="space-y-2 text-sm">
                                {(analysis.crossReferences || []).map((cr: CrossReference, index) => (
                                    <li key={index}>
                                        <strong>{cr.fileName}:</strong> {cr.observation}
                                    </li>
                                ))}
                            </ul>
                        ), "No connections to past evidence were identified.")}

                        {renderSection('Emotional Analysis', (
                            <ul className="space-y-1.5 text-sm">
                                {(analysis.emotionalAnalysis || []).map((emo, index) => (
                                    <li key={index}><strong>{emo.emotion}:</strong> {emo.evidence}</li>
                                ))}
                            </ul>
                        ), "No distinct emotional cues were detected.")}

                        {renderSection('Recognized Employees', (
                            <ul className="space-y-1.5 text-sm">
                                {(analysis.recognizedEmployees || []).map((emp, index) => (
                                    <li key={index}><strong>{emp.name}</strong> (at {emp.timestamp}) - <em>{emp.confidence}% confidence</em></li>
                                ))}
                            </ul>
                        ))}

                        {renderSection('Potential Violations', (
                            <ul className="space-y-1.5 text-sm list-disc list-inside">
                                {(analysis.potentialViolations || []).map((v, index) => (
                                    <li key={index}>{v}</li>
                                ))}
                            </ul>
                        ))}

                        {analysis.fullTranscript && analysis.fullTranscript !== "N/A" && renderSection('Full Transcript', (
                            <details>
                                <summary className="font-semibold text-sm text-gray-300 cursor-pointer hover:text-white">View Full Transcript</summary>
                                <div className="mt-2 p-2 bg-gray-900 rounded-md text-xs max-h-48 overflow-y-auto">
                                    <p className="whitespace-pre-wrap font-mono">{analysis.fullTranscript}</p>
                                </div>
                            </details>
                        ))}
                    </div>
                )}

                {/* Rerun unified analysis with notes */}
                <div className="mt-3 pt-3 border-t border-gray-700">
                    <label className="block text-sm text-gray-300 mb-1">Re-run Unified Analysis (optional notes)</label>
                    <textarea
                        className="w-full bg-gray-700 rounded p-2 text-sm"
                        rows={3}
                        value={rerunNotes}
                        onChange={(e) => setRerunNotes(e.target.value)}
                    />
                    <div className="mt-2 flex justify-end">
                        <button
                            onClick={handleUnifiedRerun}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-md"
                        >
                            Re-run Unified Analysis
                        </button>
                    </div>
                </div>
            </aside>
        );
    }

    if (file.status === 'analyzed-pending-review' && file.analysis) {
        return (
            <aside className="w-full h-full bg-gray-800 p-4 border-l border-gray-700 flex flex-col">
                <RecognitionReview
                    file={file}
                    onConfirm={onRecognitionReview}
                />
                <div className="mt-3 pt-3 border-t border-gray-700">
                    <label className="block text-sm text-gray-300 mb-1">Re-run Analysis (optional notes)</label>
                    <textarea
                        className="w-full bg-gray-700 rounded p-2 text-sm"
                        rows={3}
                        value={singleNotes}
                        onChange={(e) => setSingleNotes(e.target.value)}
                    />
                    <div className="mt-2 flex justify-end">
                        <button
                            onClick={() => onRerunSingle && onRerunSingle(file.id, singleNotes)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-md"
                        >
                            Re-run Analysis
                        </button>
                    </div>
                </div>
            </aside>
        )
    }

    if (file.status === 'analyzed-needs-manual-tagging') {
        return (
            <aside className="w-full h-full bg-gray-800 p-4 border-l border-gray-700 flex flex-col">
                <ManualRecognitionPanel
                    file={file}
                    allEmployees={employees}
                    onConfirm={onRerunAnalysis}
                />
            </aside>
        )
    }

    if (!file.analysis) {
        return (
            <aside className="w-full h-full bg-gray-800 p-6 border-l border-gray-700 flex flex-col items-center justify-center text-center">
                <div className="text-gray-500">
                    <h2 className="text-xl font-semibold mb-2">Analysis Report</h2>
                    <p>This file has not been analyzed yet.</p>
                    {file.status === 'analyzing' && <p className="text-teal-400">Analysis in progress...</p>}
                </div>
            </aside>
        );
    }

    const { analysis } = file;

    const buildReportSpeech = (): string => {
        const lines: string[] = [];
        lines.push(`Analysis report for ${file.name}.`);
        lines.push(`New findings summary: ${analysis.newFindingsSummary}.`);
        lines.push(`Overall summary: ${analysis.summary}.`);
        lines.push(`Confidence ${analysis.confidenceScore} percent. Severity ${analysis.severityScore} of 10.`);
        if (analysis.keyObservations && analysis.keyObservations.length > 0) {
            lines.push('Key observations:');
            analysis.keyObservations.slice(0, 12).forEach((o, i) => {
                const ts = o.timestamp && o.timestamp !== 'N/A' ? `at ${o.timestamp}` : '';
                lines.push(`${i + 1}. ${ts} ${o.description}`);
            });
        }
        if (analysis.timelineEvents && analysis.timelineEvents.length > 0) {
            lines.push('Timeline highlights:');
            analysis.timelineEvents.slice(0, 8).forEach((t, i) => {
                lines.push(`${i + 1}. ${t.timestamp}: ${t.description}.`);
            });
        }
        return lines.join(' ');
    };

    const handleSpeakReport = async () => {
        if (!analysis) return;
        await speakAnalysisText(buildReportSpeech());
    };

    const renderSection = (title: string, content: React.ReactNode, defaultContent?: string) => {
        const isEmpty = !content || (Array.isArray(content) && content.length === 0);
        return (
            <div className="py-3">
                <h4 className="font-semibold text-sm text-gray-300 mb-2">{title}</h4>
                {isEmpty ? <p className="text-sm text-gray-400 italic">{defaultContent || 'None detected.'}</p> : content}
            </div>
        );
    };

    return (
        <aside className="w-full h-full bg-gray-800 p-4 border-l border-gray-700 flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-gray-700 mb-2">
                <h3 className="text-lg font-bold text-teal-400 truncate pr-4" title={file.name}>
                    Report: {file.name}
                </h3>
                <div className="flex items-center space-x-2">
                    {!isSpeaking ? (
                        <button onClick={handleSpeakReport} className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-3 rounded-md transition-colors">
                            <SpeakerWaveIcon className="h-4 w-4" />
                            <span>Listen</span>
                        </button>
                    ) : (
                        <>
                            <button onClick={handlePauseResume} className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 px-3 rounded-md transition-colors">
                                {isPaused ? <SpeakerWaveIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
                                <span>{isPaused ? 'Resume' : 'Pause'}</span>
                            </button>
                            <button onClick={handleStop} className="flex items-center space-x-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2 px-3 rounded-md transition-colors">
                                <StopIcon className="h-4 w-4" />
                                <span>Stop</span>
                            </button>
                        </>
                    )}
                    <button
                        onClick={handleGenerateReport}
                        className="flex items-center space-x-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold py-2 px-3 rounded-md transition-colors"
                    >
                        <ReportIcon className="h-4 w-4" />
                        <span>Generate Report</span>
                    </button>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto pr-2 divide-y divide-gray-700">
                {renderSection('New Findings Summary', <p className="text-sm">{analysis.newFindingsSummary}</p>)}

                {renderSection('Overall Summary', <p className="text-sm">{analysis.summary}</p>)}

                <div className="py-3">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-semibold text-sm text-gray-400 mb-2">Confidence</h4>
                            <p className="text-2xl font-bold text-teal-300">{analysis.confidenceScore}<span className="text-lg">%</span></p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm text-gray-300 mb-2">Severity</h4>
                            <SeverityBar score={analysis.severityScore} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <h4 className="font-semibold text-sm text-gray-300">Children Detected by AI</h4>
                        <p className={`text-sm font-bold ${analysis.childrenDetected ? 'text-red-400' : 'text-gray-300'}`}>
                            {analysis.childrenDetected ? 'Yes' : 'No'}
                        </p>
                    </div>
                </div>


                {renderSection('Key Observations', (
                    <ul className="space-y-2 text-sm">
                        {(analysis.keyObservations || []).map((obs, index) => (
                            <li key={index} className="flex items-start">
                                {obs.timestamp !== "N/A" && <span className="bg-gray-600 text-xs font-mono rounded px-1.5 py-0.5 mr-2 mt-0.5">{obs.timestamp}</span>}
                                <p className="flex-1">{obs.description}</p>
                            </li>
                        ))}
                    </ul>
                ), "No specific concerning observations were flagged.")}

                {renderSection('Timeline Events', (
                    <ul className="space-y-2 text-sm">
                        {(analysis.timelineEvents || []).map((evt: TimelineEvent, index) => (
                            <li key={index}>
                                <span className="bg-gray-600 text-xs font-mono rounded px-1.5 py-0.5 mr-2">{evt.timestamp}</span>
                                {evt.description} <span className="text-gray-400 text-xs">({evt.subjects.join(', ')})</span>
                            </li>
                        ))}
                    </ul>
                ), "No timeline events were extracted.")}

                {renderSection('Cross-References to Past Evidence', (
                    <ul className="space-y-2 text-sm">
                        {(analysis.crossReferences || []).map((cr: CrossReference, index) => (
                            <li key={index}>
                                <strong>{cr.fileName}:</strong> {cr.observation}
                            </li>
                        ))}
                    </ul>
                ), "No connections to past evidence were identified.")}

                {renderSection('Emotional Analysis', (
                    <ul className="space-y-1.5 text-sm">
                        {(analysis.emotionalAnalysis || []).map((emo, index) => (
                            <li key={index}><strong>{emo.emotion}:</strong> {emo.evidence}</li>
                        ))}
                    </ul>
                ), "No distinct emotional cues were detected.")}

                {renderSection('Recognized Employees', (
                    <ul className="space-y-1.5 text-sm">
                        {(analysis.recognizedEmployees || []).map((emp, index) => (
                            <li key={index}><strong>{emp.name}</strong> (at {emp.timestamp}) - <em>{emp.confidence}% confidence</em></li>
                        ))}
                    </ul>
                ))}

                {renderSection('Potential Violations', (
                    <ul className="space-y-1.5 text-sm list-disc list-inside">
                        {(analysis.potentialViolations || []).map((v, index) => (
                            <li key={index}>{v}</li>
                        ))}
                    </ul>
                ))}

                {analysis.fullTranscript && analysis.fullTranscript !== "N/A" && renderSection('Full Transcript', (
                    <details>
                        <summary className="font-semibold text-sm text-gray-300 cursor-pointer hover:text-white">View Full Transcript</summary>
                        <div className="mt-2 p-2 bg-gray-900 rounded-md text-xs max-h-48 overflow-y-auto">
                            <p className="whitespace-pre-wrap font-mono">{analysis.fullTranscript}</p>
                        </div>
                    </details>
                ))}
            </div>

            {/* Re-run single-file analysis with notes */}
            <div className="mt-3 pt-3 border-t border-gray-700">
                <label className="block text-sm text-gray-300 mb-1">Re-run Analysis (optional notes)</label>
                <textarea
                    className="w-full bg-gray-700 rounded p-2 text-sm"
                    rows={3}
                    value={singleNotes}
                    onChange={(e) => setSingleNotes(e.target.value)}
                />
                <div className="mt-2 flex justify-end">
                    <button
                        onClick={() => onRerunSingle && onRerunSingle(file.id, singleNotes)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-md"
                    >
                        Re-run Analysis
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default AnalysisPanel;
