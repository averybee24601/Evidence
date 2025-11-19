
import React from 'react';
import { AnalysisResult, EvidenceType } from '../types';
import SeverityBar from './SeverityBar';

interface AnalysisReportProps {
    analysis: AnalysisResult;
    fileName: string;
    fileType: EvidenceType;
}

const AnalysisReport: React.FC<AnalysisReportProps> = ({ analysis, fileName, fileType }) => {
    return (
        <div className="space-y-3">
            <h3 className="font-bold text-base border-b border-gray-500 pb-2">Analysis Report: <span className="font-normal">{fileName}</span></h3>
            
            <div>
                <h4 className="font-semibold text-sm text-gray-300 mb-1">Summary</h4>
                <p className="text-sm">{analysis.summary}</p>
            </div>

            <SeverityBar score={analysis.severityScore} />

            <div>
                <h4 className="font-semibold text-sm text-gray-300 mb-2">Key Observations</h4>
                <ul className="space-y-2 text-sm max-h-48 overflow-y-auto pr-2">
                    {analysis.keyObservations.map((obs, index) => (
                        <li key={index} className="flex items-start">
                           {obs.timestamp !== "N/A" && <span className="bg-gray-600 text-xs font-mono rounded px-1.5 py-0.5 mr-2">{obs.timestamp}</span>}
                           <p className="flex-1">{obs.description}</p>
                        </li>
                    ))}
                </ul>
            </div>
            
            {analysis.fullTranscript && analysis.fullTranscript !== "N/A" && (
                 <div>
                    <details>
                        <summary className="font-semibold text-sm text-gray-300 cursor-pointer">View Full Transcript</summary>
                        <div className="mt-2 p-2 bg-gray-800/50 rounded-md text-xs max-h-48 overflow-y-auto">
                            <p className="whitespace-pre-wrap">{analysis.fullTranscript}</p>
                        </div>
                    </details>
                </div>
            )}
        </div>
    );
};

export default AnalysisReport;
