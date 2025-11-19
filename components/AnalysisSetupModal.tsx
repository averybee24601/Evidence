import React, { useEffect, useState } from 'react';
import { EvidenceFile } from '../types';
import DraggableResizableFrame from './DraggableResizableFrame';

interface AnalysisSetupModalProps {
    files: EvidenceFile[] | null;
    allFiles?: EvidenceFile[]; // used to offer "Analyze with" options
    isOpen: boolean;
    onConfirm: (files: EvidenceFile[], location: string, instructions: string) => void;
    onCancel: () => void;
    maxUnifiedFiles?: number;
}

const AnalysisSetupModal: React.FC<AnalysisSetupModalProps> = ({ files, allFiles = [], isOpen, onConfirm, onCancel, maxUnifiedFiles = 7 }) => {
    const [location, setLocation] = useState('');
    const [instructions, setInstructions] = useState('');
    const baseCount = files?.length ?? 0;
    const additionalSlots = Math.max(0, maxUnifiedFiles - baseCount);
    const primaryFileId = files && files.length > 0 ? files[0].id : 'none';
    const [additionalFileIds, setAdditionalFileIds] = useState<string[]>(Array(additionalSlots).fill(''));

    useEffect(() => {
        if (!isOpen) return;
        setAdditionalFileIds(Array(additionalSlots).fill(''));
        setLocation('');
        setInstructions('');
    }, [isOpen, primaryFileId, additionalSlots]);

    if (!isOpen || !files || files.length === 0) return null;

    // Build the list of selectable files: exclude the primary file and any currently analyzing.
    // Sort so 'new' (unanalyzed) files appear first, then others by name.
    const existingIds = new Set((files || []).map(f => f.id));
    const availableFiles = allFiles
        .filter(f => files && !existingIds.has(f.id) && f.status === 'new')
        .sort((a, b) => a.name.localeCompare(b.name));

    const handleAdditionalFileChange = (index: number, value: string) => {
        const newIds = [...additionalFileIds];
        newIds[index] = value;
        setAdditionalFileIds(newIds);
    };

    const handleSubmit = () => {
        if (!files) return;
        // Include all context files (not just the first)
        let selected: EvidenceFile[] = files.slice(0, maxUnifiedFiles);

        // Add all selected additional files
        additionalFileIds.forEach(id => {
            if (id) {
                const file = allFiles.find(f => f.id === id);
                if (file) {
                    selected.push(file);
                }
            }
        });

        onConfirm(selected.slice(0, maxUnifiedFiles), location, instructions);
    };

    const title = files.length > 1 ? `Analysis Setup for ${files.length} Files` : 'Analysis Setup';
    
    return (
        <DraggableResizableFrame
            isOpen={isOpen}
            onClose={onCancel}
            title={title}
            initialPosition={{ x: Math.max(16, window.innerWidth / 2 - 360), y: 80 }}
            initialSize={{ width: 720, height: 560 }}
        >
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl h-full flex flex-col">
                <p className="text-sm text-gray-300 mb-2 font-medium">
                    Provide context for the following file(s):
                </p>
                <div className="text-xs bg-gray-700/60 p-3 rounded-md max-h-40 overflow-y-auto mb-5 border border-gray-600/40">
                    <ul className="list-disc list-inside text-gray-200 space-y-1">
                        {files.map(f => <li key={f.id} className="break-words">{f.name}</li>)}
                    </ul>
                </div>


                <div className="space-y-4 flex-grow">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Analyze with (optional - up to {additionalSlots} additional file{additionalSlots === 1 ? '' : 's'})
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {additionalFileIds.map((fileId, index) => (
                                <select
                                    key={index}
                                    value={fileId}
                                    onChange={(e) => handleAdditionalFileChange(index, e.target.value)}
                                    className="w-full bg-gray-700 p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                                >
                                    <option value="">-- File {index + 1} --</option>
                                    {availableFiles
                                        .filter(f => !additionalFileIds.includes(f.id) || f.id === fileId)
                                        .map(f => (
                                            <option key={f.id} value={f.id}>{f.name}</option>
                                        ))}
                                </select>
                            ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Select additional unanalyzed files to cross-reference together.</p>
                    </div>
                    <div>
                        <label htmlFor="location" className="block text-sm font-medium text-gray-300 mb-1">Location of Event(s)</label>
                        <input
                            type="text"
                            id="location"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g., Main office, Community outing"
                            className="w-full bg-gray-700 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                        />
                         <p className="text-xs text-gray-500 mt-1">This location will be applied to all selected files.</p>
                    </div>
                     <div>
                        <label htmlFor="instructions" className="block text-sm font-medium text-gray-300 mb-1">Instructions / Notes (Optional)</label>
                        <textarea
                            id="instructions"
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            placeholder="e.g., Focus on the interaction between Jose and Maria."
                            className="w-full bg-gray-700 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm resize-y"
                            rows={3}
                        />
                         <p className="text-xs text-gray-500 mt-1">Provide any specific instructions for the AI analysis.</p>
                    </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 rounded-md transition-colors"
                    >
                        Start Analysis
                    </button>
                </div>
            </div>
        </DraggableResizableFrame>
    );
};

export default AnalysisSetupModal;
