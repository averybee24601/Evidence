
import React from 'react';

interface SeverityBarProps {
    score: number; // score from 1 to 10
}

const SeverityBar: React.FC<SeverityBarProps> = ({ score }) => {
    const normalizedScore = Math.max(0, Math.min(10, score || 0));
    
    // Interpolate color from green to yellow to red
    const getBarColor = () => {
        if (normalizedScore <= 4) { // Green to Yellow
            const red = Math.round(255 * (normalizedScore / 4));
            return `rgb(${red}, 255, 0)`;
        } else { // Yellow to Red
            const green = Math.round(255 * (1 - (normalizedScore - 4) / 6));
            return `rgb(255, ${green}, 0)`;
        }
    };

    const color = getBarColor();
    const width = `${normalizedScore * 10}%`;

    return (
        <div>
            <div className="text-xs text-gray-400 mb-1 flex justify-between">
                <span>Severity Score</span>
                <span>{normalizedScore}/10</span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2.5">
                <div
                    className="h-2.5 rounded-full transition-all duration-500"
                    style={{ width: width, backgroundColor: color }}
                ></div>
            </div>
        </div>
    );
};

export default SeverityBar;
