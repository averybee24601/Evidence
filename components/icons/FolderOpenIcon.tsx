import React from 'react';

const FolderOpenIcon: React.FC<{ className?: string }> = ({ className }) => (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || 'h-4 w-4'}>
		<path d="M3 5a2 2 0 012-2h4l2 2h6a2 2 0 012 2v2H7.236a2 2 0 00-1.79 1.106L3 16.118V5zm18 6H8.618l-3.2 6.4A2 2 0 007.236 19H19a2 2 0 001.789-1.106L22 13a2 2 0 00-1-2z" />
	</svg>
);

export default FolderOpenIcon;