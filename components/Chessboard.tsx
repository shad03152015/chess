import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Square, Move } from '../types';
import { gsap } from "gsap";

interface ChessboardProps {
    fen: string;
    turn: 'w' | 'b';
    lastMove: Move | null;
    onMove: (from: Square, to: Square) => void;
    getValidMoves: (square: Square) => Move[];
}

const positionToSquare = (pos: THREE.Vector3): Square => {
    const col = String.fromCharCode('a'.charCodeAt(0) + Math.round(pos.x + 3.5));
    const row = (Math.round(pos.z + 3.5) + 1).toString();
    const square = `${col}${row}`;
    if (col < 'a' || col > 'h' || parseInt(row) < 1 || parseInt(row) > 8) {
        return 'a1'; // Default, will be checked against valid moves
    }
    return square as Square;
};

const squareToPosition = (square: Square): THREE.Vector3 => {
    const col = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = parseInt(square.charAt(1), 10) - 1;
    return new THREE.Vector3(col - 3.5, -0.5, row - 3.5);
};

const Chessboard: React.FC<ChessboardProps> = ({ fen, turn, onMove, getValidMoves, lastMove }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const boardMeshRef = useRef<THREE.Object3D | null>(null);
    const pieceMeshes = useRef<Record<string, THREE.Object3D>>({});
    const models = useRef<Record<string, THREE.Object3D>>({});
    const isAnimating = useRef(false);
    
    const draggedPieceRef = useRef<{ square: Square, mesh: THREE.Object3D } | null>(null);
    const hoveredPieceRef = useRef<THREE.Object3D | null>(null);
    const validMoveHighlightsRef = useRef<THREE.Mesh[]>([]);
    const startSquareHighlightRef = useRef<THREE.Mesh | null>(null);
    const visualFenRef = useRef<string | null>(null);


    // Main setup effect
    useEffect(() => {
        if (!mountRef.current) return;
        
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111827); 
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(55, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
        camera.position.set(0, 6, 10);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        renderer.shadowMap.enabled = true;
        rendererRef.current = renderer;
        const mountNode = mountRef.current;
        mountNode.appendChild(renderer.domElement);
        
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 0, 0);
        controls.enablePan = false;
        controls.maxPolarAngle = Math.PI / 2 - 0.1;
        controlsRef.current = controls;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(-4, 6, 4);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        const loader = new GLTFLoader();
        loader.load('/scene.gltf', (gltf) => {
            const children = [...gltf.scene.children];
            children.forEach(child => {
                if (child.name.startsWith('W_') || child.name.startsWith('B_')) {
                    models.current[child.name] = child;
                } else {
                    child.position.y = -0.5;
                    child.receiveShadow = true;
                    scene.add(child);
                    boardMeshRef.current = child;
                }
            });
            updateBoardFromFen(fen, scene, true);
            visualFenRef.current = fen;
        });
        
        const animate = () => {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();
        
        const handleResize = () => {
            if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
            camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
             if (renderer.domElement.parentNode === mountNode) {
                mountNode.removeChild(renderer.domElement);
            }
        };
    }, []);

    // Effect for handling drag and drop interaction logic
    useEffect(() => {
        const rendererEl = rendererRef.current?.domElement;
        if (!rendererEl || !mountRef.current) return;

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.2); 
        const intersectionPoint = new THREE.Vector3();

        const highlightPiece = (pieceMesh: THREE.Object3D) => {
            pieceMesh.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    const material = child.material as THREE.MeshStandardMaterial;
                    material.emissive.set(0xffffff);
                    gsap.to(material, { emissiveIntensity: 0.5, duration: 0.3 });
                }
            });
        };

        const unhighlightPiece = (pieceMesh: THREE.Object3D, instant = false) => {
            pieceMesh.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    const material = child.material as THREE.MeshStandardMaterial;
                    if (instant) {
                        material.emissiveIntensity = 0;
                        material.emissive.set(0x000000);
                    } else {
                        gsap.to(material, {
                            emissiveIntensity: 0,
                            duration: 0.3,
                            onComplete: () => material.emissive.set(0x000000),
                        });
                    }
                }
            });
        };

        const onPointerDown = (event: PointerEvent) => {
            if (isAnimating.current || !cameraRef.current) return;
            
            const rect = rendererEl.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 - 1;
            raycaster.setFromCamera(pointer, cameraRef.current);

            const intersects = raycaster.intersectObjects(Object.values(pieceMeshes.current), true);
            if (intersects.length > 0) {
                let parent = intersects[0].object;
                while (parent.parent && !parent.userData.square) {
                    parent = parent.parent;
                }
                
                const square = parent.userData.square as Square;
                const color = parent.userData.color;
                
                if (color === turn) {
                    if (hoveredPieceRef.current) {
                        unhighlightPiece(hoveredPieceRef.current, true);
                        hoveredPieceRef.current = null;
                    }

                    parent.traverse(child => {
                        if (child instanceof THREE.Mesh) {
                            const material = child.material as THREE.MeshStandardMaterial;
                            const originalEmissive = material.emissive.getHex();
                            gsap.to(material, {
                                emissiveIntensity: 1.5,
                                duration: 0.15,
                                yoyo: true,
                                repeat: 1,
                                ease: "power2.inOut",
                                onStart: () => material.emissive.set(0xffff99),
                                onComplete: () => material.emissive.set(originalEmissive),
                            });
                        }
                    });

                    draggedPieceRef.current = { square, mesh: parent };
                    if (controlsRef.current) controlsRef.current.enabled = false;

                    gsap.to(parent.position, { y: 0.2, duration: 0.2, delay: 0.1 });
                    gsap.to(parent.scale, { x: 1.1, y: 1.1, z: 1.1, duration: 0.2, delay: 0.1 });
                    
                    showValidMoves(square);
                    showStartSquareHighlight(square);
                }
            }
        };

        const onPointerMove = (event: PointerEvent) => {
            const rect = rendererEl.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 - 1;

            if (!draggedPieceRef.current || !cameraRef.current) {
                // Hover Logic
                raycaster.setFromCamera(pointer, cameraRef.current);
                const intersects = raycaster.intersectObjects(Object.values(pieceMeshes.current));
                
                if (intersects.length > 0) {
                    let parent = intersects[0].object;
                     while (parent.parent && !parent.userData.square) {
                        parent = parent.parent;
                    }
                    if (parent.userData.color === turn) {
                        mountRef.current!.style.cursor = 'grab';
                        if (hoveredPieceRef.current !== parent) {
                            if (hoveredPieceRef.current) unhighlightPiece(hoveredPieceRef.current);
                            hoveredPieceRef.current = parent;
                            highlightPiece(parent);
                        }
                    } else {
                        mountRef.current!.style.cursor = 'default';
                        if (hoveredPieceRef.current) {
                            unhighlightPiece(hoveredPieceRef.current);
                            hoveredPieceRef.current = null;
                        }
                    }
                } else {
                     mountRef.current!.style.cursor = 'default';
                     if (hoveredPieceRef.current) {
                        unhighlightPiece(hoveredPieceRef.current);
                        hoveredPieceRef.current = null;
                    }
                }
                return;
            };
            
            // Drag Logic
            raycaster.setFromCamera(pointer, cameraRef.current);
            raycaster.ray.intersectPlane(dragPlane, intersectionPoint);
            draggedPieceRef.current.mesh.position.set(intersectionPoint.x, 0.2, intersectionPoint.z);
        };

        const onPointerUp = (event: PointerEvent) => {
            if (controlsRef.current) controlsRef.current.enabled = true;
            if (!draggedPieceRef.current || !cameraRef.current || !boardMeshRef.current) {
                resetDraggedPiece();
                return;
            };
            
            const planeIntersect = raycaster.intersectObject(boardMeshRef.current, true);
            const targetSquare = planeIntersect.length > 0 ? positionToSquare(planeIntersect[0].point) : null;
            const move = targetSquare ? getValidMoves(draggedPieceRef.current.square).find(m => m.to === targetSquare) : null;

            if (move) {
                isAnimating.current = true;
                const fromSquare = draggedPieceRef.current.square;
                const toSquare = move.to;
                
                handleCaptureAnimation(move, fromSquare, toSquare);

                const destPos = squareToPosition(toSquare);
                gsap.to(draggedPieceRef.current.mesh.position, {
                    x: destPos.x, y: destPos.y, z: destPos.z,
                    duration: 0.4, ease: "power2.inOut",
                    onComplete: () => {
                        onMove(fromSquare, toSquare);
                        // FEN update will handle final sync
                        isAnimating.current = false;
                    }
                });
                gsap.to(draggedPieceRef.current.mesh.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: "power2.inOut" });
            } else {
                handleInvalidMoveAnimation();
            }
            
            resetDraggedPiece();
        };
        
        const resetDraggedPiece = () => {
            draggedPieceRef.current = null;
            clearHighlights();
            clearStartSquareHighlight();
        }

        const handleCaptureAnimation = (move: Move, fromSquare: Square, toSquare: Square) => {
            let capturedSquare = null;
            if (move.flags.includes('c')) capturedSquare = toSquare;
            else if (move.flags.includes('e')) capturedSquare = (toSquare[0] + fromSquare[1]) as Square;

            if (capturedSquare && pieceMeshes.current[capturedSquare]) {
                const capturedMesh = pieceMeshes.current[capturedSquare];
                gsap.to(capturedMesh.scale, {
                    x: 0, y: 0, z: 0, duration: 0.3, onComplete: () => {
                       sceneRef.current?.remove(capturedMesh);
                    }
                });
                delete pieceMeshes.current[capturedSquare];
            }
        }
        
        const handleInvalidMoveAnimation = () => {
            if (!draggedPieceRef.current) return;
            const pieceMesh = draggedPieceRef.current.mesh;
            const originalPos = squareToPosition(draggedPieceRef.current.square);

            gsap.to(pieceMesh.position, {
                x: originalPos.x, y: originalPos.y, z: originalPos.z,
                duration: 0.3, ease: "power2.out"
            });
            gsap.to(pieceMesh.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: "power2.out" });
            
            pieceMesh.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    gsap.to((child.material as THREE.MeshStandardMaterial).color, {
                        r: 1, g: 0.2, b: 0.2,
                        duration: 0.15, yoyo: true, repeat: 1, ease: "power1.inOut"
                    });
                }
            });
        }

        rendererEl.addEventListener('pointerdown', onPointerDown);
        rendererEl.addEventListener('pointermove', onPointerMove);
        rendererEl.addEventListener('pointerup', onPointerUp);

        return () => {
            rendererEl.removeEventListener('pointerdown', onPointerDown);
            rendererEl.removeEventListener('pointermove', onPointerMove);
            rendererEl.removeEventListener('pointerup', onPointerUp);
        };
    }, [turn, getValidMoves, onMove]); 
    
    const updateBoardFromFen = (currentFen: string, scene: THREE.Scene, isInitial = false) => {
        if (Object.keys(models.current).length === 0) return;
        const newPieceLayout: Record<string, {color: string, type: string}> = {};
        currentFen.split(' ')[0].split('/').forEach((row, rowIndex) => {
            let colIndex = 0;
            for (const char of row) {
                if (isNaN(parseInt(char))) {
                    const square = `${String.fromCharCode(97 + colIndex)}${8 - rowIndex}` as Square;
                    newPieceLayout[square] = { color: char === char.toUpperCase() ? 'w' : 'b', type: char.toLowerCase() };
                    colIndex++;
                } else {
                    colIndex += parseInt(char);
                }
            }
        });
        
        Object.entries(newPieceLayout).forEach(([square, piece]) => {
            if (!pieceMeshes.current[square]) {
                const modelName = `${piece.color.toUpperCase()}_${piece.type.toUpperCase()}`;
                const model = models.current[modelName];
                if (model) {
                    const pieceMesh = model.clone();
                    const pos = squareToPosition(square as Square);
                    pieceMesh.position.copy(pos);
                    pieceMesh.traverse(child => {
                        if (child instanceof THREE.Mesh) {
                            child.material = new THREE.MeshStandardMaterial({ color: piece.color === 'w' ? 0xcccccc : 0x1a1a1a, emissive: 0x000000 });
                            child.castShadow = true;
                        }
                    });
                    pieceMesh.userData = { square, color: piece.color, type: piece.type };
                    pieceMeshes.current[square] = pieceMesh;
                    scene.add(pieceMesh);
                    if(!isInitial){
                        gsap.from(pieceMesh.scale, { x: 0, y: 0, z: 0, duration: 0.5, ease: "back.out(1.7)" });
                    }
                }
            }
        });

        Object.keys(pieceMeshes.current).forEach(square => {
            if (!newPieceLayout[square]) {
                if (!isAnimating.current) scene.remove(pieceMeshes.current[square]);
                delete pieceMeshes.current[square];
            }
        });
    };
    
    // Effect to handle animations for external moves (e.g., AI)
    useEffect(() => {
        if (visualFenRef.current === fen) return;

        const isOpponentMove = lastMove && lastMove.color !== turn;

        if (isOpponentMove && !draggedPieceRef.current) {
            isAnimating.current = true;
            const { from, to, flags } = lastMove;
            const fromMesh = pieceMeshes.current[from];

            if (!fromMesh) {
                updateBoardFromFen(fen, sceneRef.current!);
                visualFenRef.current = fen;
                isAnimating.current = false;
                return;
            }

            // Added delay for AI moves to feel more natural
            setTimeout(() => {
                handleCaptureAnimation({flags, to} as Move, from, to);
                
                const destPos = squareToPosition(to);
                gsap.to(fromMesh.position, {
                    x: destPos.x, y: destPos.y, z: destPos.z,
                    duration: 0.4, ease: "power2.inOut",
                    onComplete: () => {
                        updateBoardFromFen(fen, sceneRef.current!);
                        visualFenRef.current = fen;
                        isAnimating.current = false;
                    }
                });
            }, 300); // 300ms delay

        } else if (!isAnimating.current) {
            // Sync for player moves or game reset
            updateBoardFromFen(fen, sceneRef.current!);
            visualFenRef.current = fen;
        }
    }, [fen, turn, lastMove]);


    const showValidMoves = (square: Square) => {
        if (!sceneRef.current) return;
        clearHighlights();
        const moves = getValidMoves(square);
        const highlights: THREE.Mesh[] = [];
        moves.forEach(move => {
            const pos = squareToPosition(move.to);
            const isCapture = move.flags.includes('c') || move.flags.includes('e');
            const geometry = new THREE.RingGeometry(0.35, 0.45, 32);
            const material = new THREE.MeshBasicMaterial({ 
                color: isCapture ? 0xff4444 : 0x4499ff,
                transparent: true, opacity: 0.8, side: THREE.DoubleSide
            });
            const highlight = new THREE.Mesh(geometry, material);
            highlight.rotation.x = -Math.PI / 2;
            highlight.position.set(pos.x, -0.49, pos.z);
            sceneRef.current?.add(highlight);
            highlights.push(highlight);
        });
        validMoveHighlightsRef.current = highlights;
    };

    const clearHighlights = () => {
        validMoveHighlightsRef.current.forEach(h => sceneRef.current?.remove(h));
        validMoveHighlightsRef.current = [];
    };

    const showStartSquareHighlight = (square: Square) => {
        if (!sceneRef.current) return;
        clearStartSquareHighlight();
        const pos = squareToPosition(square);
        const geometry = new THREE.PlaneGeometry(1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.4 });
        const highlight = new THREE.Mesh(geometry, material);
        highlight.rotation.x = -Math.PI / 2;
        highlight.position.set(pos.x, -0.49, pos.z);
        sceneRef.current.add(highlight);
        startSquareHighlightRef.current = highlight;
    }
    
    const clearStartSquareHighlight = () => {
        if (startSquareHighlightRef.current) {
            sceneRef.current?.remove(startSquareHighlightRef.current);
            startSquareHighlightRef.current = null;
        }
    }
    
    // Minimal capture animation handler for reuse
    const handleCaptureAnimation = (move: Pick<Move, 'flags' | 'to'>, fromSquare: Square, toSquare: Square) => {
        let capturedSquare = null;
        if (move.flags.includes('c')) capturedSquare = toSquare;
        else if (move.flags.includes('e')) capturedSquare = (toSquare[0] + fromSquare[1]) as Square;

        if (capturedSquare && pieceMeshes.current[capturedSquare]) {
            const capturedMesh = pieceMeshes.current[capturedSquare];
            gsap.to(capturedMesh.scale, {
                x: 0, y: 0, z: 0, duration: 0.3, onComplete: () => {
                    sceneRef.current?.remove(capturedMesh);
                }
            });
            delete pieceMeshes.current[capturedSquare];
        }
    }

    return <div ref={mountRef} className="w-full h-full cursor-grab" />;
};

export default Chessboard;