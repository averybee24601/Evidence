import React from 'react';
import { EvidenceFile, RelationshipMapData } from '../types';
import SpinnerIcon from './icons/SpinnerIcon';
import RelationshipMap from './RelationshipMap';
import UsersIcon from './icons/UsersIcon';

interface CaseDashboardProps {
    files: EvidenceFile[];
    mapData: RelationshipMapData | null;
    isLoading: boolean;
    onGenerateMap: () => void;
}

const CaseDashboard: React.FC<CaseDashboardProps> = ({ files, mapData, isLoading, onGenerateMap }) => {
    const analyzedFilesCount = files.filter(f => f.status === 'analyzed').length;

    if (isLoading) {
        return (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-8 bg-gray-900">
                <SpinnerIcon className="h-12 w-12 text-teal-400 mb-4" />
                <h2 className="text-xl font-semibold text-gray-200">Synthesizing Case Data...</h2>
                <p className="text-gray-400">The AI is analyzing all evidence to build the relationship map. This may take a moment.</p>
            </div>
        );
    }

    if (!mapData) {
        return (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-8 bg-gray-900">
                <UsersIcon className="h-16 w-16 text-gray-600 mb-4" />
                <h2 className="text-2xl font-bold text-gray-200">Case Relationship Dashboard</h2>
                <p className="max-w-md mt-2 text-gray-400">
                    Generate an interactive map to visualize the relationships and interactions between individuals across all your analyzed evidence.
                </p>
                <button
                    onClick={onGenerateMap}
                    disabled={analyzedFilesCount < 1}
                    className="mt-6 bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    {analyzedFilesCount < 1 ? 'Analyze at least one file first' : 'Generate Relationship Map'}
                </button>
            </div>
        );
    }

    return (
        <div className="flex-grow flex flex-col bg-gray-900 h-full overflow-y-auto">
            <div className="p-6">
                 <h2 className="text-xl font-bold text-teal-400 mb-2">AI Case Summary</h2>
                 <p className="text-sm text-gray-300 mb-4 prose prose-sm prose-invert max-w-none">{mapData.overallSummary}</p>
            </div>
            <div className="flex-grow relative">
                <RelationshipMap data={mapData} />
            </div>
        </div>
    );
};

export default CaseDashboard;
