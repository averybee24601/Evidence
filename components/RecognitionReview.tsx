import React, { useState } from 'react';
import { EvidenceFile, RecognizedEmployee } from '../types';
import CheckCircleIcon from './icons/CheckCircleIcon';
import XCircleIcon from './icons/XCircleIcon';
import ReportIcon from './icons/ReportIcon';

interface RecognitionReviewProps {
    file: EvidenceFile;
    onConfirm: (fileId: string, confirmedEmployees: RecognizedEmployee[]) => void;
}

const RecognitionReview: React.FC<RecognitionReviewProps> = ({ file, onConfirm }) => {
    const initialDetections = file.analysis?.recognizedEmployees || [];
    const [confirmations, setConfirmations] = useState<Record<string, boolean>>(
        initialDetections.reduce((acc, emp) => ({ ...acc, [emp.name]: true }), {})
    );

    const handleToggle = (name: string) => {
        setConfirmations(prev => ({ ...prev, [name]: !prev[name] }));
    };

    const handleFinalize = () => {
        const confirmedEmployees = initialDetections.filter(emp => confirmations[emp.name]);
        onConfirm(file.id, confirmedEmployees);
    };
    
    const allConfirmed = initialDetections.every(emp => confirmations[emp.name]);

    return (
        <div className="flex flex-col h-full">
            <div className="pb-3 border-b border-gray-700 mb-2">
                 <h3 className="text-lg font-bold text-teal-400">Recognition Review</h3>
                 <p className="text-xs text-gray-400">Confirm the AI's findings for "{file.name}" before saving the report.</p>
            </div>
            <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                 {initialDetections.length === 0 ? (
                    <div className="text-center text-gray-500 pt-10">
                        <p>No registered employees were detected in this file.</p>
                    </div>
                ) : (
                    initialDetections.map((emp, index) => (
                        <div key={index} className={`p-2 rounded-md flex justify-between items-center transition-colors ${confirmations[emp.name] ? 'bg-gray-700' : 'bg-red-900/50'}`}>
                            <div>
                                <p className="font-semibold text-sm">{emp.name}</p>
                                <p className="text-xs text-gray-400">Confidence: {emp.confidence}% at {emp.timestamp}</p>
                            </div>
                            <div className="flex space-x-2">
                                <button onClick={() => handleToggle(emp.name)} title={confirmations[emp.name] ? "Mark as incorrect" : "Confirm match"}>
                                    {confirmations[emp.name] ? (
                                        <XCircleIcon className="h-6 w-6 text-gray-500 hover:text-red-400" />
                                     ) : (
                                        <CheckCircleIcon className="h-6 w-6 text-gray-500 hover:text-green-400" />
                                    )}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700">
                <button 
                    onClick={handleFinalize}
                    className="w-full flex items-center justify-center space-x-2 bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 rounded-md transition-colors"
                >
                    <ReportIcon className="h-5 w-5" />
                    <span>{allConfirmed && initialDetections.length > 0 ? 'Confirm All & Save Report' : 'Save Confirmed & Finalize'}</span>
                </button>
            </div>
        </div>
    );
};

export default RecognitionReview;
