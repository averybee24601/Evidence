
import React from 'react';
import { EvidenceFile } from '../types';
import ReportIcon from './icons/ReportIcon';

interface UnanalyzedFilesPanelProps {
    files: EvidenceFile[];
    onAnalyze: (id: string) => void;
}

const FileIcon: React.FC<{ type: EvidenceFile['type'] }> = ({ type }) => {
    const baseClass = "h-8 w-8 mx-auto mb-2";
    switch (type) {
        case 'image':
            return <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-blue-400`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>;
        case 'video':
            return <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-purple-400`} viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>;
        case 'audio':
             return <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-green-400`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>;
        case 'document':
            return <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-yellow-400`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5L9 4H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" /></svg>;
        default:
            return <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-gray-400`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5L9 4H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" /></svg>;
    }
};


const UnanalyzedFileCard: React.FC<{file: EvidenceFile, onAnalyze: (id: string) => void}> = ({ file, onAnalyze }) => {
    const openFile = () => {
        const viewUrl = file.url || (file.storedFileName ? `/api/storage/file/${encodeURIComponent(file.storedFileName)}` : undefined);
        if (!viewUrl) {
            alert('Source file not available. Re-upload to preview.');
            return;
        }
        window.open(viewUrl, '_blank', 'noopener,noreferrer');
    };
    return (
        <div className="w-40 h-44 flex-shrink-0 bg-gray-700/50 rounded-lg flex flex-col p-3 text-center justify-between group relative overflow-hidden">
            <div className="absolute inset-0 bg-gray-900/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative">
                <FileIcon type={file.type} />
                <p className="text-xs text-gray-300 truncate">{file.name}</p>
            </div>
            <button
                onClick={openFile}
                className="relative w-full mb-2 flex items-center justify-center space-x-2 bg-gray-600/70 hover:bg-gray-600 text-white font-semibold py-1.5 rounded-md transition-all text-xs"
            >
                <span>Open</span>
            </button>
            <button
                onClick={() => onAnalyze(file.id)}
                className="relative w-full flex items-center justify-center space-x-2 bg-teal-600/80 hover:bg-teal-600 text-white font-bold py-2 rounded-md transition-all text-sm"
            >
                <ReportIcon className="h-4 w-4" />
                <span>Analyze</span>
            </button>
        </div>
    )
}

const UnanalyzedFilesPanel: React.FC<UnanalyzedFilesPanelProps> = ({ files, onAnalyze }) => {
    if (files.length === 0) {
        return null;
    }

    return (
        <div className="flex-shrink-0 border-b border-gray-700" style={{ height: '260px' }}>
             <div className="p-4 bg-gray-800/30 h-full flex flex-col">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-300">Unanalyzed Files</h3>
                    <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">{files.length} file{files.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex-grow overflow-x-auto overflow-y-hidden">
                    <div className="flex space-x-3 h-full pb-2">
                        {files.map(file => (
                           <UnanalyzedFileCard key={file.id} file={file} onAnalyze={onAnalyze} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UnanalyzedFilesPanel;