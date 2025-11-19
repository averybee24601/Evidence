import React from 'react';
import DraggableResizableFrame from './DraggableResizableFrame';

interface MicrophoneRecorderProps {
    isRecording: boolean;
    onStopRecording: () => void;
}

const MicrophoneRecorder: React.FC<MicrophoneRecorderProps> = ({ isRecording, onStopRecording }) => {
    if (!isRecording) return null;

    return (
        <DraggableResizableFrame
            isOpen={isRecording}
            onClose={onStopRecording}
            title="Recording Audio"
            initialPosition={{ x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 125 }}
            initialSize={{ width: 300, height: 250 }}
            isResizable={false}
        >
            <div className="bg-gray-800 p-8 rounded-lg flex flex-col items-center justify-center h-full">
                <h3 className="text-lg font-medium mb-4 text-white">Recording...</h3>
                <div className="relative h-16 w-16">
                    <div className="absolute inset-0 bg-teal-500 rounded-full animate-ping"></div>
                    <div className="relative h-16 w-16 bg-teal-600 rounded-full flex items-center justify-center">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    </div>
                </div>
                <button
                    onClick={onStopRecording}
                    className="mt-6 bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                    Stop Recording
                </button>
            </div>
        </DraggableResizableFrame>
    );
};

export default MicrophoneRecorder;