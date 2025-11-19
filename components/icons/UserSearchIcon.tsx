import React from 'react';

const UserSearchIcon = ({ className }: { className?: string }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className={className || "h-6 w-6"}
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor" 
        strokeWidth={2}
    >
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 16.5l2 2 4-4m-6-4.5a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0zM18 18.5A4.5 4.5 0 0013.5 14H10.5A4.5 4.5 0 006 18.5V21h12v-2.5z" />
    </svg>
);

export default UserSearchIcon;
