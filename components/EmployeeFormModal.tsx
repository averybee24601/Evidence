import React, { useState, useEffect, useRef } from 'react';
import { Employee } from '../types';
import { fileToBase64 } from '../services/utils';
import DraggableResizableFrame from './DraggableResizableFrame';

interface EmployeeFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (employeeData: Omit<Employee, 'id' | 'status' | 'aiEnhancedDetails'>, id?: string) => void;
    employeeToEdit?: Employee | null;
}

const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({ isOpen, onClose, onSave, employeeToEdit }) => {
    const [name, setName] = useState('');
    const [details, setDetails] = useState('');
    const [referenceUrl, setReferenceUrl] = useState('');
    const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const isEditMode = !!employeeToEdit;

    useEffect(() => {
        if (isOpen) {
            if (isEditMode) {
                setName(employeeToEdit.name);
                setDetails(employeeToEdit.details);
                setReferenceUrl(employeeToEdit.referenceUrl || '');
                setReferenceImageFile(null); // Image cannot be edited, only added
            } else {
                // Reset form for "Add" mode
                setName('');
                setDetails('');
                setReferenceUrl('');
                setReferenceImageFile(null);
                if (imageInputRef.current) imageInputRef.current.value = '';
            }
        }
    }, [isOpen, employeeToEdit, isEditMode]);
    
    if (!isOpen) return null;

    const handleSave = async () => {
        if (name.trim() && details.trim()) {
            let imagePayload: { base64: string, mimeType: string } | undefined = undefined;
            if (referenceImageFile) {
                const base64 = await fileToBase64(referenceImageFile);
                imagePayload = { base64, mimeType: referenceImageFile.type };
            }

            onSave({
                name: name.trim(),
                details: details.trim(),
                referenceUrl: referenceUrl.trim() || undefined,
                referenceImage: imagePayload,
            }, employeeToEdit?.id);
        }
    };
    
    const title = isEditMode ? 'Edit Employee Profile' : 'Add Employee Profile';

    return (
        <DraggableResizableFrame
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            initialPosition={{ x: window.innerWidth - 550, y: 100 }}
            initialSize={{ width: 512, height: 'auto' }}
        >
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl h-full flex flex-col">
                <div className="space-y-3 text-sm flex-grow">
                    <input
                        type="text" value={name} onChange={(e) => setName(e.target.value)}
                        placeholder="* Employee Name"
                        className="w-full bg-gray-700 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <textarea
                        value={details} onChange={(e) => setDetails(e.target.value)}
                        placeholder="* Details (appearance, disability, etc.)"
                        className="w-full bg-gray-700 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                        rows={3}
                    />
                     <input
                        type="url" value={referenceUrl} onChange={(e) => setReferenceUrl(e.target.value)}
                        placeholder="Reference URL (optional, e.g., social media)"
                        className="w-full bg-gray-700 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                        disabled={isEditMode}
                        title={isEditMode ? "Reference URL cannot be changed after initial research." : ""}
                    />
                    <div className="flex items-center space-x-2">
                        <label className={`flex-grow text-xs p-2 rounded-md truncate ${isEditMode ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gray-700 text-gray-400 cursor-pointer hover:bg-gray-600'}`}>
                            {referenceImageFile ? referenceImageFile.name : 'Reference Image (optional)'}
                            <input
                                type="file"
                                accept="image/*"
                                ref={imageInputRef}
                                onChange={(e) => setReferenceImageFile(e.target.files?.[0] || null)}
                                className="hidden"
                                disabled={isEditMode}
                            />
                        </label>
                        {referenceImageFile && (
                            <button onClick={() => {setReferenceImageFile(null); if(imageInputRef.current) imageInputRef.current.value = '';}} className="text-red-400 text-xs">&times; clear</button>
                        )}
                    </div>
                     {isEditMode && <p className="text-xs text-gray-500 italic">Reference URL and Image cannot be changed after an employee has been researched. To use new reference material, please delete and re-add the profile.</p>}
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim() || !details.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 rounded-md transition-colors disabled:bg-gray-500"
                    >
                        {isEditMode ? 'Save Changes' : 'Add & Research'}
                    </button>
                </div>
            </div>
        </DraggableResizableFrame>
    );
};

export default EmployeeFormModal;