import React, { useState } from 'react';
import { EvidenceFile, Employee } from '../types';
import ReportIcon from './icons/ReportIcon';
import XCircleIcon from './icons/XCircleIcon';

interface ManualRecognitionPanelProps {
    file: EvidenceFile;
    allEmployees: Employee[];
    onConfirm: (fileId: string, manualTags: string[]) => void;
}

const ManualRecognitionPanel: React.FC<ManualRecognitionPanelProps> = ({ file, allEmployees, onConfirm }) => {
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [selectValue, setSelectValue] = useState<string>('');
    
    const availableEmployees = allEmployees.filter(emp => !selectedEmployees.includes(emp.name));

    const handleAddEmployee = () => {
        if (selectValue && !selectedEmployees.includes(selectValue)) {
            setSelectedEmployees(prev => [...prev, selectValue]);
        }
        setSelectValue('');
    };

    const handleRemoveEmployee = (nameToRemove: string) => {
        setSelectedEmployees(prev => prev.filter(name => name !== nameToRemove));
    };

    const handleFinalize = () => {
        onConfirm(file.id, selectedEmployees);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="pb-3 border-b border-gray-700 mb-2">
                 <h3 className="text-lg font-bold text-teal-400">Manual Recognition</h3>
                 <p className="text-xs text-gray-400">AI analysis for "{file.name}" did not detect any registered employees. Please select who is present in this file.</p>
            </div>
            <div className="flex-grow overflow-y-auto pr-2 space-y-3 py-2">
                <div>
                    <label htmlFor="employee-select" className="block text-sm font-medium text-gray-300 mb-1">Select an Employee</label>
                    <div className="flex space-x-2">
                        <select
                            id="employee-select"
                            value={selectValue}
                            onChange={(e) => setSelectValue(e.target.value)}
                            className="w-full bg-gray-700 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                            disabled={availableEmployees.length === 0}
                        >
                            <option value="">-- Choose an employee --</option>
                            {availableEmployees.map(emp => (
                                <option key={emp.id} value={emp.name}>{emp.name}</option>
                            ))}
                        </select>
                        <button 
                            onClick={handleAddEmployee}
                            disabled={!selectValue}
                            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 rounded-md transition-colors disabled:bg-gray-600"
                        >
                            Add
                        </button>
                    </div>
                </div>

                {selectedEmployees.length > 0 && (
                    <div>
                         <h4 className="text-sm font-medium text-gray-300 mb-2">Selected for Re-analysis:</h4>
                         <ul className="space-y-2">
                            {selectedEmployees.map(name => (
                                <li key={name} className="flex items-center justify-between bg-gray-700/50 p-2 rounded-md">
                                    <span className="text-sm text-gray-200">{name}</span>
                                    <button onClick={() => handleRemoveEmployee(name)} title="Remove">
                                        <XCircleIcon className="h-5 w-5 text-gray-400 hover:text-red-400" />
                                    </button>
                                </li>
                            ))}
                         </ul>
                    </div>
                )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700 flex flex-col space-y-2">
                <button 
                    onClick={handleFinalize}
                    disabled={selectedEmployees.length === 0}
                    className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-md transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    <ReportIcon className="h-5 w-5" />
                    <span>Re-analyze with Selected Profiles</span>
                </button>
                <button
                    onClick={() => onConfirm(file.id, [])}
                    className="w-full text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md py-2 transition-colors"
                    title="Continue without manual tags"
                >
                    Skip (Continue without tags)
                </button>
            </div>
        </div>
    );
};

export default ManualRecognitionPanel;
