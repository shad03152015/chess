import React from 'react';

interface GameInfoProps {
    status: string;
    turn: 'w' | 'b';
    isCheck: boolean;
}

const GameInfo: React.FC<GameInfoProps> = ({ status, turn, isCheck }) => {
    return (
        <div className="bg-gray-800 rounded-lg shadow-2xl p-4 text-center space-y-4">
            <div>
                <h2 className="text-lg font-bold uppercase tracking-wider text-gray-400">Status</h2>
                <p className={`text-xl font-semibold mt-1 h-12 flex items-center justify-center ${isCheck ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {status}
                </p>
            </div>
            
            <div className="w-full h-px bg-gray-700"></div>

            <div>
                <h2 className="text-lg font-bold uppercase tracking-wider text-gray-400">Current Turn</h2>
                <div className="flex items-center justify-center mt-2 space-x-2">
                    <div className={`w-6 h-6 rounded-full transition-all duration-300 ${turn === 'w' ? 'bg-white shadow-lg scale-110' : 'bg-gray-600'}`}></div>
                    <div className={`w-6 h-6 rounded-full transition-all duration-300 ${turn === 'b' ? 'bg-gray-900 border-2 border-gray-400 shadow-lg scale-110' : 'bg-gray-600'}`}></div>
                </div>
            </div>
        </div>
    );
};

export default GameInfo;