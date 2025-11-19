import React, { useState } from 'react';
import { Employee, EmployeeTestimony } from '../types';
import EmployeeTestimonyModal from './EmployeeTestimonyModal';
import SaveIcon from './icons/SaveIcon';
import SpeakerWaveIcon from './icons/SpeakerWaveIcon';
import PauseIcon from './icons/PauseIcon';
import StopIcon from './icons/StopIcon';
import { getPreferredVoice, pauseSpeaking, resumeSpeaking, speakInChunks, stopSpeaking } from '../services/tts';
import UserPlusIcon from './icons/UserPlusIcon';

interface WitnessInputProps {
    witnesses: EmployeeTestimony[];
    employees?: Employee[];
    onAddWitness: (witness: { employeeId: string; employeeName: string; testimony: string; }) => void;
    onDeleteWitness: (id: string) => void;
    onUpdateWitness?: (id: string, updates: Partial<EmployeeTestimony>) => void;
    onSaveWitness?: (id: string) => void;
}

const WitnessInput: React.FC<WitnessInputProps> = ({ witnesses, employees = [], onAddWitness, onDeleteWitness, onUpdateWitness, onSaveWitness }) => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [savedId, setSavedId] = useState<string | null>(null);
    const [speakingId, setSpeakingId] = useState<string | null>(null);
    const [paused, setPaused] = useState(false);
    const [speakingSummaryId, setSpeakingSummaryId] = useState<string | null>(null);
    const [pausedSummary, setPausedSummary] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    const handleSave = (p: { employeeId: string; employeeName: string; testimony: string; }) => {
        onAddWitness(p);
        setIsFormOpen(false);
    };

    return (
        <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-400">Employee Testimony</h3>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="text-xs text-gray-300 hover:text-white px-2 py-1 rounded bg-gray-700/50"
                        title={collapsed ? 'Show' : 'Hide'}
                    >
                        {collapsed ? 'Show' : 'Hide'}
                    </button>
                </div>
            </div>
            {!collapsed && (
            <div className="space-y-3">
                {witnesses.map(w => (
                    <div key={w.id} className="bg-gray-700/50 p-2 rounded-md">
                        <div className="flex items-center justify-between mb-1">
                            <p className="font-bold text-teal-300 truncate">{w.employeeName}</p>
                            <div className="flex items-center space-x-2">
                                {speakingId !== w.id ? (
                                    <button
                                        onClick={async () => {
                                            if (speechSynthesis.speaking) stopSpeaking();
                                            const voice = await getPreferredVoice();
                                            const text = w.testimony?.trim() || 'No testimony available.';
                                            if (!text) return;
                                            speakInChunks(text, {
                                                voice,
                                                rate: 1.0,
                                                pitch: 1.0,
                                                onstart: () => { setSpeakingId(w.id); setPaused(false); },
                                                onend: () => { setSpeakingId(null); setPaused(false); },
                                            });
                                        }}
                                        className="text-xs text-indigo-300 hover:text-white flex items-center space-x-1"
                                        title="Listen"
                                    >
                                        <SpeakerWaveIcon className="h-3 w-3" />
                                        <span>Listen</span>
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => { if (paused) { resumeSpeaking(); setPaused(false); } else { pauseSpeaking(); setPaused(true); } }}
                                            className="text-xs text-blue-300 hover:text-white flex items-center space-x-1"
                                            title={paused ? 'Resume' : 'Pause'}
                                        >
                                            {paused ? <SpeakerWaveIcon className="h-3 w-3" /> : <PauseIcon className="h-3 w-3" />}
                                            <span>{paused ? 'Resume' : 'Pause'}</span>
                                        </button>
                                        <button
                                            onClick={() => { stopSpeaking(); setSpeakingId(null); setPaused(false); }}
                                            className="text-xs text-red-400 hover:text-white flex items-center space-x-1"
                                            title="Stop"
                                        >
                                            <StopIcon className="h-3 w-3" />
                                            <span>Stop</span>
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => { 
                                        setSavedId(w.id); 
                                        onSaveWitness && onSaveWitness(w.id); 
                                        onUpdateWitness && onUpdateWitness(w.id, { isSaved: true });
                                        setTimeout(() => setSavedId(null), 1200); 
                                    }}
                                    className="text-xs text-gray-300 hover:text-white flex items-center space-x-1"
                                    title="Save testimony"
                                >
                                    <SaveIcon className="h-3 w-3" />
                                    <span>Save</span>
                                </button>
                                <button onClick={() => onDeleteWitness(w.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                            </div>
                        </div>
                        {!w.isSaved ? (
                            <textarea
                                className="w-full bg-gray-700 text-xs p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                                rows={4}
                                value={w.testimony}
                                onChange={(e) => onUpdateWitness && onUpdateWitness(w.id, { testimony: e.target.value })}
                                placeholder={`Enter ${w.employeeName}'s testimony here`}
                            />
                        ) : (
                            <div className="w-full bg-gray-700/50 text-xs p-2 rounded-md max-h-36 overflow-y-auto">
                                <p className="whitespace-pre-wrap text-gray-200">{w.testimony || '(empty)'}</p>
                            </div>
                        )}
                        {savedId === w.id && (
                            <p className="text-[10px] text-green-400 mt-1">Saved</p>
                        )}
                        {w.contextSummary !== undefined && (
                            <div
                                onClick={() => {
                                    const modalId = `emp-testimony-full-${w.id}`;
                                    const el = document.getElementById(modalId);
                                    if (el) el.style.display = 'flex';
                                }}
                                className="mt-2 text-left w-full text-[11px] text-gray-300 bg-gray-700/40 p-2 rounded hover:bg-gray-700 transition-colors cursor-pointer"
                                title="Click to view the full testimony"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="pr-2">
                                        <span className="font-semibold text-teal-400 underline">AI Context Summary:</span> {w.contextSummary || 'No summary yet.'}
                                    </div>
                                    <div className="flex items-center space-x-2 ml-2 flex-shrink-0" onClick={(e)=>e.stopPropagation()}>
                                        {speakingSummaryId !== w.id ? (
                                            <button
                                                onClick={async () => {
                                                    if (!w.contextSummary) return;
                                                    if (speechSynthesis.speaking) stopSpeaking();
                                                    const voice = await getPreferredVoice();
                                                    speakInChunks(w.contextSummary, {
                                                        voice,
                                                        rate: 1.0,
                                                        pitch: 1.0,
                                                        onstart: () => { setSpeakingSummaryId(w.id); setPausedSummary(false); },
                                                        onend: () => { setSpeakingSummaryId(null); setPausedSummary(false); },
                                                    });
                                                }}
                                                className="text-[11px] text-indigo-300 hover:text-white flex items-center space-x-1"
                                                title="Listen"
                                            >
                                                <span className="underline">Listen</span>
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => { if (pausedSummary) { resumeSpeaking(); setPausedSummary(false); } else { pauseSpeaking(); setPausedSummary(true); } }}
                                                    className="text-[11px] text-blue-300 hover:text-white flex items-center space-x-1"
                                                    title={pausedSummary ? 'Resume' : 'Pause'}
                                                >
                                                    <span className="underline">{pausedSummary ? 'Resume' : 'Pause'}</span>
                                                </button>
                                                <button
                                                    onClick={() => { stopSpeaking(); setSpeakingSummaryId(null); setPausedSummary(false); }}
                                                    className="text-[11px] text-red-400 hover:text-white flex items-center space-x-1"
                                                    title="Stop"
                                                >
                                                    <span className="underline">Stop</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div id={`emp-testimony-full-${w.id}`} style={{display:'none'}} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                            <div className="bg-gray-800 w-[640px] max-w-[90vw] max-h-[85vh] rounded-lg shadow-xl border border-gray-700 overflow-y-auto">
                                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 sticky top-0 bg-gray-800">
                                    <h4 className="text-sm font-semibold text-gray-200">{w.employeeName} — Full Testimony</h4>
                                    <button onClick={(e)=>{(e.currentTarget.parentElement!.parentElement!.parentElement as HTMLElement).style.display='none';}} className="text-gray-400 hover:text-white">✕</button>
                                </div>
                                <div className="p-4 text-sm">
                                    <p className="whitespace-pre-wrap text-gray-200">{w.testimony || '(empty)'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {witnesses.length === 0 && (
                    <p className="text-xs text-gray-500">No employee testimonies added yet.</p>
                )}
            </div>
            )}
            <div className="flex justify-end mt-2">
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="flex items-center space-x-1 bg-indigo-600/60 hover:bg-indigo-600 text-white px-2 py-1 rounded text-xs"
                    title="Add Employee Testimony"
                >
                    <UserPlusIcon className="h-3 w-3" />
                    <span>Add testimony</span>
                </button>
            </div>

            <EmployeeTestimonyModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} employees={employees} onSave={handleSave} />
        </div>
    );
};

export default WitnessInput;


