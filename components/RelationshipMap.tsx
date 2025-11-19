import React, { useState, useMemo } from 'react';
import { RelationshipMapData, RelationshipMapLink, InteractionSentiment } from '../types';

const sentimentColors: Record<InteractionSentiment, string> = {
    negative: '#F87171', // red-400
    positive: '#4ADE80', // green-400
    neutral: '#9CA3AF', // gray-400
    mixed: '#FBBF24', // amber-400
};

const RelationshipMap: React.FC<{ data: RelationshipMapData }> = ({ data }) => {
    const [selectedLink, setSelectedLink] = useState<RelationshipMapLink | null>(null);

    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 60;

    const nodePositions = useMemo(() => {
        const positions = new Map<string, { x: number; y: number }>();
        const angleStep = data.nodes.length > 0 ? (2 * Math.PI) / data.nodes.length : 0;
        data.nodes.forEach((node, i) => {
            const angle = i * angleStep - Math.PI / 2; // Start from top
            positions.set(node.id, {
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
            });
        });
        return positions;
    }, [data.nodes, centerX, centerY, radius]);

    return (
        <div className="flex h-full">
            <div className="flex-grow relative bg-gray-800/50 rounded-lg m-4 overflow-hidden">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                    {/* Links */}
                    {data.links.map((link, i) => {
                        const sourcePos = nodePositions.get(link.source);
                        const targetPos = nodePositions.get(link.target);
                        if (!sourcePos || !targetPos) return null;

                        const isSelected = selectedLink === link;
                        
                        return (
                            <g key={i} className="cursor-pointer group" onClick={() => setSelectedLink(link)}>
                                <line
                                    x1={sourcePos.x} y1={sourcePos.y}
                                    x2={targetPos.x} y2={targetPos.y}
                                    stroke={sentimentColors[link.sentiment]}
                                    strokeWidth={isSelected ? Math.max(3, link.value) + 3 : Math.max(2, link.value)}
                                    className="transition-all duration-200"
                                    opacity={isSelected ? 1 : 0.6}
                                />
                                 {/* Invisible wider line for easier clicking */}
                                <line 
                                     x1={sourcePos.x} y1={sourcePos.y}
                                     x2={targetPos.x} y2={targetPos.y}
                                     stroke="transparent"
                                     strokeWidth="20"
                                />
                            </g>
                        );
                    })}
                    {/* Nodes */}
                    {data.nodes.map(node => {
                        const pos = nodePositions.get(node.id);
                        if (!pos) return null;
                        
                        const isRelatedToSelected = selectedLink && (selectedLink.source === node.id || selectedLink.target === node.id);

                        return (
                            <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`} className="transition-all duration-200">
                                <circle r={isRelatedToSelected ? 24 : 20} fill="#1F2937" stroke={isRelatedToSelected ? '#fbbbf2' : '#38bdf8'} strokeWidth="2" />
                                <text
                                    textAnchor="middle"
                                    dy="0.3em"
                                    fill="#E5E7EB"
                                    fontSize="12"
                                    className="font-semibold select-none pointer-events-none"
                                >
                                    {node.id}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>
            <aside className="w-96 flex-shrink-0 bg-gray-800 p-4 overflow-y-auto">
                <h3 className="text-lg font-bold text-teal-400 border-b border-gray-700 pb-2 mb-4">Interaction Details</h3>
                {selectedLink ? (
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-semibold text-gray-200">{selectedLink.source} &harr; {selectedLink.target}</h4>
                            <div className="flex items-center space-x-2 text-sm text-gray-400">
                                <span>{selectedLink.value} interactions</span>
                                <span className="w-1 h-1 rounded-full bg-gray-500"></span>
                                <span style={{ color: sentimentColors[selectedLink.sentiment]}} className="font-bold capitalize">{selectedLink.sentiment}</span>
                            </div>
                        </div>
                        <div>
                             <h5 className="text-sm font-semibold text-gray-300 mb-1">Relationship Summary</h5>
                             <p className="text-sm text-gray-400">{selectedLink.summary}</p>
                        </div>
                        <div>
                            <h5 className="text-sm font-semibold text-gray-300 mb-2">Interaction Log</h5>
                            <ul className="space-y-3 text-xs max-h-[60vh] overflow-y-auto pr-2">
                                {selectedLink.interactions.map((interaction, i) => (
                                    <li key={i} className="p-2 bg-gray-700/50 rounded-md">
                                        <p className="font-mono text-teal-300 truncate">{interaction.file} @ {interaction.timestamp}</p>
                                        <p className="mt-1 text-gray-300">{interaction.description}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-gray-500 pt-16">
                        <p>Select a line between two people to see details about their interactions.</p>
                    </div>
                )}
            </aside>
        </div>
    );
};

export default RelationshipMap;
