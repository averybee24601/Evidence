import React, { useState, useEffect, useRef } from 'react';
import SpeakerWaveIcon from './icons/SpeakerWaveIcon';
import PauseIcon from './icons/PauseIcon';
import StopIcon from './icons/StopIcon';
import { getPreferredVoice, pauseSpeaking, resumeSpeaking, speakInChunks, stopSpeaking } from '../services/tts';

const contentSections = [
    { type: 'h2', id: 'heading-1', text: 'Welcome to Your AI Evidence Companion' },
    { type: 'p', id: 'p-1', text: 'This tool is designed to be your private, intelligent assistant for reviewing and understanding sensitive multimedia evidence. It helps you organize your thoughts, identify key moments, and build a clear picture of events, all in a secure and objective way.' },
    { type: 'h3', id: 'heading-2', text: 'How It Works: A Step-by-Step Guide' },
    { type: 'h4', id: 'heading-3', text: 'Step 1: Tell Your Story (My Testimony)' },
    { type: 'p', id: 'p-2', text: 'In the top-left corner, you\'ll find the "My Testimony" box. Think of this as giving the AI your side of the story. Write down what happened, who was involved, and what your concerns are. When you save it, the AI creates a short summary to confirm it understands. This context is crucial—it helps the AI know what to look for when it analyzes your evidence.' },
    { type: 'h4', id: 'heading-4', text: 'Step 2: Create Employee Profiles' },
    { type: 'p', id: 'p-3', text: 'Before analyzing evidence, it\'s helpful to tell the AI who to look for. Under the "Employee Profiles" section, you can add profiles for individuals involved.' },
    { type: 'li', id: 'li-1', text: 'Why is this important? Profiles help the AI accurately identify people in photos, videos, and transcripts.' },
    { type: 'li', id: 'li-2', text: 'What should I include? Add their name and a detailed description, including physical appearance, mannerisms, or any relevant disabilities. The more detail, the better. You can also add a reference photo or a link to a public profile (like LinkedIn) to help the AI.' },
    { type: 'li', id: 'li-3', text: 'AI-Enhanced Description: After you add a profile, the AI will research the information you provided and add its own detailed, objective description to improve its recognition accuracy.' },
    { type: 'h4', id: 'heading-5', text: 'Step 3: Upload Your Evidence' },
    { type: 'p', id: 'p-4', text: 'In the main "Evidence Chat" view, you can drag and drop files (images, videos, audio, or text documents) into the upload zone at the bottom. Once uploaded, they will appear in the "Unanalyzed Files" bar at the top of the chat panel, ready for analysis.' },
    { type: 'h4', id: 'heading-6', text: 'Step 4: Start the Analysis' },
    { type: 'p', id: 'p-5', text: 'Click "Analyze" on any file. A window will pop up asking for the location of the event and any special instructions (e.g., "focus on the conversation at the 5-minute mark"). Once you start, the AI gets to work:' },
    { type: 'li', id: 'li-4', text: 'It watches videos frame-by-frame, listens to audio, and reads documents.' },
    { type: 'li', id: 'li-5', text: 'It identifies who is present based on the profiles you created.' },
    { type: 'li', id: 'li-6', text: 'It flags key moments with precise timestamps (e.g., [00:02:15]).' },
    { type: 'li', id: 'li-7', text: 'It analyzes emotional tones, transcribes conversations, and looks for patterns or potential policy violations.' },
    { type: 'h4', id: 'heading-7', text: 'Step 5: Review the Results' },
    { type: 'p', id: 'p-6', text: 'After the initial analysis, you play a key role.' },
    { type: 'li', id: 'li-8', text: 'Recognition Review: The app will show you which employees the AI thinks it found. You can confirm if the AI was correct or mark any mismatches. This makes the final report more accurate.' },
    { type: 'li', id: 'li-9', text: 'Manual Tagging: If the AI doesn\'t find anyone, it will ask for your help. You can manually tell it who is in the file, and it will re-analyze the evidence with that new information.' },
    { type: 'li', id: 'li-10', text: 'The Final Report: Once confirmed, a detailed report appears in the right-hand panel, breaking down everything the AI found.' },
    { type: 'h3', id: 'heading-8', text: 'Understanding Your Workspace' },
    { type: 'li', id: 'li-11', text: 'Evidence Locker (Left Panel): This is where all your analyzed files are stored. You can see their status (analyzed, error, etc.), select a file to view its report, delete it, or download the original file and its report as a package.' },
    { type: 'li', id: 'li-12', text: 'Case Dashboard (Top Tab): Once you have analyzed evidence, this tab becomes active. It generates an interactive "Relationship Map" that visually shows who interacts with whom, how often, and whether those interactions are generally positive, negative, or neutral.' },
    { type: 'li', id: 'li-13', text: 'Legal Q&A (Top Tab): This is a safe space to ask general questions about legal topics. The AI will use web search to provide informative answers, but it will always remind you that it is not a lawyer and cannot give legal advice. You can check a box to let it use your entire case file for context in its answers.' },
    { type: 'li', id: 'li-14', text: 'Analysis Report (Right Panel): When you select a file from the Evidence Locker, its full report appears here. You can see the summary, severity score, a list of all key observations, a full transcript, and more. Use the details dropdowns to expand sections.' },
    { type: 'h3', id: 'heading-9', text: 'Your Privacy and Control' },
    { type: 'p', id: 'p-7', text: 'This is the most important part: All your data—your testimony, employee profiles, and uploaded files—is stored only on your computer, in your web browser. Nothing is uploaded to a central server or seen by anyone else. You are in complete control. If you clear your browser\'s data or delete a file from the app, it is gone permanently.' },
    { type: 'h3', id: 'heading-10', text: 'Why This Tool Matters' },
    { type: 'p', id: 'p-8', text: 'For individuals with disabilities, their caregivers, or anyone facing workplace harassment or discrimination, documenting events can be overwhelming and emotionally taxing. This tool helps by:' },
    { type: 'li', id: 'li-15', text: 'Providing Objectivity: The AI provides a neutral, factual analysis, which can help separate emotion from evidence.' },
    { type: 'li', id: 'li-16', text: 'Organizing Chaos: It turns hours of media into a structured, time-stamped report, making it easier to see patterns.' },
    { type: 'li', id: 'li-17', text: 'Empowering Users: It gives you a powerful tool to build a clear, organized case, putting you in a stronger position to advocate for yourself or others.' },
    { type: 'p', id: 'p-9', text: 'Thank you for using the AI Evidence Companion. We hope it provides the clarity and support you need.' },
];

