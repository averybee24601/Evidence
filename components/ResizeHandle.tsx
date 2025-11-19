import React from 'react';

interface ResizeHandleProps {
  onMouseDown: (event: React.MouseEvent) => void;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ onMouseDown }) => {
  return (
    <div
      onMouseDown={onMouseDown}
      className="flex-shrink-0 w-1.5 cursor-ew-resize bg-gray-700 hover:bg-teal-500 active:bg-teal-400 transition-colors duration-200"
    />
  );
};

export default ResizeHandle;
