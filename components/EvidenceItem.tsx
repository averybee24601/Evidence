

import React from 'react';
import { EvidenceFile } from '../types';
import SpinnerIcon from './icons/SpinnerIcon';
import DownloadIcon from './icons/DownloadIcon';
import TrashIcon from './icons/TrashIcon';
import ReportIcon from './icons/ReportIcon';
import FolderOpenIcon from './icons/FolderOpenIcon';
import { generateReportText } from '../services/utils';
import { revealOnDisk } from '../services/storageService';

interface EvidenceItemProps {
    file: EvidenceFile;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onRename: (id: string, newName: string) => void;
}

const FileIcon: React.FC<{ type: EvidenceFile['type'] }> = ({ type }) => {
    switch (type) {
        case 'image':
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>;
        case 'video':
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-purple-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>;
        case 'audio':
             return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>;
        case 'document':
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-yellow-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5L9 4H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" /></svg>;
        default:
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5L9 4H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" /></svg>;
    }
};

const StatusIndicator: React.FC<{ status: EvidenceFile['status'] }> = ({ status }) => {
    switch (status) {
        case 'analyzing':
            return <SpinnerIcon className="h-4 w-4 text-teal-400" />;
        case 'analyzed-pending-review':
        case 'analyzed':
            return <div className="h-3 w-3 rounded-full bg-green-500" title="Analyzed"></div>;
        case 'error':
            return <div className="h-3 w-3 rounded-full bg-red-500" title="Error"></div>;
        case 'new':
        default:
            return <div className="h-3 w-3 rounded-full bg-gray-500" title="New"></div>;
    }
}

const EvidenceItem: React.FC<EvidenceItemProps> = ({ file, isSelected, onSelect, onDelete, onRename }) => {
    const baseClasses = `p-2 transition-colors duration-200 w-full text-left group rounded-lg flex items-center`;
    const selectedClasses = "bg-teal-700 text-white";
    const unselectedClasses = "hover:bg-gray-700";
    
    const hasSourceFile = !!file.file;

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!hasSourceFile && file.analysis) {
            const reportContent = generateReportText(file);
            const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Analysis Report - ${file.name}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            return;
        }

        if (hasSourceFile && file.analysis && file.file) {
            try {
                const JSZip = (await import('jszip')).default;
                const zip = new JSZip();

                zip.file(file.name, file.file);
                const reportContent = generateReportText(file);
                const reportFileName = `Analysis Report - ${file.name}.txt`;
                zip.file(reportFileName, reportContent);

                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const zipFileName = `Evidence Package - ${file.name}.zip`;

                const link = document.createElement('a');
                link.href = URL.createObjectURL(zipBlob);
                link.download = zipFileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            } catch (error) {
                console.error('Error creating zip file:', error);
                alert('Could not create the download package. Please try again.');
            }
            return;
        }
        
        if (hasSourceFile && file.url) {
            const link = document.createElement('a');
            link.href = file.url;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        const viewUrl = file.url || (file.storedFileName ? `/api/storage/file/${encodeURIComponent(file.storedFileName)}` : undefined);
        if (!viewUrl) {
            alert('Source file not available. Re-upload to preview.');
            return;
        }
        window.open(viewUrl, '_blank', 'noopener,noreferrer');
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to permanently delete "${file.name}"? This action cannot be undone.`)) {
            onDelete(file.id);
        }
    };

    const handleRename = (e: React.MouseEvent) => {
        e.stopPropagation();
        const ext = (file.storedFileName || file.name).split('.').pop() || '';
        const current = file.storedFileName || file.name;
        const suggested = current;
        const next = window.prompt('Enter new file name', suggested || '');
        if (!next) return;
        const trimmed = next.trim();
        if (!trimmed) return;
        onRename(file.id, trimmed);
    };

    const handleRevealFile = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const rel = file.storedFilePath || (file.storedFileName ? `app/data/analyzed files/${file.storedFileName}` : undefined);
        if (!rel) {
            alert('This item is not saved on disk yet.');
            return;
        }
        try {
            await revealOnDisk({ relativePath: rel });
        } catch (err: any) {
            console.error('Failed to reveal file:', err);
            alert(err?.message || 'Unable to reveal file location.');
        }
    };

    const handleRevealReport = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const reports = file.analysisDocuments || [];
        const rel = reports.length > 0 ? reports[reports.length - 1] : undefined;
        if (!rel) {
            alert('No analysis report has been saved for this item yet.');
            return;
        }
        try {
            await revealOnDisk({ relativePath: rel });
        } catch (err: any) {
            console.error('Failed to reveal report:', err);
            alert(err?.message || 'Unable to reveal report location.');
        }
    };
    
    const downloadTitle = !hasSourceFile 
        ? (file.analysis ? "Download analysis report only" : "Source file not available")
        : (file.analysis ? "Download file & analysis (.zip)" : "Download original file");
    
    const overallTitle = `SHA-256: ${file.hash || 'Not calculated'}${!hasSourceFile ? '\n(Source file needs to be re-uploaded for preview/re-analysis)' : ''}`;

    return (
        <div 
            onClick={() => onSelect(file.id)}
            className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses} cursor-pointer`}
            title={overallTitle}
        >
            <FileIcon type={file.type} />
            <span className="truncate text-sm flex-grow">{file.name}</span>
            <div className="ml-2 flex-shrink-0 flex items-center space-x-2">
                 <button 
                    onClick={handleRevealFile}
                    title="Reveal analyzed file in folder"
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400 hover:text-white transition-opacity"
                >
                    <FolderOpenIcon className="h-4 w-4" />
                </button>
                <button 
                    onClick={handleRevealReport}
                    title="Reveal analysis report in folder"
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400 hover:text-white transition-opacity"
                >
                    <ReportIcon className="h-4 w-4" />
                </button>
                 <button 
                    onClick={handleOpen}
                    title="Open in new tab"
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400 hover:text-white transition-opacity"
                >
                    {/* simple eye icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 110-10 5 5 0 010 10zm0-2a3 3 0 100-6 3 3 0 000 6z"/></svg>
                </button>
                 <button 
                    onClick={handleDownload}
                    title={downloadTitle}
                    disabled={!hasSourceFile && !file.analysis}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400 hover:text-white transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
                >
                    {!hasSourceFile && file.analysis ? <ReportIcon className="h-4 w-4" /> : <DownloadIcon className="h-4 w-4" />}
                </button>
                 <button 
                    onClick={handleDelete}
                    title="Delete file"
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400 hover:text-red-400 transition-opacity"
                >
                    <TrashIcon className="h-4 w-4" />
                </button>
                 <button 
                    onClick={handleRename}
                    title="Rename file"
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400 hover:text-white transition-opacity"
                >
                    {/* pencil icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-9.193 9.193a1 1 0 01-.293.195l-3 1a1 1 0 01-1.265-1.265l1-3a1 1 0 01.195-.293l9.193-9.193zM12.172 5L4 13.172V16h2.828L15 7.828 12.172 5z"/></svg>
                </button>
                <StatusIndicator status={file.status} />
            </div>
        </div>
    );
};

export default EvidenceItem;