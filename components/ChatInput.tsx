
import React, { useState, useRef, KeyboardEvent, ChangeEvent } from 'react';
import SendIcon from './icons/SendIcon';

interface ChatInputProps {
    onSendMessage: (prompt: string) => void;
    onFilesDropped: (files: File[]) => void;
    isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
    onSendMessage, 
    onFilesDropped,
    isLoading, 
}) => {
    const [prompt, setPrompt] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const handleSend = () => {
        if (prompt.trim()) {
            onSendMessage(prompt.trim());
            setPrompt('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handlePromptChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setPrompt(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    }
    
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

    const placeholderText = "Type a message or drag & drop up to 5 files here...";

    return (
        <div className="p-4 bg-gray-800 border-t border-gray-700">
            <div 
                className={`relative bg-gray-700 rounded-xl flex items-center transition-all duration-200 ${isDragOver ? 'ring-2 ring-teal-500 shadow-lg' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {isDragOver && (
                    <div className="absolute inset-0 bg-teal-500/20 rounded-xl flex items-center justify-center pointer-events-none">
                        <p className="font-bold text-teal-300">Drop to Upload</p>
                    </div>
                )}
                <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={handlePromptChange}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholderText}
                    className="w-full bg-transparent p-3 pl-4 pr-14 text-gray-200 placeholder-gray-400 resize-none focus:outline-none"
                    rows={1}
                    style={{ maxHeight: '12rem' }}
                    disabled={isLoading}
                />
                <div className="absolute right-2 bottom-2 flex items-center space-x-1">
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !prompt.trim()}
                        className="p-2 rounded-lg bg-teal-600 text-white hover:bg-teal-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                        <SendIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatInput;
