import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { ChatMessage, EvidenceFile, EvidenceType, Employee, AnalysisResult, RelationshipMapData, RecognizedEmployee, EmployeeTestimony, EvidenceCase } from './types';
import Header from './components/Header';
import EvidencePanel from './components/EvidencePanel';
import ChatPanel from './components/ChatPanel';
import QAPanel from './components/QAPanel';
import AnalysisPanel from './components/AnalysisPanel';
import AnalysisSetupModal from './components/AnalysisSetupModal';
import { analyzeEvidence, analyzeEvidenceWithPartner, analyzeEvidenceUnified, researchEmployee, generateRelationshipMap, processGeneralQuery, summarizeTestimony } from './services/geminiService';
import { hashFile } from './services/utils';
import { saveAnalysisDocument, saveUnifiedAnalysisDocument, saveUploadedFile, saveProfileToDisk, listProfiles, deleteProfile, saveTestimonyToDisk, deleteEvidence, renameEvidence, getDeletePassword } from './services/storageService';
import CaseDashboard from './components/CaseDashboard';
import ResizeHandle from './components/ResizeHandle';
import UnanalyzedFilesPanel from './components/UnanalyzedFilesPanel';
import AboutPanel from './components/AboutPanel';

const TEXT_MIMETYPES = ['text/plain', 'text/markdown'];
const MAX_UNIFIED_FILES = 7;

const generateCaseSummary = (files: EvidenceFile[]): string => {
    const analyzedFiles = files.filter(f => f.status === 'analyzed' && f.analysis);
    if (analyzedFiles.length === 0) {
        return '';
    }
    let summary = 'Here is a summary of previously analyzed evidence:\n\n';
    analyzedFiles.forEach(file => {
        summary += `---
File: ${file.name}
Type: ${file.type}
Summary: ${file.analysis!.summary}
Key Observations:
${file.analysis!.keyObservations.map(obs => `- [${obs.timestamp}] ${obs.description}`).join('\n')}
---\n`;
    });
    return summary;
};