const AboutPanel: React.FC = () => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [speakingSectionId, setSpeakingSectionId] = useState<string | null>(null);

    // Cleanup speech synthesis on component unmount
    useEffect(() => {
        return () => {
            if (speechSynthesis.speaking) {
                speechSynthesis.cancel();
            }
        };
    }, []);

    const handleSpeak = async () => {
        if (!('speechSynthesis' in window)) {
            alert('Sorry, your browser does not support text-to-speech.');
            return;
        }
        if (speechSynthesis.speaking) return;

        const voice = await getPreferredVoice();
        const fullText = contentSections.map(s => s.text).join(' ');
        speakInChunks(fullText, {
            voice,
            rate: 1.0,
            pitch: 1.0,
            onstart: () => { setIsPaused(false); setIsSpeaking(true); setSpeakingSectionId(null); },
            onend: () => { setIsSpeaking(false); setSpeakingSectionId(null); },
        });
    };

    const handleStop = () => {
        stopSpeaking();
        setIsSpeaking(false);
        setIsPaused(false);
        setSpeakingSectionId(null);
    };

    const handlePauseResume = () => {
        if (isPaused) {
            resumeSpeaking();
            setIsPaused(false);
        } else {
            pauseSpeaking();
            setIsPaused(true);
        }
    };
    
    const renderContent = () => {
        let listItems: typeof contentSections = [];
        const elements: React.ReactNode[] = [];

        const flushList = () => {
            if (listItems.length > 0) {
                elements.push(
                    <ul key={`ul-${elements.length}`} className="list-disc list-inside">
                        {listItems.map(item => (
                             <li key={item.id} id={item.id} className={`${speakingSectionId === item.id ? 'speaking-highlight' : ''} p-2 -ml-2 rounded`}>{item.text}</li>
                        ))}
                    </ul>
                );
                listItems = [];
            }
        };

        contentSections.forEach(section => {
            const className = `${speakingSectionId === section.id ? 'speaking-highlight' : ''} p-2 -ml-2 rounded`;
            if (section.type === 'li') {
                listItems.push(section);
            } else {
                flushList();
                // FIX: Use React.createElement for dynamic tag names to resolve JSX compilation errors.
                elements.push(React.createElement(section.type, {
                    key: section.id,
                    id: section.id,
                    className: className
                }, section.text));
            }
        });
        flushList(); // Make sure the last list is rendered
        return elements;
    };

    return (
        <div className="bg-gray-900 h-full flex flex-col">
            <div className="flex-shrink-0 bg-gray-800 p-4 border-b border-gray-700 sticky top-0 z-10">
                <h2 className="text-xl font-bold text-teal-400">About AI Evidence Companion</h2>
                <div className="mt-3 flex items-center space-x-3">
                    {!isSpeaking ? (
                         <button onClick={handleSpeak} className="flex items-center space-x-2 bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-4 rounded-md transition-colors">
                             <SpeakerWaveIcon className="h-5 w-5" />
                            <span>Read Aloud</span>
                        </button>
                    ) : (
                        <>
                            <button onClick={handlePauseResume} className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-md transition-colors w-32 justify-center">
                                {isPaused ? <SpeakerWaveIcon className="h-5 w-5" /> : <PauseIcon className="h-5 w-5" />}
                                <span>{isPaused ? 'Resume' : 'Pause'}</span>
                            </button>
                             <button onClick={handleStop} className="flex items-center space-x-2 bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-md transition-colors">
                                 <StopIcon className="h-5 w-5" />
                                <span>Stop</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
            <div className="flex-grow overflow-y-auto">
                 <div className="prose prose-sm prose-invert max-w-4xl mx-auto p-8">
                     {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default AboutPanel;
