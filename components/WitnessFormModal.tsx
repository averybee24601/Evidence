import React, { useEffect, useRef, useState } from 'react';
import DraggableResizableFrame from './DraggableResizableFrame';
import { WitnessTestimony } from '../types';
import { fileToBase64 } from '../services/utils';

interface WitnessFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (witness: Omit<WitnessTestimony, 'id'>, id?: string) => void;
    witnessToEdit?: WitnessTestimony | null;
}

const WitnessFormModal: React.FC<WitnessFormModalProps> = ({ isOpen, onClose, onSave, witnessToEdit }) => {
    const [name, setName] = useState('Juliana');
    const [role, setRole] = useState('Former Employee');
    const [testimony, setTestimony] = useState('');
    const [referenceUrl, setReferenceUrl] = useState('');
    const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const isEditMode = !!witnessToEdit;

    useEffect(() => {
        if (isOpen) {
            if (isEditMode) {
                setName(witnessToEdit!.name);
                setRole(witnessToEdit!.role);
                setTestimony(witnessToEdit!.testimony);
                setReferenceUrl(witnessToEdit!.referenceUrl || '');
                setReferenceImageFile(null);
            } else {
                setName('Juliana');
                setRole('Former Employee');
                setTestimony('');
                setReferenceUrl('');
                setReferenceImageFile(null);
                if (imageInputRef.current) imageInputRef.current.value = '';
            }
        }
    }, [isOpen, isEditMode, witnessToEdit]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!name.trim() || !testimony.trim()) return;
        let imagePayload: { base64: string; mimeType: string } | undefined = undefined;
        if (referenceImageFile) {
            const base64 = await fileToBase64(referenceImageFile);
            imagePayload = { base64, mimeType: referenceImageFile.type };
        }
        onSave({
            name: name.trim(),
            role: role.trim() || 'Former Employee',
            testimony: testimony.trim(),
            referenceUrl: referenceUrl.trim() || undefined,
            referenceImage: imagePayload,
        }, witnessToEdit?.id);
    };

    return (
        <DraggableResizableFrame
            isOpen={isOpen}
            onClose={onClose}
            title={isEditMode ? 'Edit Witness Testimony' : 'Add Witness Testimony'}
            initialPosition={{ x: window.innerWidth - 600, y: 140 }}
            initialSize={{ width: 560, height: 'auto' }}
        >
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl h-full flex flex-col text-sm">
                <div className="space-y-3 flex-grow">
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="* Name (e.g., Juliana)"
                            className="w-full bg-gray-700 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <input
                            type="text"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            placeholder="Role (e.g., Former Employee)"
                            className="w-full bg-gray-700 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                    <textarea
                        value={testimony}
                        onChange={(e) => setTestimony(e.target.value)}
                        placeholder="* Witness testimony"
                        className="w-full bg-gray-700 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                        rows={5}
                    />
                    <input
                        type="url"
                        value={referenceUrl}
                        onChange={(e) => setReferenceUrl(e.target.value)}
                        placeholder="Reference URL (optional)"
                        className="w-full bg-gray-700 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <div className="flex items-center space-x-2">
                        <label className="flex-grow text-xs p-2 rounded-md truncate bg-gray-700 text-gray-400 cursor-pointer hover:bg-gray-600">
                            {referenceImageFile ? referenceImageFile.name : 'Reference Image (optional)'}
                            <input
                                type="file"
                                accept="image/*"
                                ref={imageInputRef}
                                onChange={(e) => setReferenceImageFile(e.target.files?.[0] || null)}
                                className="hidden"
                            />
                        </label>
                        {referenceImageFile && (
                            <button onClick={() => { setReferenceImageFile(null); if (imageInputRef.current) imageInputRef.current.value = ''; }} className="text-red-400 text-xs">&times; clear</button>
                        )}
                    </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors">Cancel</button>
                    <button onClick={handleSave} disabled={!name.trim() || !testimony.trim()} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 rounded-md transition-colors disabled:bg-gray-500">
                        {isEditMode ? 'Save Changes' : 'Add Testimony'}
                    </button>
                </div>
            </div>
        </DraggableResizableFrame>
    );
};

export default WitnessFormModal;