const App: React.FC = () => {
    const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>(() => {
        try {
            const saved = localStorage.getItem('evidenceFiles');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error("Failed to parse evidence files from localStorage", error);
            return [];
        }
    });
    const [employees, setEmployees] = useState<Employee[]>(() => {
        try {
            const saved = localStorage.getItem('employees');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error("Failed to parse employees from localStorage", error);
            return [];
        }
    });
    const [witnesses, setWitnesses] = useState<EmployeeTestimony[]>(() => {
        try {
            const saved = localStorage.getItem('employeeTestimonies');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [testimony, setTestimony] = useState<string>(() => localStorage.getItem('testimony') || '');
    const [contextSummary, setContextSummary] = useState<string>(() => localStorage.getItem('contextSummary') || '');


    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
     const [qaMessages, setQaMessages] = useState<ChatMessage[]>([
        {
            id: 'system-qa-intro',
            role: 'system',
            content: 'Ask a general question about legal topics. The AI will use web search to provide an informed answer.'
        }
    ]);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isQaLoading, setIsQaLoading] = useState<boolean>(false);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [fileForAnalysis, setFileForAnalysis] = useState<EvidenceFile | null>(null);
	const [evidenceCases, setEvidenceCases] = useState<EvidenceCase[]>(() => {
		try {
			const saved = localStorage.getItem('evidenceCases');
			return saved ? JSON.parse(saved) : [];
		} catch {
			return [];
		}
	});
    const [caseForAppend, setCaseForAppend] = useState<EvidenceCase | null>(null);
    const [isAppendModalOpen, setIsAppendModalOpen] = useState(false);
    
    const [view, setView] = useState<'chat' | 'dashboard' | 'qa' | 'about'>('chat');
    const [mapData, setMapData] = useState<RelationshipMapData | null>(null);
    const [isMapLoading, setIsMapLoading] = useState<boolean>(false);


    // Resizable panels state
    const [leftPanelWidth, setLeftPanelWidth] = useState(320);
    const [rightPanelWidth, setRightPanelWidth] = useState(450);
    const [resizingPanel, setResizingPanel] = useState<'left' | 'right' | null>(null);
    const resizeStartInfo = useRef<{
        startX: number;
        startLeftWidth: number;
        startRightWidth: number;
    }>({ startX: 0, startLeftWidth: 0, startRightWidth: 0 });

    // Persistence Effects
    useEffect(() => {
        const filesToSave = evidenceFiles.map(({ file, url, ...rest }) => rest);
        localStorage.setItem('evidenceFiles', JSON.stringify(filesToSave));
    }, [evidenceFiles]);

	useEffect(() => {
		localStorage.setItem('evidenceCases', JSON.stringify(evidenceCases));
	}, [evidenceCases]);

    useEffect(() => {
        try {
            const employeesToPersist = employees.map(({ referenceImage, ...rest }) => rest);
            localStorage.setItem('employees', JSON.stringify(employeesToPersist));
        } catch (e) {
            console.error('Failed to persist employees to localStorage (likely quota exceeded). Profiles are saved to disk in app/data/profiles.', e);
        }
    }, [employees]);

    useEffect(() => {
        try {
            localStorage.setItem('employeeTestimonies', JSON.stringify(witnesses));
        } catch {}
    }, [witnesses]);

    // Load employees from disk on startup
    useEffect(() => {
        (async () => {
            try {
                const diskProfiles = await listProfiles();
                if (Array.isArray(diskProfiles) && diskProfiles.length > 0) {
                    setEmployees(diskProfiles.slice(0, 14));
                }
            } catch (e) {
                console.error('Failed to load profiles from disk:', e);
            }
        })();
    }, []);
    
    useEffect(() => {
        localStorage.setItem('testimony', testimony);
    }, [testimony]);

    useEffect(() => {
        localStorage.setItem('contextSummary', contextSummary);
    }, [contextSummary]);

    // Resizable panels logic
    const handleResizeMouseDown = useCallback((e: React.MouseEvent, panel: 'left' | 'right') => {
        e.preventDefault();
        resizeStartInfo.current = {
            startX: e.clientX,
            startLeftWidth: leftPanelWidth,
            startRightWidth: rightPanelWidth,
        };
        setResizingPanel(panel);
    }, [leftPanelWidth, rightPanelWidth]);
    
    useEffect(() => {
        if (resizingPanel === null) {
            return;
        }

        const handleMouseMove = (e: MouseEvent) => {
            const { startX, startLeftWidth, startRightWidth } = resizeStartInfo.current;
            const MIN_PANEL_WIDTH = 60; // Allow shrinking to a much smaller size
            const MIN_CENTER_WIDTH = 300; // Allow center panel to be smaller

            if (resizingPanel === 'left') {
                const delta = e.clientX - startX;
                const newWidth = startLeftWidth + delta;
                const maxWidth = window.innerWidth - rightPanelWidth - MIN_CENTER_WIDTH;
                setLeftPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(newWidth, maxWidth)));
            } else { // right
                const delta = startX - e.clientX;
                const newWidth = startRightWidth + delta;
                const maxWidth = window.innerWidth - leftPanelWidth - MIN_CENTER_WIDTH;
                setRightPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(newWidth, maxWidth)));
            }
        };

        const handleMouseUp = () => {
            setResizingPanel(null);
        };

        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'auto';
            document.body.style.userSelect = 'auto';
        };
    }, [resizingPanel, leftPanelWidth, rightPanelWidth]);


    const updateEvidenceFile = (id: string, updates: Partial<EvidenceFile> | ((file: EvidenceFile) => EvidenceFile)) => {
        setEvidenceFiles(prev => prev.map(f => {
            if (f.id !== id) {
                return f;
            }
            if (typeof updates === 'function') {
                return updates(f);
            }
            return { ...f, ...updates };
        }));
    };

    const updateEmployee = (id: string, updates: Partial<Employee>) => {
        setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    };

    const handleAddNewEmployee = async (employeeData: Omit<Employee, 'id' | 'status' | 'aiEnhancedDetails'>) => {
        const newEmployee: Employee = {
            ...employeeData,
            id: `emp-${Date.now()}`,
            status: 'researching',
        };
        setEmployees(prev => [...prev, newEmployee]);

        try {
            const aiDetails = await researchEmployee(employeeData);
            let enriched: Employee = { ...newEmployee, aiEnhancedDetails: aiDetails, status: 'ready' };
            try {
                const saved = await saveProfileToDisk(enriched);
                enriched = { ...enriched, profileJsonPath: saved.jsonPath, referenceImagePath: saved.imagePath };
            } catch (e) {
                console.error('Failed to save profile to disk:', e);
            }
            const { referenceImage, ...rest } = enriched;
            updateEmployee(newEmployee.id, { ...rest });
        } catch (error) {
            console.error("Error researching employee:", error);
            let failed: Employee = { ...newEmployee, status: 'error', aiEnhancedDetails: 'AI research failed.' };
            try {
                const saved = await saveProfileToDisk(failed);
                failed = { ...failed, profileJsonPath: saved.jsonPath, referenceImagePath: saved.imagePath };
            } catch (e) {
                console.error('Failed to save profile to disk:', e);
            }
            const { referenceImage, ...rest } = failed;
            updateEmployee(newEmployee.id, { ...rest });
        }
    };

    const handleUpdateEmployee = (id: string, updates: { name: string; details: string }) => {
        const existing = employees.find(e => e.id === id);
        const updated: Employee | null = existing ? { ...existing, name: updates.name, details: updates.details } : null;
        updateEmployee(id, updates);
        if (updated) {
            saveProfileToDisk(updated)
                .then(saved => {
                    updateEmployee(id, { profileJsonPath: saved.jsonPath });
                })
                .catch(e => console.error('Failed to save profile to disk:', e));
        }
    };

    const handleDeleteEmployeePermanent = async (id: string) => {
        const target = employees.find(e => e.id === id);
        setEmployees(prev => prev.filter(e => e.id !== id));
        try {
            await deleteProfile(target?.profileJsonPath, target ? target.name : undefined);
        } catch (e) {
            console.error('Failed to delete profile from disk:', e);
        }
    };

    const handleAddWitness = (w: { employeeId: string; employeeName: string; testimony: string; }) => {
        const newW: EmployeeTestimony = { ...w, id: `wit-${Date.now()}` };
        setWitnesses(prev => [...prev, newW]);
    };

    const handleDeleteWitness = (id: string) => {
        setWitnesses(prev => prev.filter(w => w.id !== id));
    };

    const handleUpdateWitness = (id: string, updates: Partial<EmployeeTestimony>) => {
        setWitnesses(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
    };

    const handleSaveWitness = async (id: string) => {
        const target = witnesses.find(w => w.id === id);
        if (!target) return;
        try {
            if (target.testimony && target.testimony.trim().length > 10) {
                const summary = await summarizeTestimony(target.testimony);
                setWitnesses(prev => prev.map(w => w.id === id ? { ...w, contextSummary: summary } : w));
                try {
                    await saveTestimonyToDisk({ kind: 'employee', employeeName: target.employeeName, employeeId: target.employeeId, text: target.testimony, summary });
                } catch (e) {
                    console.error('Failed to save employee testimony to disk:', e);
                }
            } else {
                setWitnesses(prev => prev.map(w => w.id === id ? { ...w, contextSummary: '' } : w));
            }
        } catch (e) {
            console.error('Failed to summarize employee testimony:', e);
        }
    };

    const handleSaveTestimony = async (newTestimony: string) => {
        setTestimony(newTestimony);
        if (newTestimony.trim().length > 10) {
            try {
                const summary = await summarizeTestimony(newTestimony);
                setContextSummary(summary);
                try {
                    await saveTestimonyToDisk({ kind: 'user', text: newTestimony, summary });
                } catch (e) {
                    console.error('Failed to save user testimony to disk:', e);
                }
            } catch (error) {
                console.error("Error summarizing testimony:", error);
                setContextSummary("Could not summarize testimony.");
            }
        } else {
            setContextSummary("");
        }
    };

    const addEvidenceFile = useCallback(async (file: File): Promise<EvidenceFile> => {
        let fileType: EvidenceType;
        if (file.type.startsWith('image')) fileType = 'image';
        else if (file.type.startsWith('video')) fileType = 'video';
        else if (file.type.startsWith('audio')) fileType = 'audio';
        else if (TEXT_MIMETYPES.includes(file.type) || file.name.endsWith('.md') || file.name.endsWith('.txt')) fileType = 'document';
        else fileType = 'document';

        const storageInfo = await saveUploadedFile(file);

        const newEvidence: EvidenceFile = {
            id: `file-${Date.now()}`,
            name: file.name,
            type: fileType,
            url: URL.createObjectURL(file),
            file,
            status: 'new',
            hash: await hashFile(file),
            storedFileName: storageInfo.fileName,
            storedFilePath: storageInfo.relativePath,
            analysisDocuments: [],
        };

        setEvidenceFiles(prev => [...prev, newEvidence]);
        return newEvidence;
    }, []);
    
    const handleDeleteFile = useCallback(async (id: string) => {
        const password = await getDeletePassword();
        if (!password) {
            return;
        }
        setEvidenceFiles(prev => {
            const fileToDelete = prev.find(f => f.id === id);
            if (fileToDelete && fileToDelete.url) {
                URL.revokeObjectURL(fileToDelete.url);
            }
            // Attempt to delete from disk (fire and forget)
            if (fileToDelete?.storedFileName) {
                deleteEvidence({ name: fileToDelete.storedFileName, kind: 'analyzed', password })
                    .catch(e => console.error('Failed to delete evidence from disk:', e));
            } else if (fileToDelete?.analysisDocuments && fileToDelete.analysisDocuments.length > 0) {
                // As a fallback, if only report exists
                const firstDoc = fileToDelete.analysisDocuments[0];
                const base = firstDoc.split('/').pop();
                if (base) {
                    deleteEvidence({ name: base, kind: 'report', password })
                        .catch(e => console.error('Failed to delete report from disk:', e));
                }
            }
            return prev.filter(f => f.id !== id);
        });
        if (selectedFileId === id) {
            setSelectedFileId(null);
        }
    }, [selectedFileId]);

    const handleRenameFile = useCallback(async (id: string, newNameInput: string) => {
        const target = evidenceFiles.find(f => f.id === id);
        if (!target) return;
        const oldStored = target.storedFileName || target.name;
        const oldExt = oldStored.includes('.') ? oldStored.substring(oldStored.lastIndexOf('.')) : '';
        const trimmed = newNameInput.trim();
        if (!trimmed) return;
        const proposed = trimmed.includes('.') ? trimmed : `${trimmed}${oldExt}`;

        const password = await getDeletePassword();
        if (!password) return;

        try {
            const resp = await renameEvidence({ oldName: oldStored, newName: proposed, kind: 'analyzed', password });
            const finalStored = resp.newStoredFileName || proposed;
            setEvidenceFiles(prev => prev.map(f => {
                if (f.id !== id) return f;
                const updatedDocs = (f.analysisDocuments || []).map(p => {
                    const change = resp.changes?.find(changeItem => {
                        const oldBase = changeItem.old.split('/').pop() || '';
                        return oldBase && p.endsWith(oldBase);
                    });
                    return change ? p.replace(change.old, change.next) : p;
                });
                return {
                    ...f,
                    name: finalStored, // reflect rename in UI
                    storedFileName: finalStored,
                    storedFilePath: `app/data/analyzed files/${finalStored}`,
                    analysisDocuments: updatedDocs,
                };
            }));
        } catch (e) {
            console.error('Failed to rename evidence on disk:', e);
            alert('Could not rename the file on disk. Please try again.');
        }
    }, [evidenceFiles]);

    const handleDeleteCase = useCallback(async (caseId: string) => {
        const targetCase = evidenceCases.find(c => c.id === caseId);
        if (!targetCase) return;

        const password = await getDeletePassword();
        if (!password) return;

        const docName = targetCase.analysisDocumentFileName
            || (targetCase.analysisDocumentPath ? targetCase.analysisDocumentPath.split('/').pop() || undefined : undefined);
        if (docName) {
            try {
                await deleteEvidence({ name: docName, kind: 'report', password });
            } catch (error) {
                console.error('Failed to delete unified report from disk:', error);
                alert('Unable to delete the stored unified report from disk. The case will still be removed from the app.');
            }
        }

        // Return files to unanalyzed state if they were part of this case
        if (Array.isArray(targetCase.fileIds) && targetCase.fileIds.length > 0) {
            const fileIdSet = new Set(targetCase.fileIds);
            setEvidenceFiles(prev => prev.map(file => {
                if (!fileIdSet.has(file.id)) return file;
                return {
                    ...file,
                    status: 'new',
                    analysis: undefined,
                    recognitionVerified: false,
                };
            }));
        }

        setEvidenceCases(prev => prev.filter(c => c.id !== caseId));
        if (selectedCaseId === caseId) {
            setSelectedCaseId(null);
        }
    }, [evidenceCases, selectedCaseId]);
    
    const handleFilesDropped = useCallback(async (files: File[]) => {
        const uploadMessageId = `sys-upload-${Date.now()}`;
        setChatMessages(prev => [...prev, {
            id: uploadMessageId,
            role: 'system',
            content: `Uploading ${files.length} file(s)...`
        }]);

        try {
            await Promise.all(files.map(file => addEvidenceFile(file)));
            setChatMessages(prev => [...prev, {
                id: `sys-upload-done-${Date.now()}`,
                role: 'system',
                content: `${files.length} file(s) added and are ready for analysis.`
            }]);
        } catch (error) {
            console.error('Error saving uploaded files:', error);
            setChatMessages(prev => [...prev, {
                id: `sys-upload-error-${Date.now()}`,
                role: 'system',
                content: 'One or more files could not be saved to app/data/. Please check write permissions and try again.'
            }]);
        }

    }, [addEvidenceFile]);
    
    const handleRequestAnalysis = (fileId: string) => {
        const fileToAnalyze = evidenceFiles.find(f => f.id === fileId);
        if (fileToAnalyze) {
            setFileForAnalysis(fileToAnalyze);
            setIsModalOpen(true);
        }
    };
    
    const runAnalysis = async (file: EvidenceFile, instructions?: string, manualTags?: string[]) => {
        updateEvidenceFile(file.id, { status: 'analyzing' });
        setChatMessages(prev => [...prev, {
            id: `system-analysis-${file.id}`,
            role: 'system',
            content: `Analyzing '${file.name}'...`
        }]);

        try {
            const caseSummary = generateCaseSummary(evidenceFiles.filter(f => f.id !== file.id));
            const witnessBlock = witnesses.length > 0
                ? `\n\n**EMPLOYEE TESTIMONIES:**\n${witnesses.map(w => `- ${w.employeeName}: ${w.testimony}`).join('\n')}`
                : '';
            const combinedTestimony = testimony ? `${testimony}${witnessBlock}` : (witnessBlock || '');
            const analysisResult = await analyzeEvidence(file, employees, caseSummary, combinedTestimony, instructions, manualTags);

            let analysisDocumentPath: string | undefined;
            try {
                const storageResult = await saveAnalysisDocument(
                    file.name,
                    file.storedFileName ?? file.name,
                    analysisResult
                );
                analysisDocumentPath = storageResult.relativePath;
            } catch (storageError) {
                console.error(`Error saving analysis document for ${file.name}:`, storageError);
                setChatMessages(prev => [...prev, {
                    id: `analysis-storage-error-${Date.now()}`,
                    role: 'system',
                    content: 'Error saving analysis. Please check write permissions in app/data/.'
                }]);
            }

            const buildAnalysisDocuments = (current: EvidenceFile) => {
                const existingDocs = current.analysisDocuments ?? [];
                return analysisDocumentPath ? [...existingDocs, analysisDocumentPath] : existingDocs;
            };

            if (!manualTags && analysisResult.recognizedEmployees.length === 0) {
                 // First pass, no one found -> go to manual tagging
                updateEvidenceFile(file.id, current => ({
                    ...current,
                    status: 'analyzed-needs-manual-tagging',
                    analysis: analysisResult,
                    recognitionVerified: false,
                    analysisDocuments: buildAnalysisDocuments(current),
                }));
                setSelectedFileId(file.id);
                setChatMessages(prev => prev.filter(m => m.id !== `system-analysis-${file.id}`).concat({
                    id: `system-manual-tag-${file.id}`,
                    role: 'system',
                    content: `Initial analysis of '${file.name}' complete. AI did not detect any employees. Please manually tag who is present.`
                }));
            } else if (analysisResult.recognizedEmployees.length > 0) {
                // People found -> go to review
                updateEvidenceFile(file.id, current => ({
                    ...current,
                    status: 'analyzed-pending-review',
                    analysis: analysisResult,
                    recognitionVerified: false,
                    analysisDocuments: buildAnalysisDocuments(current),
                }));
                setSelectedFileId(file.id);
                setChatMessages(prev => prev.filter(m => m.id !== `system-analysis-${file.id}`).concat({
                    id: `system-done-${file.id}`,
                    role: 'system',
                    content: `'${file.name}' analyzed. Please review the detected employees.`
                }));
            } else {
                 // Manual tagging was used but still no one found in final analysis (unlikely but possible)
                updateEvidenceFile(file.id, current => ({
                    ...current,
                    status: 'analyzed',
                    analysis: analysisResult,
                    recognitionVerified: true,
                    analysisDocuments: buildAnalysisDocuments(current),
                }));
                setSelectedFileId(file.id);
                 setChatMessages(prev => prev.filter(m => m.id !== `system-analysis-${file.id}`).concat({
                    id: `system-done-${file.id}`,
                    role: 'system',
                    content: `Re-analysis of '${file.name}' complete. Review the final report.`
                }));
            }
        } catch (error: any) {
            console.error(`Error analyzing file ${file.name}:`, error);
            const details = (error && (error.message || error.toString())) || 'Unknown error';
            const errorMessage: ChatMessage = {
                id: `model-error-${Date.now()}`,
                role: 'model',
                content: `Sorry, I encountered an error analyzing '${file.name}'. Details: ${details}`
            };
            setChatMessages(prev => prev.filter(m => m.id !== `system-analysis-${file.id}`).concat(errorMessage));
            updateEvidenceFile(file.id, { status: 'error' });
        }
    };

	// Unified case analysis (single, combined report)
	const runUnifiedCaseAnalysis = async (selectedFiles: EvidenceFile[], instructions?: string) => {
		const files = selectedFiles.slice(0, MAX_UNIFIED_FILES);
		if (files.length < 2) return;

		const caseId = `case-${Date.now()}`;
		const caseName = files.map(f => f.name).join(' + ');
		const fileIds = files.map(f => f.id);

        // Mark files as analyzing
        files.forEach(file => {
            updateEvidenceFile(file.id, { status: 'analyzing' });
        });

		setEvidenceCases(prev => prev.concat([{ id: caseId, name: caseName, fileIds, status: 'analyzing' }]));
		setChatMessages(prev => prev.concat([{
			id: `system-analysis-unified-${caseId}`,
			role: 'system',
			content: `Analyzing '${caseName}' (${files.length} files) as a single unified case...`
		}]));

		try {
			const excludeIds = new Set(fileIds);
			const caseSummary = generateCaseSummary(evidenceFiles.filter(f => !excludeIds.has(f.id)));
			const witnessBlock = witnesses.length > 0
				? `\n\n**EMPLOYEE TESTIMONIES:**\n${witnesses.map(w => `- ${w.employeeName}: ${w.testimony}`).join('\n')}`
				: '';
			const combinedTestimony = testimony ? `${testimony}${witnessBlock}` : (witnessBlock || '');

			const unifiedResult = await analyzeEvidenceUnified(files, employees, caseSummary, combinedTestimony, instructions);

			// Save unified analysis document
			let savedName: string | undefined;
			let savedRelPath: string | undefined;
			try {
				const saved = await saveUnifiedAnalysisDocument(
					files.map(f => f.name),
					files.map(f => f.storedFileName ?? f.name),
					caseName,
					unifiedResult
				);
				savedName = saved.fileName;
				savedRelPath = saved.relativePath;
			} catch (e) {
				console.error('Failed to save unified analysis document:', e);
			}

			setEvidenceCases(prev => prev.map(c => c.id === caseId ? ({
				...c,
				fileIds,
				status: 'analyzed',
				analysis: unifiedResult,
				recognitionVerified: false,
				analysisDocumentFileName: savedName,
				analysisDocumentPath: savedRelPath,
			}) : c));

			const stubAnalysis = (name: string) => ({
				summary: `See unified case report: ${caseName}`,
				newFindingsSummary: `Analyzed jointly as part of '${caseName}'.`,
				severityScore: unifiedResult.severityScore ?? 0,
				confidenceScore: unifiedResult.confidenceScore ?? 0,
				childrenDetected: unifiedResult.childrenDetected ?? false,
				keyObservations: [],
				timelineEvents: [],
				crossReferences: [{ fileName: caseName, observation: `This file is part of the unified analysis '${caseName}'.` }],
				emotionalAnalysis: [],
				recognizedEmployees: [],
				potentialViolations: [],
				fullTranscript: 'N/A',
			} as AnalysisResult);

			files.forEach(fileRef => {
				updateEvidenceFile(fileRef.id, (current) => ({ ...current, status: 'analyzed', analysis: stubAnalysis(fileRef.name) }));
			});

			setSelectedCaseId(caseId);
			setSelectedFileId(null);

			setChatMessages(prev => prev.filter(m => m.id !== `system-analysis-unified-${caseId}`).concat({
				id: `system-done-unified-${caseId}`,
				role: 'system',
				content: `Unified analysis complete for '${caseName}'.`
			}));
		} catch (error: any) {
			console.error('Error during unified analysis', error);
			setEvidenceCases(prev => prev.map(c => c.id === caseId ? ({ ...c, status: 'error' }) : c));
            // Reset file status on error
            files.forEach(file => {
                updateEvidenceFile(file.id, { status: 'error' });
            });
			setChatMessages(prev => prev.filter(m => m.id !== `system-analysis-unified-${caseId}`).concat({
				id: `model-error-unified-${Date.now()}`,
				role: 'model',
				content: `Sorry, I encountered an error analyzing '${caseName}'. ${error?.message || ''}`
			}));
		}
	};

    const handleUpdateUnifiedCaseAnalysis = async (caseId: string, updated: AnalysisResult) => {
        const target = evidenceCases.find(c => c.id === caseId);
        if (!target) return;
        const files = target.fileIds.map(id => evidenceFiles.find(f => f.id === id)).filter((f): f is EvidenceFile => Boolean(f));
        const caseName = files.map(f => f.name).join(' + ');
        // Save updated unified analysis document
        let savedName: string | undefined;
        let savedRelPath: string | undefined;
        try {
            const saved = await saveUnifiedAnalysisDocument(
                files.map(f => f.name),
                files.map(f => f.storedFileName ?? f.name),
                caseName,
                updated
            );
            savedName = saved.fileName;
            savedRelPath = saved.relativePath;
        } catch (e) {
            console.error('Failed to save edited unified analysis document:', e);
        }
        setEvidenceCases(prev => prev.map(c => c.id === caseId ? ({
            ...c,
            name: caseName,
            status: 'analyzed',
            analysis: updated,
            analysisDocumentFileName: savedName,
            analysisDocumentPath: savedRelPath,
        }) : c));

        // Update stubs on files
        const stubAnalysis = (name: string) => ({
            summary: `See unified case report: ${caseName}`,
            newFindingsSummary: `Analyzed jointly as part of '${caseName}'.`,
            severityScore: updated.severityScore ?? 0,
            confidenceScore: updated.confidenceScore ?? 0,
            childrenDetected: updated.childrenDetected ?? false,
            keyObservations: [],
            timelineEvents: [],
            crossReferences: [{ fileName: caseName, observation: `This file is part of the unified analysis '${caseName}'.` }],
            emotionalAnalysis: [],
            recognizedEmployees: [],
            potentialViolations: [],
            fullTranscript: 'N/A',
        } as AnalysisResult);
        files.forEach(fileRef => {
            updateEvidenceFile(fileRef.id, (current) => ({ ...current, status: 'analyzed', analysis: stubAnalysis(fileRef.name) }));
        });

        setChatMessages(prev => prev.concat({
            id: `sys-unified-edited-${Date.now()}`,
            role: 'system',
            content: `Unified report '${caseName}' was edited and saved.`
        }));
    };

    const handleRerunUnifiedCase = (caseId: string, instructions?: string) => {
        const target = evidenceCases.find(c => c.id === caseId);
        if (!target) return;
        const files = target.fileIds.map(id => evidenceFiles.find(f => f.id === id)).filter((f): f is EvidenceFile => Boolean(f));
        const combinedInstructions = instructions || '';
        rerunUnifiedCaseAnalysis(caseId, files, combinedInstructions);
    };

    // Re-run unified analysis for an existing case with an updated set of files
    const rerunUnifiedCaseAnalysis = async (caseId: string, selectedFiles: EvidenceFile[], instructions?: string) => {
        const files = selectedFiles.slice(0, MAX_UNIFIED_FILES);
        if (files.length < 2) return;

        const caseName = files.map(f => f.name).join(' + ');
        const fileIds = files.map(f => f.id);

        // set analyzing state
        setEvidenceCases(prev => prev.map(c => c.id === caseId ? ({ ...c, name: caseName, fileIds, status: 'analyzing' }) : c));
        // Also mark files as analyzing
        files.forEach(file => {
            updateEvidenceFile(file.id, { status: 'analyzing' });
        });

        setChatMessages(prev => prev.concat([{
            id: `system-analysis-unified-${caseId}`,
            role: 'system',
            content: `Updating unified analysis '${caseName}' (${files.length} files)...`
        }]));

        try {
            const excludeIds = new Set(fileIds);
            const caseSummary = generateCaseSummary(evidenceFiles.filter(f => !excludeIds.has(f.id)));
            const witnessBlock = witnesses.length > 0
                ? `\n\n**EMPLOYEE TESTIMONIES:**\n${witnesses.map(w => `- ${w.employeeName}: ${w.testimony}`).join('\n')}`
                : '';
            const combinedTestimony = testimony ? `${testimony}${witnessBlock}` : (witnessBlock || '');

            const unifiedResult = await analyzeEvidenceUnified(files, employees, caseSummary, combinedTestimony, instructions);

            // Save unified analysis document
            let savedName: string | undefined;
            let savedRelPath: string | undefined;
            try {
                const saved = await saveUnifiedAnalysisDocument(
                    files.map(f => f.name),
                    files.map(f => f.storedFileName ?? f.name),
                    caseName,
                    unifiedResult
                );
                savedName = saved.fileName;
                savedRelPath = saved.relativePath;
            } catch (e) {
                console.error('Failed to save unified analysis document:', e);
            }

            setEvidenceCases(prev => prev.map(c => c.id === caseId ? ({
                ...c,
                name: caseName,
                fileIds,
                status: 'analyzed',
                analysis: unifiedResult,
                recognitionVerified: false,
                analysisDocumentFileName: savedName,
                analysisDocumentPath: savedRelPath,
            }) : c));

            const stubAnalysis = (name: string) => ({
                summary: `See unified case report: ${caseName}`,
                newFindingsSummary: `Analyzed jointly as part of '${caseName}'.`,
                severityScore: unifiedResult.severityScore ?? 0,
                confidenceScore: unifiedResult.confidenceScore ?? 0,
                childrenDetected: unifiedResult.childrenDetected ?? false,
                keyObservations: [],
                timelineEvents: [],
                crossReferences: [{ fileName: caseName, observation: `This file is part of the unified analysis '${caseName}'.` }],
                emotionalAnalysis: [],
                recognizedEmployees: [],
                potentialViolations: [],
                fullTranscript: 'N/A',
            } as AnalysisResult);

            files.forEach(fileRef => {
                updateEvidenceFile(fileRef.id, (current) => ({ ...current, status: 'analyzed', analysis: stubAnalysis(fileRef.name) }));
            });

            setSelectedCaseId(caseId);
            setSelectedFileId(null);

            setChatMessages(prev => prev.filter(m => m.id !== `system-analysis-unified-${caseId}`).concat({
                id: `system-done-unified-${caseId}`,
                role: 'system',
                content: `Unified analysis updated for '${caseName}'.`
            }));
        } catch (error: any) {
            console.error('Error during unified analysis update', error);
            setEvidenceCases(prev => prev.map(c => c.id === caseId ? ({ ...c, status: 'error' }) : c));
             // Reset file status on error
             files.forEach(file => {
                updateEvidenceFile(file.id, { status: 'error' });
            });
            setChatMessages(prev => prev.filter(m => m.id !== `system-analysis-unified-${caseId}`).concat({
                id: `model-error-unified-${Date.now()}`,
                role: 'model',
                content: `Sorry, I encountered an error updating '${caseName}'. ${error?.message || ''}`
            }));
        }
    };

    const handleStartAnalysis = (fileOrFiles: EvidenceFile | EvidenceFile[], location: string, instructions: string) => {
        setIsModalOpen(false);
        setFileForAnalysis(null);

        const requested = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
        const files = requested.slice(0, MAX_UNIFIED_FILES);

        if (files.length === 0) return;

        files.forEach(file => updateEvidenceFile(file.id, { location }));

        if (files.length === 1) {
            runAnalysis(files[0], instructions);
        } else {
            runUnifiedCaseAnalysis(files, instructions);
        }
    };
    
     const handleRerunAnalysis = (fileId: string, manualTags: string[]) => {
        const file = evidenceFiles.find(f => f.id === fileId);
        if (file) {
             // We can re-use the instructions from the modal if we stored them, or just pass the tags
            runAnalysis(file, undefined, manualTags);
        }
    };

    const handleRecognitionReview = (fileId: string, confirmedEmployees: RecognizedEmployee[]) => {
        const file = evidenceFiles.find(f => f.id === fileId);
        if (file && file.analysis) {
            const updatedAnalysis = { ...file.analysis, recognizedEmployees: confirmedEmployees };
            updateEvidenceFile(fileId, { status: 'analyzed', recognitionVerified: true, analysis: updatedAnalysis });
            setChatMessages(prev => [...prev, {
                id: `sys-review-done-${fileId}`,
                role: 'system',
                content: `Recognition review for '${file.name}' is complete.`
            }]);
        }
    };

     const handleSendQaMessage = async (prompt: string, analyzeEntireCase: boolean) => {
        setIsQaLoading(true);
        const userMessage: ChatMessage = {
            id: `user-qa-${Date.now()}`,
            role: 'user',
            content: prompt,
        };
        const loadingMessage: ChatMessage = {
            id: `model-qa-loading-${Date.now()}`,
            role: 'model',
            content: '',
            isLoading: true,
        };
        setQaMessages(prev => [...prev, userMessage, loadingMessage]);

        try {
            let responseText;
            if (analyzeEntireCase) {
                const caseSummary = generateCaseSummary(evidenceFiles);
                let fullContext = `--- START OF CASE CONTEXT ---\n\n`;
                 if (testimony) {
                    fullContext += `**User's Personal Testimony:**\n${testimony}\n\n`;
                }
                if (employees.length > 0) {
                    fullContext += `**Employee Profiles:**\n${employees.map(e => {
                        let profileText = `- Name: ${e.name}\n  - User-Provided Details: ${e.details}`;
                        if (e.aiEnhancedDetails) {
                            profileText += `\n  - AI-Enhanced Description: ${e.aiEnhancedDetails}`;
                        }
                        return profileText;
                    }).join('\n')}\n\n`;
                }
                if (caseSummary) {
                    fullContext += `**Summary of All Evidence:**\n${caseSummary}\n`;
                }
                fullContext += `--- END OF CASE CONTEXT ---\n\n`;
                
                responseText = await processGeneralQuery(prompt, fullContext);
            } else {
                responseText = await processGeneralQuery(prompt);
            }

            const modelMessage: ChatMessage = {
                id: `model-qa-${Date.now()}`,
                role: 'model',
                content: responseText
            };
            setQaMessages(prev => prev.filter(m => !m.isLoading).concat(modelMessage));
        } catch (error) {
            console.error("Error processing Q&A message:", error);
            const errorMessage: ChatMessage = {
                id: `model-qa-error-${Date.now()}`,
                role: 'model',
                content: "Sorry, I encountered an error. Please check the console and try again."
            };
            setQaMessages(prev => prev.filter(m => !m.isLoading).concat(errorMessage));
        } finally {
            setIsQaLoading(false);
        }
    };

    const handleGenerateMap = async () => {
        setIsMapLoading(true);
        try {
            const data = await generateRelationshipMap(evidenceFiles);
            setMapData(data);
        } catch (error) {
            console.error("Error generating relationship map:", error);
            setChatMessages(prev => [...prev, {
                id: `sys-map-err-${Date.now()}`,
                role: 'system',
                content: 'Could not generate the relationship map. Please check the console for details.'
            }]);
        } finally {
            setIsMapLoading(false);
        }
    };

    const hasAnalyzedFiles = useMemo(() => {
        return evidenceFiles.some(f => f.status === 'analyzed' || f.status === 'analyzed-pending-review');
    }, [evidenceFiles]);

    const unanalyzedFiles = useMemo(() => {
        return evidenceFiles.filter(f => f.status === 'new');
    }, [evidenceFiles]);

    const selectedFile = useMemo(() => 
        evidenceFiles.find(f => f.id === selectedFileId),
        [evidenceFiles, selectedFileId]
    );

    const renderMainView = () => {
        switch (view) {
            case 'chat':
                return (
                    <div className="flex-grow flex flex-col min-w-0 h-full">
                        <UnanalyzedFilesPanel files={unanalyzedFiles} onAnalyze={handleRequestAnalysis} />
                        <ChatPanel 
                            messages={chatMessages} 
                            onFilesDropped={handleFilesDropped}
                            isLoading={isLoading}
                        />
                    </div>
                );
            case 'dashboard':
                 return (
                    <CaseDashboard
                        files={evidenceFiles}
                        mapData={mapData}
                        isLoading={isMapLoading}
                        onGenerateMap={handleGenerateMap}
                    />
                );
            case 'qa':
                return (
                    <QAPanel
                        messages={qaMessages}
                        onSendMessage={handleSendQaMessage}
                        isLoading={isQaLoading}
                    />
                );
             case 'about':
                return <AboutPanel />;
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col h-screen font-sans">
            <Header view={view} onViewChange={setView} hasAnalyzedFiles={hasAnalyzedFiles} />
            <main className="flex flex-grow overflow-hidden">
                {view !== 'about' ? (
                    <>
                        <div style={{ width: `${leftPanelWidth}px` }} className="flex-shrink-0 h-full">
                        <EvidencePanel 
                                files={evidenceFiles} 
								cases={evidenceCases}
                                selectedFileId={selectedFileId} 
                                onSelectFile={(id) => { setSelectedFileId(id); if (id) setSelectedCaseId(null); }}
                                onSelectCase={(id) => { setSelectedCaseId(id); setSelectedFileId(null); }}
                                onAppendCase={(id) => { const c = evidenceCases.find(x => x.id === id) || null; setCaseForAppend(c); setIsAppendModalOpen(!!c); }}
                                onDeleteCase={handleDeleteCase}
                                onDeleteFile={handleDeleteFile}
                                onRenameFile={handleRenameFile}
                                employees={employees}
                                onAddEmployee={handleAddNewEmployee}
                                onUpdateEmployee={handleUpdateEmployee}
                                onSetEmployees={setEmployees}
                                onDeleteEmployee={handleDeleteEmployeePermanent}
                                witnesses={witnesses}
                                onAddWitness={handleAddWitness}
                                onDeleteWitness={handleDeleteWitness}
                                onUpdateWitness={handleUpdateWitness}
                                onSaveWitness={handleSaveWitness}
                                testimony={testimony}
                                contextSummary={contextSummary}
                                onSaveTestimony={handleSaveTestimony}
                            />
                        </div>
                        <ResizeHandle onMouseDown={(e) => handleResizeMouseDown(e, 'left')} />
                        <div className="flex-grow flex flex-col min-w-0 h-full">
                            {renderMainView()}
                        </div>
                        <ResizeHandle onMouseDown={(e) => handleResizeMouseDown(e, 'right')} />
                        <div style={{ width: `${rightPanelWidth}px` }} className="flex-shrink-0 h-full">
            <AnalysisPanel 
                                file={selectedFile || null} 
                                caseItem={selectedCaseId ? evidenceCases.find(c => c.id === selectedCaseId) || null : null}
                                employees={employees}
                                onRecognitionReview={handleRecognitionReview}
                                onRerunAnalysis={handleRerunAnalysis}
                                onUpdateUnifiedAnalysis={handleUpdateUnifiedCaseAnalysis}
                                onRerunUnifiedCase={handleRerunUnifiedCase}
                                onRerunSingle={(fileId, instructions) => {
                                    const file = evidenceFiles.find(f => f.id === fileId);
                                    if (file) {
                                        runAnalysis(file, instructions);
                                    }
                                }}
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex-grow min-w-0">
                         {renderMainView()}
                    </div>
                )}
            </main>
            
            <AnalysisSetupModal
                isOpen={isModalOpen && fileForAnalysis !== null}
                files={fileForAnalysis ? [fileForAnalysis] : []}
                allFiles={evidenceFiles}
                onCancel={() => {
                    setIsModalOpen(false);
                    setFileForAnalysis(null);
                }}
                onConfirm={(files, location, instructions) => handleStartAnalysis(files, location, instructions)}
                maxUnifiedFiles={MAX_UNIFIED_FILES}
            />
            {/* Append to existing unified case */}
            <AnalysisSetupModal
                isOpen={isAppendModalOpen && caseForAppend !== null}
                files={caseForAppend ? caseForAppend.fileIds.map(id => evidenceFiles.find(f => f.id === id)).filter((f): f is EvidenceFile => Boolean(f)) : []}
                allFiles={evidenceFiles}
                onCancel={() => { setIsAppendModalOpen(false); setCaseForAppend(null); }}
                onConfirm={(files, location, instructions) => {
                    if (!caseForAppend) return;
                    setIsAppendModalOpen(false);
                    setCaseForAppend(null);
                    // apply location to all files
                    if (location) {
                        files.forEach(f => updateEvidenceFile(f.id, { location }));
                    }
                    rerunUnifiedCaseAnalysis(caseForAppend.id, files, instructions);
                }}
                maxUnifiedFiles={MAX_UNIFIED_FILES}
            />
        </div>
    );
};

export default App;
