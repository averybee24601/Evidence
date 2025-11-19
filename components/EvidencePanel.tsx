

import React from 'react';
import { EvidenceFile, Employee, EvidenceCase } from '../types';
import EvidenceItem from './EvidenceItem';
import CaseItem from './CaseItem';
import EmployeeInput from './EmployeeInput';
import WitnessInput from './WitnessInput';
import MyTestimony from './MyTestimony';

interface EvidencePanelProps {
    files: EvidenceFile[];
    cases?: EvidenceCase[];
    selectedFileId: string | null;
    onSelectFile: (id: string | null) => void;
    onSelectCase?: (id: string) => void;
    onAppendCase?: (id: string) => void;
    onDeleteCase?: (id: string) => void;
    onDeleteFile: (id: string) => void;
    onRenameFile: (id: string, newName: string) => void;
    employees: Employee[];
    onAddEmployee: (employeeData: Omit<Employee, 'id' | 'status' | 'aiEnhancedDetails'>) => void;
    onUpdateEmployee: (id: string, updates: { name: string, details: string }) => void;
    onSetEmployees: (employees: Employee[]) => void;
    onDeleteEmployee: (id: string) => void;
    witnesses?: any[];
    onAddWitness?: (witness: any) => void;
    onDeleteWitness?: (id: string) => void;
    onUpdateWitness?: (id: string, updates: any) => void;
    onSaveWitness?: (id: string) => void;
    testimony: string;
    contextSummary: string;
    onSaveTestimony: (testimony: string) => void;
}

