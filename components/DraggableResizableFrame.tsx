import React, { useState, useRef, useEffect, useCallback } from 'react';
import WindowCloseIcon from './icons/WindowCloseIcon';
import WindowMinimizeIcon from './icons/WindowMinimizeIcon';

interface DraggableResizableFrameProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    initialSize?: { width: number | string; height: number | string };
    initialPosition?: { x: number; y: number };
    isResizable?: boolean;
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;

const parseSize = (val: string | number): number => {
    if (typeof val === 'number') return val;
    if (val === 'auto') return 400; // A sensible default
    return parseInt(val, 10) || 400;
};


const DraggableResizableFrame: React.FC<DraggableResizableFrameProps> = ({
    isOpen,
    onClose,
    title,
    children,
    initialSize: initialSizeProp = { width: 500, height: 400 },
    initialPosition = { x: 100, y: 100 },
    isResizable = true,
}) => {
    const [position, setPosition] = useState(initialPosition);
    const [size, setSize] = useState({
        width: parseSize(initialSizeProp.width),
        height: parseSize(initialSizeProp.height)
    });

    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    
    const dragInfo = useRef({
        startX: 0,
        startY: 0,
        startLeft: 0,
        startTop: 0,
        startWidth: 0,
        startHeight: 0,
        handle: ''
    });

    const [zIndex, setZIndex] = useState(10);
    const [isMinimized, setIsMinimized] = useState(false);

    const bringToFront = useCallback(() => {
        const allFrames = document.querySelectorAll('.draggable-frame');
        let maxZ = 9; // Start at 9 so the first window gets 10
        allFrames.forEach(frame => {
            const z = parseInt((frame as HTMLElement).style.zIndex) || 0;
            if (z > maxZ) maxZ = z;
        });
        setZIndex(maxZ + 1);
    }, []);
    
    useEffect(() => {
        if(isOpen) bringToFront();
    }, [isOpen, bringToFront]);

    const handleMouseDownDrag = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        bringToFront();
        setIsDragging(true);
        dragInfo.current = {
            ...dragInfo.current,
            startX: e.clientX,
            startY: e.clientY,
            startLeft: position.x,
            startTop: position.y,
        };
    };

    const handleMouseDownResize = (e: React.MouseEvent<HTMLDivElement>, handle: string) => {
        e.preventDefault();
        e.stopPropagation();
        bringToFront();
        setIsResizing(true);
        dragInfo.current = {
            startX: e.clientX,
            startY: e.clientY,
            startLeft: position.x,
            startTop: position.y,
            startWidth: size.width,
            startHeight: size.height,
            handle: handle
        };
    };


    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging) {
            const newX = dragInfo.current.startLeft + e.clientX - dragInfo.current.startX;
            const newY = dragInfo.current.startTop + e.clientY - dragInfo.current.startY;
            setPosition({ x: newX, y: newY });
        } else if (isResizing) {
            const { startX, startY, startLeft, startTop, startWidth, startHeight, handle } = dragInfo.current;
            
            let newWidth = startWidth;
            let newHeight = startHeight;
            let newX = startLeft;
            let newY = startTop;

            if (handle.includes('e')) newWidth = startWidth + (e.clientX - startX);
            if (handle.includes('w')) newWidth = startWidth - (e.clientX - startX);
            if (handle.includes('s')) newHeight = startHeight + (e.clientY - startY);
            if (handle.includes('n')) newHeight = startHeight - (e.clientY - startY);

            const constrainedWidth = Math.max(newWidth, MIN_WIDTH);
            const constrainedHeight = Math.max(newHeight, MIN_HEIGHT);

            if (handle.includes('w')) newX = startLeft + (startWidth - constrainedWidth);
            if (handle.includes('n')) newY = startTop + (startHeight - constrainedHeight);
            
            setPosition({ x: newX, y: newY });
            setSize({ width: constrainedWidth, height: constrainedHeight });
        }
    }, [isDragging, isResizing]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setIsResizing(false);
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);
    
    if (!isOpen) return null;
    
    const resizeHandles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

    return (
        <div
            className="draggable-frame fixed bg-gray-800 border border-gray-600 rounded-lg shadow-2xl flex flex-col overflow-hidden transition-opacity duration-200"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${size.width}px`,
                height: isMinimized ? 'auto' : `${size.height}px`,
                zIndex: zIndex,
            }}
            onMouseDown={bringToFront}
        >
            <header
                className="bg-gray-700 h-8 flex items-center justify-between px-2 cursor-move flex-shrink-0"
                onMouseDown={handleMouseDownDrag}
            >
                <span className="text-xs font-bold text-gray-300 truncate">{title}</span>
                <div className="flex items-center space-x-1">
                     <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 rounded-full hover:bg-gray-600 text-gray-400">
                        <WindowMinimizeIcon className="h-3 w-3" />
                    </button>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-red-500 text-gray-400 hover:text-white">
                        <WindowCloseIcon className="h-3 w-3" />
                    </button>
                </div>
            </header>
            <div className={`flex-grow overflow-auto ${isMinimized ? 'hidden' : ''}`}>
                {children}
            </div>

            {isResizable && !isMinimized && resizeHandles.map(handle => (
                <div
                    key={handle}
                    className={`absolute resize-handle-${handle}`}
                    onMouseDown={(e) => handleMouseDownResize(e, handle)}
                />
            ))}
        </div>
    );
};

export default DraggableResizableFrame;