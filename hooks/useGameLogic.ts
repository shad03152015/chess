// Fix: The original file contained invalid text at the beginning which caused parsing errors. This has been removed.
// Fix: Replaced placeholder content with a custom hook to manage chess game logic.
import { useState, useCallback, useMemo, useEffect } from 'react';
import { Chess } from 'chess.js';
import type { Player, Square, Move, GameMode } from '../types';

const getStatusMessage = (game: Chess): string => {
    if (game.isCheckmate()) {
        return `Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins.`;
    }
    if (game.isDraw()) {
        return 'Draw!';
    }
    if (game.isStalemate()) {
        return 'Stalemate!';
    }
    if (game.isThreefoldRepetition()) {
        return 'Draw by threefold repetition!';
    }
    if (game.isInsufficientMaterial()) {
        return 'Draw by insufficient material!';
    }
    // Check is handled separately for UI effects
    return `${game.turn() === 'w' ? 'White' : 'Black'}'s turn.`;
};


export const useGameLogic = () => {
    const game = useMemo(() => new Chess(), []);
    
    const [fen, setFen] = useState(game.fen());
    const [turn, setTurn] = useState<Player>(game.turn());
    const [isCheck, setIsCheck] = useState(game.isCheck());
    const [status, setStatus] = useState(getStatusMessage(game));
    const [lastMove, setLastMove] = useState<Move | null>(null);
    const [gameMode, setGameMode] = useState<GameMode>('pvp');
    const [isAiThinking, setIsAiThinking] = useState(false);

    const updateGameState = useCallback((move: Move | null = null) => {
        setFen(game.fen());
        setTurn(game.turn());
        const check = game.isCheck();
        setIsCheck(check);
        let message = getStatusMessage(game);
        if(check && !game.isGameOver()){
            message = `${game.turn() === 'w' ? 'White' : 'Black'} is in check.`;
        }
        setStatus(message);
        if (move) {
            setLastMove(move);
        }
    }, [game]);

    const makeAiMove = useCallback(() => {
        if (game.isGameOver() || game.turn() === 'w') return;

        setIsAiThinking(true);
        // AI "thinks" for a second to feel more natural
        setTimeout(() => {
            const moves = game.moves({ verbose: true });
            if (moves.length > 0) {
                const move = moves[Math.floor(Math.random() * moves.length)];
                const result = game.move(move.san);
                updateGameState(result);
            }
            setIsAiThinking(false);
        }, 1000);
    }, [game, updateGameState]);
    
    const onMove = useCallback((from: Square, to: Square): boolean => {
        let moveResult: Move | null = null;
        try {
            moveResult = game.move({ from, to, promotion: 'q' }); // auto-promote to queen
            if (moveResult) {
                updateGameState(moveResult);
                return true;
            }
        } catch (e) {
            console.warn('Invalid move:', e);
        }
        return false;
    }, [game, updateGameState]);

    // Effect to trigger AI move after player moves in 'pva' mode
    useEffect(() => {
        // The check on game.turn() is a safeguard against race conditions.
        // When switching modes, the 'turn' state might be from the previous render
        // while 'gameMode' is new. Checking the game object directly ensures
        // the AI only moves when it is truly its turn in the current game state.
        if (gameMode === 'pva' && game.turn() === 'b' && !game.isGameOver()) {
            makeAiMove();
        }
    }, [fen, gameMode, game, makeAiMove]);

    const getValidMoves = useCallback((square: Square): Move[] => {
        return game.moves({ square, verbose: true });
    }, [game]);
    
    const resetGame = useCallback(() => {
        game.reset();
        setIsAiThinking(false);
        setLastMove(null);
        updateGameState();
    }, [game, updateGameState]);

    const toggleGameMode = useCallback(() => {
        setGameMode(prev => (prev === 'pvp' ? 'pva' : 'pvp'));
        resetGame();
    }, [resetGame]);

    return {
        fen,
        turn,
        isCheck,
        status,
        lastMove,
        isAiThinking,
        gameMode,
        onMove,
        getValidMoves,
        resetGame,
        toggleGameMode
    };
};