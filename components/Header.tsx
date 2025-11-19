import React from 'react';
import ChatBubbleIcon from './icons/ChatBubbleIcon';
import UsersIcon from './icons/UsersIcon';
import ScaleIcon from './icons/ScaleIcon';
import QuestionMarkCircleIcon from './icons/QuestionMarkCircleIcon';
import { CURRENT_MODEL_NAME } from '../services/geminiService';

interface HeaderProps {
    view: 'chat' | 'dashboard' | 'qa' | 'about';
    onViewChange: (view: 'chat' | 'dashboard' | 'qa' | 'about') => void;
    hasAnalyzedFiles: boolean;
}

const Header: React.FC<HeaderProps> = ({ view, onViewChange, hasAnalyzedFiles }) => {

    const TabButton: React.FC<{
        label: string;
        isActive: boolean;
        onClick: () => void;
        icon: React.ReactNode;
        disabled?: boolean;
    }> = ({ label, isActive, onClick, icon, disabled }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${isActive
                    ? 'bg-teal-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 disabled:text-gray-500 disabled:hover:bg-transparent disabled:cursor-not-allowed'
                }`}
            title={disabled ? "Analyze at least one file to enable the dashboard" : ""}
        >
            {icon}
            <span>{label}</span>
        </button>
    );

    return (
        <header className="bg-gray-800 p-4 border-b border-gray-700 shadow-md flex justify-between items-center">
            <div>
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-teal-400">AI Evidence Companion</h1>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-teal-200 border border-gray-600">
                        {CURRENT_MODEL_NAME}
                    </span>
                </div>
                <p className="text-sm text-gray-400">Your private, objective partner in analyzing multimedia evidence.</p>
            </div>
            <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 p-1 bg-gray-900 rounded-lg">
                    <TabButton
                        label="Evidence Chat"
                        isActive={view === 'chat'}
                        onClick={() => onViewChange('chat')}
                        icon={<ChatBubbleIcon className="h-5 w-5" />}
                    />
                    <TabButton
                        label="Case Dashboard"
                        isActive={view === 'dashboard'}
                        onClick={() => onViewChange('dashboard')}
                        icon={<UsersIcon className="h-5 w-5" />}
                        disabled={!hasAnalyzedFiles}
                    />
                    <TabButton
                        label="Legal Q&A"
                        isActive={view === 'qa'}
                        onClick={() => onViewChange('qa')}
                        icon={<ScaleIcon className="h-5 w-5" />}
                    />
                    <TabButton
                        label="About"
                        isActive={view === 'about'}
                        onClick={() => onViewChange('about')}
                        icon={<QuestionMarkCircleIcon className="h-5 w-5" />}
                    />
                </div>
            </div>
        </header>
    );
};

export default Header;