import React from 'react';
import { ChatMessage } from '../types';
import { marked } from 'marked';

interface ChatMessageProps {
    message: ChatMessage;
}

const ChatMessageComponent: React.FC<ChatMessageProps> = ({ message }) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    const createMarkup = (content: string) => {
        return { __html: marked(content, { gfm: true, breaks: true }) };
    };

    if (isSystem) {
        return (
            <div className="text-center my-4">
                <p className="text-xs text-gray-500 bg-gray-800/50 rounded-full px-4 py-1 inline-block">{message.content}</p>
            </div>
        );
    }

    return (
        <div className={`flex my-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xl lg:max-w-2xl px-4 py-3 rounded-2xl shadow ${isUser ? 'bg-teal-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                {message.isLoading ? (
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                    </div>
                ) : (
                    <div className="prose prose-sm prose-invert" dangerouslySetInnerHTML={createMarkup(message.content)} />
                )}
            </div>
        </div>
    );
};

export default ChatMessageComponent;