import React, { useState, useEffect, useRef } from 'react';
import SaveIcon from './icons/SaveIcon';
import SpeakerWaveIcon from './icons/SpeakerWaveIcon';
import PauseIcon from './icons/PauseIcon';
import StopIcon from './icons/StopIcon';
import { getPreferredVoice, pauseSpeaking, resumeSpeaking, speakInChunks, stopSpeaking } from '../services/tts';

interface MyTestimonyProps {
    testimony: string;
    contextSummary: string;
    onSave: (testimony: string) => void;
    additionalTestimonies?: { name: string; role?: string; testimony: string; }[];
}

const MyTestimony: React.FC<MyTestimonyProps> = ({ testimony, contextSummary, onSave, additionalTestimonies = [] }) => {
    const [text, setText] = useState(testimony);
    const [isFullOpen, setIsFullOpen] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [isSummarySpeaking, setIsSummarySpeaking] = useState(false);
    const [isSummaryPaused, setIsSummaryPaused] = useState(false);
    
    // Start in edit mode if empty, otherwise saved mode
    const [isEditing, setIsEditing] = useState(() => !testimony);

    useEffect(() => {
        // Update local state if parent prop changes significantly (optional sync logic)
        // For now, we rely on local 'text' for editing to avoid jumpiness.
        if (testimony && !isEditing && testimony !== text) {
             setText(testimony);
        }
    }, [testimony, isEditing]);

    const handleSave = () => {
        onSave(text);
        setIsEditing(false);
    };

    const handleEdit = () => {
        setIsEditing(true);
    };

    const buildMyTestimonyText = () => {
        const content = (text || '').trim();
        return content || 'No testimony available.';
    };

    const handleSpeak = async () => {
        if (!('speechSynthesis' in window)) {
            alert('Text-to-speech is not supported in this browser.');
            return;
        }
        if (speechSynthesis.speaking) stopSpeaking();
        const voice = await getPreferredVoice();
        const textToRead = buildMyTestimonyText();
        speakInChunks(textToRead, {
            voice,
            rate: 1.0,
            pitch: 1.0,
            onstart: () => { setIsSpeaking(true); setIsPaused(false); },
            onend: () => { setIsSpeaking(false); setIsPaused(false); },
        });
    };

    const handleSpeakSummary = async () => {
        if (!('speechSynthesis' in window)) {
            alert('Text-to-speech is not supported in this browser.');
            return;
        }
        if (!contextSummary) return;
        if (speechSynthesis.speaking) stopSpeaking();
        const voice = await getPreferredVoice();
        speakInChunks(contextSummary, {
            voice,
            rate: 1.0,
            pitch: 1.0,
            onstart: () => { setIsSummarySpeaking(true); setIsSummaryPaused(false); },
            onend: () => { setIsSummarySpeaking(false); setIsSummaryPaused(false); },
        });
    };

    const handlePauseResume = () => {
        if (!isSpeaking) return;
        if (isPaused) {
            resumeSpeaking();
            setIsPaused(false);
        } else {
            pauseSpeaking();
            setIsPaused(true);
        }
    };

    const handleStop = () => {
        stopSpeaking();
        setIsSpeaking(false);
        setIsPaused(false);
    };

    return (
        <div className="border-b border-gray-700 pb-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-400">My Testimony</h3>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="text-xs text-gray-300 hover:text-white px-2 py-1 rounded bg-gray-700/50"
                        title={collapsed ? 'Show' : 'Hide'}
                    >
                        {collapsed ? 'Show' : 'Hide'}
                    </button>
                    {!isSpeaking ? (
                        <button onClick={handleSpeak} className="flex items-center space-x-1 bg-indigo-600/70 hover:bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded">
                            <SpeakerWaveIcon className="h-4 w-4" />
                            <span>Listen</span>
                        </button>
                    ) : (
                        <>
                            <button onClick={handlePauseResume} className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">
                                {isPaused ? <SpeakerWaveIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
                                <span>{isPaused ? 'Resume' : 'Pause'}</span>
                            </button>
                            <button onClick={handleStop} className="flex items-center space-x-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                                <StopIcon className="h-4 w-4" />
                                <span>Stop</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
            {!collapsed && (
            <div className="relative group">
                {isEditing ? (
                    <>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Write your personal statement here. This will give the AI context for its analysis."
                            className="w-full bg-gray-700 text-sm p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                            rows={5}
                            autoFocus
                        />
                        <button
                            onClick={handleSave}
                            className="absolute bottom-2 right-2 bg-teal-600 hover:bg-teal-500 text-white px-2 py-1 rounded-md transition-colors text-xs font-medium flex items-center gap-1"
                            title="Save Testimony"
                        >
                            <SaveIcon className="h-3 w-3" /> Save
                        </button>
                    </>
                ) : (
                    <div 
                        className="w-full bg-gray-700/50 text-sm p-2 rounded-md max-h-40 overflow-y-auto cursor-pointer hover:bg-gray-700 transition-colors relative"
                        onClick={handleEdit}
                        title="Click to edit"
                    >
                        <p className="whitespace-pre-wrap text-gray-200">{text || '(empty)'}</p>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <span className="text-xs text-gray-400 bg-gray-800 px-1 rounded border border-gray-600">Click to Edit</span>
                        </div>
                    </div>
                )}
            </div>
            )}
            {!collapsed && contextSummary !== undefined && (
                <div
                    onClick={() => setIsFullOpen(true)}
                    className="mt-2 text-left w-full text-[11px] text-gray-300 bg-gray-700/40 p-2 rounded hover:bg-gray-700 transition-colors cursor-pointer"
                    title="Click to view your full testimony"
                >
                    <div className="flex items-start justify-between">
                        <div className="pr-2">
                            <span className="font-semibold text-teal-400 underline">AI Context Summary:</span> {contextSummary || 'No summary yet.'}
                        </div>
                        <div className="flex items-center space-x-2 ml-2 flex-shrink-0" onClick={(e)=>e.stopPropagation()}>
                            {!isSummarySpeaking ? (
                                <button onClick={handleSpeakSummary} className="text-[11px] text-indigo-300 hover:text-white flex items-center space-x-1" title="Listen">
                                    <span className="underline">Listen</span>
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => { if (isSummaryPaused) { resumeSpeaking(); setIsSummaryPaused(false); } else { pauseSpeaking(); setIsSummaryPaused(true); } }}
                                        className="text-[11px] text-blue-300 hover:text-white flex items-center space-x-1"
                                        title={isSummaryPaused ? 'Resume' : 'Pause'}
                                    >
                                        <span className="underline">{isSummaryPaused ? 'Resume' : 'Pause'}</span>
                                    </button>
                                    <button onClick={() => { stopSpeaking(); setIsSummarySpeaking(false); setIsSummaryPaused(false); }} className="text-[11px] text-red-400 hover:text-white flex items-center space-x-1" title="Stop">
                                        <span className="underline">Stop</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isFullOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-gray-800 w-[640px] max-w-[90vw] max-h-[85vh] rounded-lg shadow-xl border border-gray-700 overflow-y-auto">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 sticky top-0 bg-gray-800">
                            <h4 className="text-sm font-semibold text-gray-200">My Full Testimony</h4>
                            <button onClick={() => setIsFullOpen(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        <div className="p-4 text-sm">
                             {isEditing ? (
                                <div className="flex flex-col h-full">
                                    <textarea
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                        className="w-full flex-grow bg-gray-700 text-sm p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y min-h-[300px]"
                                        placeholder="Edit your testimony..."
                                    />
                                    <div className="flex justify-end mt-2">
                                        <button
                                            onClick={handleSave}
                                            className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded text-sm font-medium"
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                             ) : (
                                <div onClick={handleEdit} className="cursor-pointer group relative min-h-[100px]">
                                    <p className="whitespace-pre-wrap text-gray-200">{text || '(empty)'}</p>
                                     <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <span className="text-xs text-gray-400 bg-gray-800 px-1 rounded border border-gray-600">Click to Edit</span>
                                    </div>
                                </div>
                             )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyTestimony;
