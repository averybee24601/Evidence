

import React, { useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import ChatMessageComponent from './ChatMessage';
import UploadZone from './UploadZone';

interface ChatPanelProps {
    messages: ChatMessage[];
    onFilesDropped: (files: File[]) => void;
    isLoading: boolean;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onFilesDropped, isLoading }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    return (
        <div className="flex-grow flex flex-col bg-gray-900 h-full">
            <div className="flex-grow p-4 overflow-y-auto relative">
                {messages.length === 0 ? (
                     <div className="flex h-full items-center justify-center text-center p-4">
                        <p className="bg-gray-800/80 rounded-full px-4 py-2 text-gray-400">Welcome! Add employee profiles and drop files to begin.</p>
                   </div>
                ) : (
                    messages.map(msg => (
                        <ChatMessageComponent key={msg.id} message={msg} />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>
            <UploadZone onFilesDropped={onFilesDropped} />
        </div>
    );
};

export default ChatPanel;