import React from 'react';
import { EvidenceCase, EvidenceFile } from '../types';
import TrashIcon from './icons/TrashIcon';
import FolderOpenIcon from './icons/FolderOpenIcon';
import { revealOnDisk } from '../services/storageService';

const ReportIcon: React.FC<{ className?: string }> = ({ className }) => (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || 'h-4 w-4'}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM8 18h8v2H8v-2zm0-4h8v2H8v-2zm0-4h5v2H8V10zm7-7.5L20.5 8H15V2.5z" /></svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
	<svg xmlns="http://www.w3.org/2000/svg" className={className || 'h-4 w-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
	</svg>
);

interface CaseItemProps {
	caseItem: EvidenceCase;
	files: EvidenceFile[];
	onSelect?: (caseId: string) => void;
	onDelete?: (caseId: string) => void;
	onAppend?: (caseId: string) => void;
}

const CaseItem: React.FC<CaseItemProps> = ({ caseItem, files, onSelect, onDelete, onAppend }) => {
	const caseFiles = caseItem.fileIds
		.map(id => files.find(f => f.id === id))
		.filter((f): f is EvidenceFile => Boolean(f));

	const handleOpenCombined = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (caseFiles.length === 0) {
			alert('Source files not available.');
			return;
		}
		const urlFor = (f: EvidenceFile): string | undefined =>
			f.url || (f.storedFileName ? `/api/storage/file/${encodeURIComponent(f.storedFileName)}` : undefined);
		const previewable = caseFiles
			.map(file => ({ file, url: urlFor(file) }))
			.filter((entry): entry is { file: EvidenceFile; url: string } => Boolean(entry.url));

		if (previewable.length === 0) {
			alert('None of the original files are available. Re-upload to preview.');
			return;
		}

		try {
			const w = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=800');
			if (!w) {
				alert('Popup blocked. Please allow popups for this site to view unified files.');
				return;
			}

			const cards = previewable.map(({ file, url }) => `
			<div class="card">
				<div class="title">${file.name}</div>
				<iframe class="frame" src="${url}" sandbox="allow-same-origin allow-scripts"></iframe>
			</div>`).join('');

			const html = `<!DOCTYPE html>
	<html>
	<head>
	<meta charset="utf-8" />
	<title>${caseItem.name} - Comparison</title>
	<style>
	html, body { margin:0; padding:0; height:100%; background:#0f172a; color:#e5e7eb; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; }
	.bar { padding:10px 14px; background:#111827; border-bottom:1px solid #374151; font-size:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;}
	.grid { display:grid; height:calc(100% - 46px); grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:12px; padding:12px; box-sizing:border-box; }
	.card { border:1px solid #374151; border-radius:8px; background:#111827; display:flex; flex-direction:column; min-height:0; }
	.title { padding:8px 12px; font-weight:600; font-size:13px; border-bottom:1px solid #374151; }
	.frame { flex:1; width:100%; min-height:240px; border:0; background:#0f172a; border-bottom-left-radius:8px; border-bottom-right-radius:8px; }
	</style>
	</head>
	<body>
		<div class="bar">
			<div>Unified view: ${caseItem.name}</div>
			<div style="opacity:.8;font-size:12px">${previewable.length} file${previewable.length === 1 ? '' : 's'} loaded</div>
		</div>
		<div class="grid">${cards}</div>
	</body>
	</html>`;

			w.document.open();
			w.document.write(html);
			w.document.close();
		} catch (err) {
			console.error("Failed to open unified view:", err);
			alert("An error occurred while trying to open the unified view.");
		}
	};

	const handleDownload = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (caseFiles.length === 0) {
			alert('Source files not available.');
			return;
		}
		try {
			const JSZip = (await import('jszip')).default;
			const zip = new JSZip();

			const addFileToZip = async (f: EvidenceFile) => {
				if (f.file) {
					zip.file(f.name, f.file);
				} else if (f.storedFileName) {
					const resp = await fetch(`/api/storage/file/${encodeURIComponent(f.storedFileName)}`);
					if (resp.ok) {
						const blob = await resp.blob();
						zip.file(f.name, blob);
					}
				}
			};

			for (const file of caseFiles) {
				await addFileToZip(file);
			}

			// Add unified analysis report if available
			if (caseItem.analysisDocumentFileName) {
				const resp = await fetch(`/api/storage/file/${encodeURIComponent(caseItem.analysisDocumentFileName)}`);
				if (resp.ok) {
					const blob = await resp.blob();
					const reportName = `Analysis - ${caseItem.name}.txt`;
					zip.file(reportName, blob);
				}
			}

			const zipBlob = await zip.generateAsync({ type: 'blob' });
			const zipFileName = `Evidence Package - ${caseItem.name}.zip`;
			const link = document.createElement('a');
			link.href = URL.createObjectURL(zipBlob);
			link.download = zipFileName;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(link.href);
		} catch (err) {
			console.error('Error preparing download:', err);
			alert('Could not create the unified download package. Please try again.');
		}
	};

	const handleRevealReport = async (e: React.MouseEvent) => {
		e.stopPropagation();
		const rel = caseItem.analysisDocumentPath
			|| (caseItem.analysisDocumentFileName ? `app/data/analysis reports/${caseItem.analysisDocumentFileName}` : undefined);
		if (!rel) {
			alert('No saved unified analysis report to reveal yet.');
			return;
		}
		try {
			await revealOnDisk({ relativePath: rel });
		} catch (err: any) {
			console.error('Failed to reveal unified report:', err);
			alert(err?.message || 'Unable to reveal report location.');
		}
	};

	const statusBadge = (
		<div className="ml-2 h-3 w-3 rounded-full"
			style={{ backgroundColor: caseItem.status === 'analyzing' ? '#f59e0b' : (caseItem.status === 'analyzed' ? '#10b981' : (caseItem.status === 'error' ? '#ef4444' : '#6b7280')) }}
			title={caseItem.status}
		/>
	);

	return (
		<div
			title={caseItem.name}
			className="p-2 transition-colors duration-200 w-full text-left group rounded-lg flex items-center hover:bg-gray-700 cursor-pointer"
			onClick={() => onSelect && onSelect(caseItem.id)}
		>
			<div className="flex flex-col flex-grow">
				<span className="truncate text-sm">{caseItem.name}</span>
				<span className="text-xs text-gray-500">{caseItem.fileIds.length} file{caseItem.fileIds.length === 1 ? '' : 's'}</span>
			</div>
			<div className="ml-2 flex-shrink-0 flex items-center space-x-2">
				{onAppend && (
					<button
						onClick={(e) => { e.stopPropagation(); onAppend(caseItem.id); }}
						title="Append files and re-run unified analysis"
						className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-teal-400 hover:text-teal-300 transition-opacity"
					>
						{/* plus icon */}
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M13 11h6v2h-6v6h-2v-6H5v-2h6V5h2v6z" /></svg>
					</button>
				)}
				<button
					onClick={handleOpenCombined}
					title="Open both files side-by-side"
					className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400 hover:text-white transition-opacity"
				>
					{/* eye icon */}
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 5c-5 0-9.27 3.11-11 7 1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 110-10 5 5 0 010 10zm0-2a3 3 0 100-6 3 3 0 000 6z" /></svg>
				</button>
				<button
					onClick={handleDownload}
					title="Download originals + unified analysis"
					className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400 hover:text-white transition-opacity"
				>
					<DownloadIcon className="h-4 w-4" />
				</button>
				<button
					onClick={handleRevealReport}
					title="Reveal unified analysis report in folder"
					className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400 hover:text-white transition-opacity"
				>
					<FolderOpenIcon className="h-4 w-4" />
				</button>
				{onDelete && (
					<button
						onClick={(e) => { e.stopPropagation(); onDelete(caseItem.id); }}
						title="Delete this unified analysis"
						className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
					>
						<TrashIcon className="h-4 w-4" />
					</button>
				)}
				{statusBadge}
			</div>
		</div>
	);
};

export default CaseItem;


