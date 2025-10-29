// Fix: Replaced placeholder content with a functional App component to structure the main application layout and logic.
import React from 'react';
import Chessboard from './components/Chessboard';
import GameInfo from './components/GameInfo';
import { useGameLogic } from './hooks/useGameLogic';

const App: React.FC = () => {
    const { 
        fen, 
        turn, 
        status, 
        isCheck, 
        lastMove,
        isAiThinking,
        gameMode,
        onMove, 
        getValidMoves, 
        resetGame,
        toggleGameMode
    } = useGameLogic();

    return (
        <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center font-sans p-4">
            <header className="text-center mb-4">
                <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
                    Gemini 3D Chess
                </h1>
                <p className="mt-2 text-lg text-gray-400">
                    A classic game powered by Three.js and React.
                </p>
                <div className="mt-4 flex justify-center items-center gap-4">
                     <button
                        onClick={toggleGameMode}
                        className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
                    >
                        {gameMode === 'pvp' ? 'Play vs AI' : 'Player vs Player'}
                    </button>
                    <button
                        onClick={resetGame}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75"
                    >
                        New Game
                    </button>
                </div>
            </header>
            <main className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 items-start">
                <div className="relative lg:w-3/4 h-[70vh] w-full">
                     {isAiThinking && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 rounded-lg">
                            <p className="text-2xl font-bold animate-pulse">AI is thinking...</p>
                        </div>
                    )}
                    <Chessboard 
                        fen={fen} 
                        turn={turn}
                        lastMove={lastMove}
                        onMove={onMove}
                        getValidMoves={getValidMoves}
                    />
                </div>
                <div className="lg:w-1/4 w-full">
                    <GameInfo 
                        status={status}
                        turn={turn}
                        isCheck={isCheck}
                    />
                </div>
            </main>
        </div>
    );
};

export default App;