import React, { useEffect, useState } from 'react';
import DraggableResizableFrame from './DraggableResizableFrame';
import { Employee } from '../types';

interface EmployeeTestimonyModalProps {
    isOpen: boolean;
    onClose: () => void;
    employees: Employee[];
    onSave: (payload: { employeeId: string; employeeName: string; testimony: string; }) => void;
}

const EmployeeTestimonyModal: React.FC<EmployeeTestimonyModalProps> = ({ isOpen, onClose, employees, onSave }) => {
    const [employeeId, setEmployeeId] = useState<string>('');
    const [testimony, setTestimony] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            setTestimony('');
            setEmployeeId(employees[0]?.id || '');
        }
    }, [isOpen, employees]);

    if (!isOpen) return null;

    const handleSave = () => {
        const emp = employees.find(e => e.id === employeeId);
        if (!emp || !testimony.trim()) return;
        onSave({ employeeId, employeeName: emp.name, testimony: testimony.trim() });
    };

    return (
        <DraggableResizableFrame
            isOpen={isOpen}
            onClose={onClose}
            title="Add Employee Testimony"
            initialPosition={{ x: window.innerWidth - 580, y: 140 }}
            initialSize={{ width: 520, height: 'auto' }}
        >
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl h-full flex flex-col text-sm">
                <div className="space-y-3 flex-grow">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Employee Profile</label>
                        <select
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            className="w-full bg-gray-700 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            {employees.map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                        </select>
                        {employees.length === 0 && (
                            <p className="text-xs text-red-400 mt-1">No employee profiles available. Add an employee profile first.</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Testimony</label>
                        <textarea
                            value={testimony}
                            onChange={(e) => setTestimony(e.target.value)}
                            placeholder="Enter the employee's testimony"
                            rows={6}
                            className="w-full bg-gray-700 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                        />
                    </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors">Cancel</button>
                    <button onClick={handleSave} disabled={!employeeId || !testimony.trim()} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors disabled:bg-gray-500">Add Testimony</button>
                </div>
            </div>
        </DraggableResizableFrame>
    );
};

export default EmployeeTestimonyModal;


