

import React, { useRef, useEffect, useState } from 'react';
import { ChatMessage } from '../types';
import ChatMessageComponent from './ChatMessage';
import ChatInput from './ChatInput';

interface QAPanelProps {
    messages: ChatMessage[];
    onSendMessage: (prompt: string, analyzeEntireCase: boolean) => void;
    isLoading: boolean;
}

const QAPanel: React.FC<QAPanelProps> = ({ messages, onSendMessage, isLoading }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [analyzeEntireCase, setAnalyzeEntireCase] = useState(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);
    
    // Wrapper for onSendMessage to match ChatInput's signature
    const handleSendMessage = (prompt: string) => {
        onSendMessage(prompt, analyzeEntireCase);
    };

    const handleFilesDropped = (files: File[]) => {
        // Not implemented for Q&A panel
    };

    return (
        <div className="flex-grow flex flex-col bg-gray-900 h-full">
            <div className="p-3 border-b border-gray-700 bg-gray-800/50">
                <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={analyzeEntireCase}
                        onChange={(e) => setAnalyzeEntireCase(e.target.checked)}
                        className="h-4 w-4 text-teal-500 bg-gray-700 border-gray-600 rounded focus:ring-teal-500 focus:ring-offset-gray-800"
                    />
                    <span className="text-sm font-medium text-gray-200 select-none">Analyze Entire Case Context</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 pl-7">
                    When enabled, the AI will review all evidence, profiles, and testimony to answer your question.
                </p>
            </div>
            <div className="flex-grow p-4 overflow-y-auto">
                {messages.map(msg => (
                    <ChatMessageComponent key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
            </div>
            <ChatInput 
                onSendMessage={handleSendMessage} 
                onFilesDropped={handleFilesDropped}
                isLoading={isLoading} 
            />
        </div>
    );
};

export default QAPanel;