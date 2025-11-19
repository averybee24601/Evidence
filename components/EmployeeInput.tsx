import React, { useState } from 'react';
import { Employee } from '../types';
import SpinnerIcon from './icons/SpinnerIcon';
import UserSearchIcon from './icons/UserSearchIcon';
import EmployeeFormModal from './EmployeeFormModal';
import EmployeeDetailModal from './EmployeeDetailModal';
import UserPlusIcon from './icons/UserPlusIcon';


interface EmployeeInputProps {
    employees: Employee[];
    onAddEmployee: (employeeData: Omit<Employee, 'id' | 'status' | 'aiEnhancedDetails'>) => void;
    onUpdateEmployee: (id: string, employeeData: { name: string; details: string; }) => void;
    onSetEmployees: (employees: Employee[]) => void;
    onDeleteEmployee: (id: string) => void;
}

const StatusIndicator = ({ status }: { status: Employee['status'] }) => {
    switch (status) {
        case 'researching':
            return <div className="flex items-center text-xs text-teal-400"><SpinnerIcon className="h-3 w-3 mr-1" /> researching...</div>;
        case 'ready':
            return <div className="flex items-center text-xs text-green-400"><UserSearchIcon className="h-3 w-3 mr-1" /> AI Ready</div>;
        case 'error':
             return <div className="text-xs text-red-400">Error</div>;
        default:
            return <div className="text-xs text-gray-400">New</div>;
    }
}

const EmployeeInput: React.FC<EmployeeInputProps> = ({ employees, onAddEmployee, onUpdateEmployee, onSetEmployees, onDeleteEmployee }) => {
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

    const MAX_EMPLOYEES = 14;
    const canAddMore = employees.length < MAX_EMPLOYEES;
    const [collapsed, setCollapsed] = useState(false);

    const handleOpenAddModal = () => {
        setSelectedEmployee(null);
        setIsFormModalOpen(true);
    };

    const handleOpenDetailModal = (employee: Employee) => {
        setSelectedEmployee(employee);
        setIsDetailModalOpen(true);
    };

    const handleOpenEditModal = (employee: Employee) => {
        setSelectedEmployee(employee);
        setIsDetailModalOpen(false);
        setIsFormModalOpen(true);
    };

    const handleDeleteEmployee = (id: string) => {
        if (window.confirm('Are you sure you want to permanently delete this employee profile from disk?')) {
            onDeleteEmployee(id);
            setIsDetailModalOpen(false);
            setSelectedEmployee(null);
        }
    };

    const handleSave = (employeeData: Omit<Employee, 'id' | 'status' | 'aiEnhancedDetails'>, id?: string) => {
        if (id) {
            onUpdateEmployee(id, { name: employeeData.name, details: employeeData.details });
        } else {
            onAddEmployee(employeeData);
        }
        setIsFormModalOpen(false);
    };

    return (
        <div>
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Employee Profiles (Max {MAX_EMPLOYEES})</h3>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="text-xs text-gray-300 hover:text-white"
                    title={collapsed ? 'Expand' : 'Collapse'}
                >
                    {collapsed ? 'Show' : 'Hide'}
                </button>
            </div>
            
            {!collapsed && (
                <div className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-1">
                     {employees.map(emp => (
                        <div 
                            key={emp.id} 
                            className="bg-gray-700/50 p-2 rounded-md cursor-pointer hover:bg-gray-700 transition-colors"
                            onClick={() => handleOpenDetailModal(emp)}
                        >
                            <div className="flex justify-between items-center">
                                <p className="font-bold text-teal-300 truncate">{emp.name}</p>
                                <StatusIndicator status={emp.status} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {canAddMore ? (
                <button
                    onClick={handleOpenAddModal}
                    className="w-full mt-2 flex items-center justify-center space-x-2 bg-teal-600/50 hover:bg-teal-600 border border-teal-600 text-teal-200 hover:text-white font-bold py-1.5 rounded-md transition-colors"
                >
                    <UserPlusIcon className="h-4 w-4" />
                    <span>Add Employee Profile</span>
                </button>
            ) : (
                <p className="text-xs text-gray-500 text-center bg-gray-700/50 p-2 rounded-md mt-2">
                    You have reached the maximum of {MAX_EMPLOYEES} employees.
                </p>
            )}

            <EmployeeFormModal
                isOpen={isFormModalOpen}
                onClose={() => setIsFormModalOpen(false)}
                onSave={handleSave}
                employeeToEdit={selectedEmployee}
            />

            
            <EmployeeDetailModal
                isOpen={isDetailModalOpen}
                employee={selectedEmployee}
                onClose={() => setIsDetailModalOpen(false)}
                onEdit={() => { if (selectedEmployee) handleOpenEditModal(selectedEmployee); }}
                onDelete={() => { if (selectedEmployee) handleDeleteEmployee(selectedEmployee.id); }}
            />
        </div>
    );
};

export default EmployeeInput;
