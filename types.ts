// Fix: Replaced placeholder content with actual type definitions required by the application.
import type { Square, PieceSymbol, Move as ChessJsMove } from 'chess.js';

export type Player = 'w' | 'b';
export type GameMode = 'pvp' | 'pva';

// Re-exporting for easy access in other parts of the app
export type { Square, PieceSymbol };
export type Move = ChessJsMove;