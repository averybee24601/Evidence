import React, { useState, useRef } from 'react';
import PaperclipIcon from './icons/PaperclipIcon';

interface UploadZoneProps {
    onFilesDropped: (files: File[]) => void;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFilesDropped }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files).slice(0, 5);
            onFilesDropped(files);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files).slice(0, 5);
            onFilesDropped(files);
        }
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="p-4 bg-gray-800 border-t border-gray-700">
            <div
                className={`relative bg-gray-700 rounded-xl flex items-center justify-center transition-all duration-200 h-24 border-2 border-dashed ${isDragOver ? 'border-teal-500 bg-teal-500/10' : 'border-gray-600'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,video/*,audio/*,.txt,.md"
                />
                <div className="text-center text-gray-400">
                    <p>Drag & drop up to 5 files here</p>
                    <p className="text-xs my-1">or</p>
                    <button
                        onClick={handleClick}
                        className="flex items-center mx-auto space-x-2 bg-gray-600 hover:bg-gray-500 text-gray-200 px-3 py-1 rounded-md text-sm transition-colors"
                    >
                        <PaperclipIcon className="h-4 w-4" />
                        <span>Choose Files</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UploadZone;
