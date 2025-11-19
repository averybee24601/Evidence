import React from 'react';

interface DragDropOverlayProps {
    isVisible: boolean;
}

const DragDropOverlay: React.FC<DragDropOverlayProps> = ({ isVisible }) => {
    if (!isVisible) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none">
            <div className="border-4 border-dashed border-teal-400 rounded-2xl p-12 text-center">
                <h2 className="text-2xl font-bold text-teal-300">Drop Files Here</h2>
                <p className="text-gray-400">Release to upload your evidence</p>
            </div>
        </div>
    );
};

export default DragDropOverlay;