const EvidencePanel: React.FC<EvidencePanelProps> = ({
    files,
    cases = [],
    selectedFileId,
    onSelectFile,
    onSelectCase,
    onAppendCase,
    onDeleteCase,
    onDeleteFile,
    onRenameFile,
    employees,
    onAddEmployee,
    onUpdateEmployee,
    onSetEmployees,
    onDeleteEmployee,
    witnesses = [],
    onAddWitness,
    onDeleteWitness,
    onUpdateWitness,
    onSaveWitness,
    testimony,
    contextSummary,
    onSaveTestimony,
}) => {
    const [activeTab, setActiveTab] = React.useState<'pending' | 'review' | 'completed' | 'unified' | 'errors'>('completed');
    const [testimonyCollapsed, setTestimonyCollapsed] = React.useState(true);
    const [witnessCollapsed, setWitnessCollapsed] = React.useState(true);
    const [employeeCollapsed, setEmployeeCollapsed] = React.useState(true);

    // Hide any files that belong to a unified case to avoid duplicates/clutter
    const fileIdsInCases = new Set<string>(cases.flatMap(c => c.fileIds || []));

    const isVisibleFile = (f: EvidenceFile) => !fileIdsInCases.has(f.id);

    const pendingFiles = files.filter(f => (f.status === 'new' || f.status === 'analyzing') && isVisibleFile(f));
    const reviewFiles = files.filter(f => (f.status === 'analyzed-pending-review' || f.status === 'analyzed-needs-manual-tagging') && isVisibleFile(f));
    const completedFiles = files.filter(f => f.status === 'analyzed' && isVisibleFile(f));
    const errorFiles = files.filter(f => f.status === 'error' && isVisibleFile(f));
    const unifiedCases = cases;

    const renderSection = (title: string, sectionFiles: EvidenceFile[], emptyMessage: string) => (
        <section>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4 first:mt-0">{title}</h3>
            {sectionFiles.length === 0 ? (
                <p className="text-xs text-gray-600 italic mb-2">{emptyMessage}</p>
            ) : (
                <div className="space-y-1">
                    {sectionFiles.map(file => (
                        <EvidenceItem
                            key={file.id}
                            file={file}
                            isSelected={file.id === selectedFileId}
                            onSelect={handleSelectFile}
                            onDelete={onDeleteFile}
                            onRename={onRenameFile}
                        />
                    ))}
                </div>
            )}
        </section>
    );

    const renderUnifiedSection = (title: string, sectionCases: EvidenceCase[], emptyMessage: string) => (
        <section>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4">{title}</h3>
            {sectionCases.length === 0 ? (
                <p className="text-xs text-gray-600 italic mb-2">{emptyMessage}</p>
            ) : (
                <div className="space-y-1">
                    {sectionCases.map(c => (
                        <CaseItem key={c.id} caseItem={c} files={files} onSelect={onSelectCase} onDelete={onDeleteCase} onAppend={onAppendCase} />
                    ))}
                </div>
            )}
        </section>
    );

    const handleSelectFile = (id: string) => {
        onSelectFile(id === selectedFileId ? null : id);
    };

    return (
        <aside className="w-full h-full bg-gray-800 p-4 border-r border-gray-700 flex flex-col">
            {/* Collapsible Testimony Section */}
            <div className="mb-2 border-b border-gray-700 pb-2">
                <button
                    onClick={() => setTestimonyCollapsed(!testimonyCollapsed)}
                    className="w-full text-left text-sm font-semibold text-gray-300 hover:text-white flex items-center justify-between"
                >
                    <span>My Testimony</span>
                    <svg className={`h-4 w-4 transition-transform ${testimonyCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {!testimonyCollapsed && (
                    <div className="mt-2">
                        <MyTestimony
                            testimony={testimony}
                            contextSummary={contextSummary}
                            onSave={onSaveTestimony}
                            additionalTestimonies={(witnesses as any[]).map((w: any) => ({ name: w.employeeName, testimony: w.testimony }))}
                        />
                    </div>
                )}
            </div>

            {/* Collapsible Witness Section */}
            {witnesses && onAddWitness && (
                <div className="mb-2 border-b border-gray-700 pb-2">
                    <button
                        onClick={() => setWitnessCollapsed(!witnessCollapsed)}
                        className="w-full text-left text-sm font-semibold text-gray-300 hover:text-white flex items-center justify-between"
                    >
                        <span>Witnesses ({witnesses.length})</span>
                        <svg className={`h-4 w-4 transition-transform ${witnessCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {!witnessCollapsed && (
                        <div className="mt-2">
                            <WitnessInput
                                witnesses={witnesses as any}
                                employees={employees}
                                onAddWitness={(w) => onAddWitness(w)}
                                onDeleteWitness={(id) => onDeleteWitness && onDeleteWitness(id)}
                                onUpdateWitness={(id, updates) => onUpdateWitness && onUpdateWitness(id, updates)}
                                onSaveWitness={(id) => onSaveWitness && onSaveWitness(id)}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Evidence Locker with Tabs */}
            <div className="flex-grow flex flex-col min-h-0 pt-2">
                <h2 className="text-lg font-semibold mb-2 text-gray-300">Evidence Locker</h2>

                {/* Tabs */}
                <div className="flex space-x-1 mb-2 border-b border-gray-700">
                    <button
                        onClick={() => setActiveTab('completed')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${activeTab === 'completed' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'}`}
                    >
                        Completed ({completedFiles.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${activeTab === 'pending' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'}`}
                    >
                        Pending ({pendingFiles.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('review')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${activeTab === 'review' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'}`}
                    >
                        Review ({reviewFiles.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('unified')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${activeTab === 'unified' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'}`}
                    >
                        Unified ({unifiedCases.length})
                    </button>
                    {errorFiles.length > 0 && (
                        <button
                            onClick={() => setActiveTab('errors')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${activeTab === 'errors' ? 'bg-gray-700 text-white' : 'text-red-400 hover:text-red-300'}`}
                        >
                            Errors ({errorFiles.length})
                        </button>
                    )}
                </div>

                {/* Tab Content */}
                <div className="flex-grow overflow-y-auto pr-2">
                    {activeTab === 'pending' && renderSection('Pending & Unanalyzed', pendingFiles, 'Upload new files or start an analysis to see them here.')}
                    {activeTab === 'review' && renderSection('Needs Review', reviewFiles, 'Files requiring manual review will appear here.')}
                    {activeTab === 'completed' && renderSection('Completed Analyses', completedFiles, 'Completed analyses will appear here once finished.')}
                    {activeTab === 'unified' && renderUnifiedSection('Unified Analyses', unifiedCases, 'Unified (paired) analyses will appear here.')}
                    {activeTab === 'errors' && renderSection('Errors', errorFiles, 'Files with errors will appear here if analysis fails.')}
                </div>
            </div>

            {/* Collapsible Employee Section */}
            <div className="mt-2 border-t border-gray-700 pt-2 flex-shrink-0">
                <button
                    onClick={() => setEmployeeCollapsed(!employeeCollapsed)}
                    className="w-full text-left text-sm font-semibold text-gray-300 hover:text-white flex items-center justify-between mb-2"
                >
                    <span>Employee Profiles ({employees.length})</span>
                    <svg className={`h-4 w-4 transition-transform ${employeeCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {!employeeCollapsed && (
                    <EmployeeInput
                        employees={employees}
                        onAddEmployee={onAddEmployee}
                        onUpdateEmployee={onUpdateEmployee}
                        onSetEmployees={onSetEmployees}
                        onDeleteEmployee={onDeleteEmployee}
                    />
                )}
            </div>
        </aside>
    );
};

export default EvidencePanel;
