import React from 'react';
import { Employee } from '../types';
import UserSearchIcon from './icons/UserSearchIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import DraggableResizableFrame from './DraggableResizableFrame';

interface EmployeeDetailModalProps {
    isOpen: boolean;
    employee: Employee | null;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

const StatusIndicator = ({ status }: { status: Employee['status'] }) => {
    switch (status) {
        case 'researching':
            return <div className="flex items-center text-xs text-teal-400"><SpinnerIcon className="h-3 w-3 mr-1" /> AI researching...</div>;
        case 'ready':
            return <div className="flex items-center text-xs text-green-400"><UserSearchIcon className="h-3 w-3 mr-1" /> AI Ready</div>;
        case 'error':
             return <div className="text-xs text-red-400">Error during research</div>;
        default:
            return <div className="text-xs text-gray-400">New</div>;
    }
}

const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({ isOpen, employee, onClose, onEdit, onDelete }) => {
    if (!isOpen || !employee) return null;

    return (
        <DraggableResizableFrame
            isOpen={isOpen}
            onClose={onClose}
            title={`Profile: ${employee.name}`}
            initialPosition={{ x: window.innerWidth - 500, y: 150 }}
            initialSize={{ width: 480, height: 'auto' }}
        >
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl h-full flex flex-col">
                <div className="flex justify-between items-start">
                    <h2 className="text-xl font-bold text-teal-400">{employee.name}</h2>
                    <StatusIndicator status={employee.status} />
                </div>

                <div className="mt-4 space-y-4 text-sm flex-grow overflow-y-auto pr-2">
                    <div>
                        <h3 className="font-semibold text-gray-400 text-xs uppercase mb-1">User-Provided Details</h3>
                        <p className="text-gray-200 bg-gray-700/50 p-2 rounded-md">{employee.details}</p>
                    </div>

                    {employee.aiEnhancedDetails && (
                        <div>
                            <h3 className="font-semibold text-gray-400 text-xs uppercase mb-1">AI-Enhanced Description</h3>
                            <p className="text-gray-300 italic bg-gray-700/50 p-2 rounded-md">{employee.aiEnhancedDetails}</p>
                        </div>
                    )}

                    {employee.referenceUrl && (
                        <div>
                            <h3 className="font-semibold text-gray-400 text-xs uppercase mb-1">Reference URL</h3>
                            <a href={employee.referenceUrl} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline break-all">{employee.referenceUrl}</a>
                        </div>
                    )}

                    {employee.referenceImage && (
                        <div>
                             <h3 className="font-semibold text-gray-400 text-xs uppercase mb-1">Reference Image</h3>
                             <img src={`data:${employee.referenceImage.mimeType};base64,${employee.referenceImage.base64}`} alt={`Reference for ${employee.name}`} className="max-h-40 rounded-md" />
                        </div>
                    )}
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors">Close</button>
                    <button onClick={onEdit} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors">Edit</button>
                    <button onClick={onDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-md transition-colors">Delete</button>
                </div>
            </div>
        </DraggableResizableFrame>
    );
};

export default EmployeeDetailModal;