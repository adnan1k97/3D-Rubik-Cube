import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GoogleGenAI } from "@google/genai";
import { 
  Play, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Shuffle,
  Move as MoveIcon,
  Undo2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Trophy,
  ArrowRight,
  Lock,
  Home,
  Timer,
  Palette,
  X,
  RefreshCw,
  Check,
  Flag,
  Settings2,
  Wand2,
  Keyboard,
  Lightbulb
} from 'lucide-react';

// --- Constants & Config ---
const STORAGE_KEY = 'rubiks-cube-state-v1';
const CAMPAIGN_KEY = 'rubiks-campaign-progress-v1';
const THEME_KEY = 'rubiks-theme-v1';

const CUBE_SIZE = 1;
const SPACING = 0.02;
const ANIMATION_SPEED = 300;
const SHUFFLE_SPEED = 100; 
const EPSILON = 0.25; 

const MAX_LEVELS = 20;

const DEFAULT_COLORS = {
  base: 0x111111,
  R: 0xb90000,
  L: 0xff5900,
  U: 0xffffff,
  D: 0xffd500,
  F: 0x009e60,
  B: 0x0045ad
};

const BG_PRESETS = [
    { name: "Deep Space", value: "radial-gradient(circle at 50% 50%, #2b2b2b 0%, #050505 100%)" },
    { name: "Midnight", value: "linear-gradient(to bottom, #0f172a, #1e293b)" },
    { name: "Ocean", value: "linear-gradient(to bottom, #0c4a6e, #075985)" },
    { name: "Forest", value: "linear-gradient(to bottom, #064e3b, #065f46)" },
    { name: "Sunset", value: "linear-gradient(to bottom, #4c1d95, #be185d)" },
    { name: "Charcoal", value: "#18181b" },
];

type Axis = 'x' | 'y' | 'z';
interface Move {
  axis: Axis;
  index: number;
  direction: number;
  notation?: string;
}

interface RubiksCubeProps {
    isGameActive: boolean;
    initialMode: 'campaign' | 'freeplay';
    startingLevel?: number;
    onHome: () => void;
}

// --- Helper Functions ---

const createStickerTexture = (colorHex: number) => {
    const size = 128; 
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, size, size);

    const pad = 15; 
    ctx.fillStyle = '#' + new THREE.Color(colorHex).getHexString();
    ctx.beginPath();
    // @ts-ignore
    if (ctx.roundRect) ctx.roundRect(pad, pad, size - pad*2, size - pad*2, 10);
    else ctx.rect(pad, pad, size - pad*2, size - pad*2);
    ctx.fill();

    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, "rgba(255,255,255,0.2)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
};

const getNotation = (axis: Axis, index: number, direction: number): string => {
    let letter = "";
    let inverted = false;
    if (axis === 'x') {
        if (index === -1) { letter = "U"; inverted = direction === -1; }
        else if (index === 1) { letter = "D"; inverted = direction === 1; }
        else { letter = "E"; inverted = direction === 1; }
    } else if (axis === 'y') {
        if (index === 1) { letter = "R"; inverted = direction === -1; }
        else if (index === -1) { letter = "L"; inverted = direction === 1; }
        else { letter = "M"; inverted = direction === 1; }
    } else if (axis === 'z') {
        if (index === 1) { letter = "F"; inverted = direction === -1; }
        else if (index === -1) { letter = "B"; inverted = direction === 1; }
        else { letter = "S"; inverted = direction === 1; }
    }
    return letter + (inverted ? "'" : "");
};

const parseScrambleString = (scramble: string) => {
    const moves: { axis: Axis, index: number, direction: number, notation: string }[] = [];
    const tokens = scramble.trim().split(/\s+/);
    for (const token of tokens) {
        if (!token) continue;
        const base = token[0].toUpperCase();
        const modifier = token.slice(1);
        let axis: Axis | null = null;
        let index = 0;
        let direction = 0;
        switch (base) {
            case 'R': axis = 'y'; index = 1; direction = -1; break;
            case 'L': axis = 'y'; index = -1; direction = 1; break;
            case 'U': axis = 'x'; index = -1; direction = -1; break;
            case 'D': axis = 'x'; index = 1; direction = 1; break;
            case 'F': axis = 'z'; index = 1; direction = -1; break;
            case 'B': axis = 'z'; index = -1; direction = 1; break;
            case 'M': axis = 'y'; index = 0; direction = 1; break;
            case 'E': axis = 'x'; index = 0; direction = 1; break;
            case 'S': axis = 'z'; index = 0; direction = 1; break;
        }
        if (axis) {
            if (modifier.includes("'")) direction *= -1;
            const isDouble = modifier.includes("2");
            const count = isDouble ? 2 : 1;
            for(let i=0; i<count; i++) moves.push({ axis, index, direction, notation: token });
        }
    }
    return moves;
};

const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
};

// --- Component ---

const RubiksCube: React.FC<RubiksCubeProps> = ({ isGameActive, initialMode, startingLevel, onHome }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string>('Ready');
  const [isBusy, setIsBusy] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [lastMove, setLastMove] = useState<string>('-');
  const [shuffleNotation, setShuffleNotation] = useState<string>('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showScrambleModal, setShowScrambleModal] = useState(false);
  const isMountedRef = useRef(true);
  
  // Custom Scramble State
  const [customScrambleText, setCustomScrambleText] = useState('');
  const [scrambleLength, setScrambleLength] = useState(20);
  const [scrambleTab, setScrambleTab] = useState<'random' | 'custom'>('random');

  // Customization State
  const [faceColors, setFaceColors] = useState(DEFAULT_COLORS);
  const [bgStyle, setBgStyle] = useState(BG_PRESETS[0].value);

  // Level Mode State
  const [isLevelMode, setIsLevelMode] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [maxLevelReached, setMaxLevelReached] = useState(1);
  const [levelComplete, setLevelComplete] = useState(false);
  const [levelStarted, setLevelStarted] = useState(false);
  const hasAutoStartedRef = useRef(false);
  
  // Timer State
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pivotRef = useRef<THREE.Object3D | null>(null);
  const highlightMeshRef = useRef<THREE.Mesh | null>(null);
  
  const cubiesRef = useRef<THREE.Mesh[]>([]);
  const moveHistoryRef = useRef<Move[]>([]);
  const isAnimatingRef = useRef(false);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Load Theme
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) {
        try {
            const parsed = JSON.parse(savedTheme);
            if (parsed.colors) setFaceColors(parsed.colors);
            if (parsed.bg) setBgStyle(parsed.bg);
        } catch (e) { console.error("Failed to load theme", e); }
    }
  }, []);

  // Save Theme
  useEffect(() => {
    const theme = { colors: faceColors, bg: bgStyle };
    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  }, [faceColors, bgStyle]);

  // Update Controls based on Game State
  useEffect(() => {
    if (controlsRef.current) {
        controlsRef.current.autoRotate = !isGameActive;
        controlsRef.current.autoRotateSpeed = 2.0;
        controlsRef.current.enableZoom = isGameActive;
        controlsRef.current.enableRotate = isGameActive;
    }
  }, [isGameActive]);

  // Timer Logic
  useEffect(() => {
    if (isTimerRunning) {
        startTimeRef.current = Date.now() - elapsedTime;
        timerRef.current = window.setInterval(() => {
            setElapsedTime(Date.now() - startTimeRef.current);
        }, 30);
    } else {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }
    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  // --- 3D Initialization ---
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    const aspect = window.innerWidth / window.innerHeight;
    if (aspect < 1) {
        camera.position.set(8.5, 8.5, 12);
    } else {
        camera.position.set(6, 4, 8);
    }
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true, 
        preserveDrawingBuffer: true,
        powerPreference: "high-performance" 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 20;
    controls.autoRotate = !isGameActive;
    controls.autoRotateSpeed = 2.0;
    controls.target.set(0, -2, 0); 
    controlsRef.current = controls;

    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    gridHelper.position.y = -4;
    scene.add(gridHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(10, 20, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x4488ff, 0.6);
    rimLight.position.set(-5, 5, -10);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xffeedd, 0.3);
    fillLight.position.set(-10, -5, 5);
    scene.add(fillLight);

    const pivot = new THREE.Object3D();
    pivot.rotation.order = 'XYZ';
    scene.add(pivot);
    pivotRef.current = pivot;

    const highlightGeo = new THREE.BoxGeometry(1, 1, 1);
    const highlightMat = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0,
        depthWrite: false, 
        side: THREE.DoubleSide
    });
    const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
    highlightMesh.visible = false;
    scene.add(highlightMesh);
    highlightMeshRef.current = highlightMesh;

    // Initial Material Setup
    const colorsToUse = faceColors; 
    const palette = [colorsToUse.R, colorsToUse.L, colorsToUse.U, colorsToUse.D, colorsToUse.F, colorsToUse.B];
    const textures = palette.map(c => createStickerTexture(c));

    materialsRef.current = [
        new THREE.MeshStandardMaterial({ map: textures[0], roughness: 0.2, metalness: 0.0 }),
        new THREE.MeshStandardMaterial({ map: textures[1], roughness: 0.2, metalness: 0.0 }),
        new THREE.MeshStandardMaterial({ map: textures[2], roughness: 0.2, metalness: 0.0 }),
        new THREE.MeshStandardMaterial({ map: textures[3], roughness: 0.2, metalness: 0.0 }),
        new THREE.MeshStandardMaterial({ map: textures[4], roughness: 0.2, metalness: 0.0 }),
        new THREE.MeshStandardMaterial({ map: textures[5], roughness: 0.2, metalness: 0.0 }),
    ];

    const geometry = new RoundedBoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE, 2, 0.08);

    cubiesRef.current = [];
    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                const mesh = new THREE.Mesh(geometry, materialsRef.current);
                mesh.position.set(
                    x * (CUBE_SIZE + SPACING),
                    y * (CUBE_SIZE + SPACING),
                    z * (CUBE_SIZE + SPACING)
                );
                mesh.userData = { initialX: x, initialY: y, initialZ: z };
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                scene.add(mesh);
                cubiesRef.current.push(mesh);
            }
        }
    }

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      
      if (highlightMeshRef.current && highlightMeshRef.current.visible) {
        // @ts-ignore
        const currentOpacity = highlightMeshRef.current.material.opacity;
        if (currentOpacity > 0) {
             // @ts-ignore
            highlightMeshRef.current.material.opacity = Math.max(0, currentOpacity - 0.02);
        } else {
            highlightMeshRef.current.visible = false;
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
        if (!cameraRef.current || !rendererRef.current) return;
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (containerRef.current && rendererRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      geometry.dispose();
      materialsRef.current.forEach(m => {
          m.map?.dispose();
          m.dispose();
      });
      highlightGeo.dispose();
      highlightMat.dispose();
    };
  }, []); 

  // --- Dynamic Color Updates ---
  useEffect(() => {
      if (materialsRef.current.length === 0) return;

      const palette = [faceColors.R, faceColors.L, faceColors.U, faceColors.D, faceColors.F, faceColors.B];
      palette.forEach((color, index) => {
          const mat = materialsRef.current[index];
          if (mat) {
              const oldTex = mat.map;
              const newTex = createStickerTexture(color);
              mat.map = newTex;
              mat.needsUpdate = true;
              if (oldTex) oldTex.dispose();
          }
      });
  }, [faceColors]);


  // --- Logic ---

  const getFaceColor = useCallback((axis: Axis, index: number) => {
    if (index === 0) return null; 
    if (axis === 'x') return index === -1 ? faceColors.U : faceColors.D;
    if (axis === 'y') return index === -1 ? faceColors.L : faceColors.R;
    if (axis === 'z') return index === -1 ? faceColors.B : faceColors.F;
    return null;
  }, [faceColors]);

  const checkSolved = useCallback(() => {
    if (!sceneRef.current) return false;
    
    for (const cube of cubiesRef.current) {
        const targetX = cube.userData.initialX * (CUBE_SIZE + SPACING);
        const targetY = cube.userData.initialY * (CUBE_SIZE + SPACING);
        const targetZ = cube.userData.initialZ * (CUBE_SIZE + SPACING);
        
        if (Math.abs(cube.position.x - targetX) > EPSILON ||
            Math.abs(cube.position.y - targetY) > EPSILON ||
            Math.abs(cube.position.z - targetZ) > EPSILON) {
            return false;
        }
        
        const rotX = Math.abs(cube.rotation.x) % (Math.PI * 2);
        const rotY = Math.abs(cube.rotation.y) % (Math.PI * 2);
        const rotZ = Math.abs(cube.rotation.z) % (Math.PI * 2);
        
        const isZeroX = rotX < EPSILON || Math.abs(rotX - Math.PI * 2) < EPSILON;
        const isZeroY = rotY < EPSILON || Math.abs(rotY - Math.PI * 2) < EPSILON;
        const isZeroZ = rotZ < EPSILON || Math.abs(rotZ - Math.PI * 2) < EPSILON;
        
        if (!isZeroX || !isZeroY || !isZeroZ) return false;
    }
    return true;
  }, []);

  const triggerHighlight = useCallback((axis: Axis, index: number) => {
      const mesh = highlightMeshRef.current;
      if (!mesh) return;
      const color = getFaceColor(axis, index);
      if (color === null) return;
      mesh.visible = true;
      // @ts-ignore
      mesh.material.color.setHex(color);
      // @ts-ignore
      mesh.material.opacity = 0.5;
      const offset = index * (CUBE_SIZE + SPACING);
      const thickness = CUBE_SIZE + 0.1;
      const width = (CUBE_SIZE * 3) + (SPACING * 2) + 0.2;
      if (axis === 'x') {
          mesh.position.set(offset, 0, 0);
          mesh.scale.set(thickness, width, width);
      } else if (axis === 'y') {
          mesh.position.set(0, offset, 0);
          mesh.scale.set(width, thickness, width);
      } else {
          mesh.position.set(0, 0, offset);
          mesh.scale.set(width, width, thickness);
      }
  }, [getFaceColor]);

  const rotateLayer = useCallback(async (
      axis: Axis, 
      index: number, 
      direction: number, 
      duration: number = ANIMATION_SPEED, 
      record: boolean = true, 
      countMove: boolean = false,
      setBusy: boolean = true
  ) => {
    if (isAnimatingRef.current && duration > 0) return;
    
    isAnimatingRef.current = true;
    if (duration > 0 && setBusy) setIsBusy(true);
    if (duration > 0 && countMove) triggerHighlight(axis, index);

    const pivot = pivotRef.current;
    if (!pivot || !sceneRef.current) return;

    const targetCubies: THREE.Mesh[] = [];
    const coordinate = index * (CUBE_SIZE + SPACING);

    cubiesRef.current.forEach(cube => {
        cube.updateMatrixWorld(); 
        if (Math.abs(cube.position[axis] - coordinate) < EPSILON) {
            targetCubies.push(cube);
        }
    });
    
    if (targetCubies.length === 0) {
        console.warn("No cubies selected for rotation, skipping.");
        isAnimatingRef.current = false;
        if (duration > 0 && setBusy) setIsBusy(false);
        return;
    }

    pivot.rotation.set(0, 0, 0);
    pivot.position.set(0, 0, 0);
    pivot.updateMatrixWorld();
    
    targetCubies.forEach(cube => pivot.attach(cube));

    const targetRotation = (Math.PI / 2) * direction * -1;
    const startRotation = 0;
    
    await new Promise<void>(resolve => {
        if (duration === 0) {
            // @ts-ignore
            pivot.rotation[axis] = startRotation + targetRotation;
            resolve();
            return;
        }
        const startTime = performance.now();
        function animate() {
            if (!isMountedRef.current) { resolve(); return; }
            const now = performance.now();
            const progress = Math.min((now - startTime) / duration, 1);
            
            // Subtle Back Ease Out for "snap" effect
            const c1 = 0.8; 
            const c3 = c1 + 1;
            const ease = 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);

            // @ts-ignore
            pivot.rotation[axis] = startRotation + (targetRotation * ease);
            if (progress < 1) requestAnimationFrame(animate);
            else resolve();
        }
        animate();
    });

    if (!isMountedRef.current) return;

    pivot.updateMatrixWorld();
    targetCubies.forEach(cube => {
        sceneRef.current?.attach(cube);
        cube.position.x = Math.round(cube.position.x / (CUBE_SIZE + SPACING)) * (CUBE_SIZE + SPACING);
        cube.position.y = Math.round(cube.position.y / (CUBE_SIZE + SPACING)) * (CUBE_SIZE + SPACING);
        cube.position.z = Math.round(cube.position.z / (CUBE_SIZE + SPACING)) * (CUBE_SIZE + SPACING);
        cube.rotation.x = Math.round(cube.rotation.x / (Math.PI/2)) * (Math.PI/2);
        cube.rotation.y = Math.round(cube.rotation.y / (Math.PI/2)) * (Math.PI/2);
        cube.rotation.z = Math.round(cube.rotation.z / (Math.PI/2)) * (Math.PI/2);
        cube.updateMatrixWorld();
    });
    pivot.rotation.set(0,0,0);

    const notation = getNotation(axis, index, direction);

    if (record) moveHistoryRef.current.push({ axis, index, direction, notation });
    if (countMove) {
        if (!isLevelMode && moveCount === 0 && !isTimerRunning) {
            setIsTimerRunning(true);
        }

        setMoveCount(c => c + 1);
        setLastMove(notation);
        
        if (checkSolved()) {
            setIsTimerRunning(false);
            if (isLevelMode && levelStarted) {
                setLevelComplete(true);
                setLevelStarted(false);
                setToast(`Level ${currentLevel} Complete!`);
                if (currentLevel === maxLevelReached && currentLevel < MAX_LEVELS) {
                    const nextMax = currentLevel + 1;
                    setMaxLevelReached(nextMax);
                    localStorage.setItem(CAMPAIGN_KEY, nextMax.toString());
                }
            } else if (!isLevelMode) {
                 setToast("Solved!");
            }
        }
    }

    isAnimatingRef.current = false;
    if (duration > 0 && setBusy) setIsBusy(false); 
  }, [triggerHighlight, checkSolved, isLevelMode, levelStarted, currentLevel, maxLevelReached, moveCount, isTimerRunning]);

  // --- Reset & Initialization Logic ---
  
  const resetPhysicalCube = useCallback(() => {
    if (sceneRef.current) {
        if (pivotRef.current) {
            pivotRef.current.rotation.set(0,0,0);
            pivotRef.current.position.set(0,0,0);
        }

        cubiesRef.current.forEach(cube => {
             sceneRef.current?.attach(cube); 
             const { initialX, initialY, initialZ } = cube.userData;
             cube.position.set(
                initialX * (CUBE_SIZE + SPACING),
                initialY * (CUBE_SIZE + SPACING),
                initialZ * (CUBE_SIZE + SPACING)
             );
             cube.rotation.set(0, 0, 0);
             cube.updateMatrix();
             cube.updateMatrixWorld();
        });
    }
  }, []);

  const startLevel = useCallback(async (level: number) => {
      if (isAnimatingRef.current) return;
      
      resetPhysicalCube();
      moveHistoryRef.current = [];
      setMoveCount(0);
      setLastMove('-');
      setShuffleNotation('');
      setLevelComplete(false);
      setLevelStarted(false);
      setElapsedTime(0);
      setIsTimerRunning(false);
      
      setIsBusy(true);
      setToast(`Mixing...`);
      
      const axes: Axis[] = ['x', 'y', 'z'];
      const indices = [-1, 0, 1];
      const dirs = [1, -1];
      
      const scrambleDepth = Math.min(30, level + 4); 
      
      const performScrambleMove = async (last?: {axis: Axis, index: number}) => {
          let axis: Axis, index: number, dir: number;
          let attempt = 0;
          do {
               axis = axes[Math.floor(Math.random() * axes.length)];
               index = indices[Math.floor(Math.random() * indices.length)];
               dir = dirs[Math.floor(Math.random() * dirs.length)];
               attempt++;
          } while (attempt < 10 && last && last.axis === axis && last.index === index);
          
          await rotateLayer(axis, index, dir, SHUFFLE_SPEED, false, false, false);
          return { axis, index };
      };

      let lastMoveInfo: { axis: Axis, index: number } | undefined = undefined;

      for (let i = 0; i < scrambleDepth; i++) {
         const move = await performScrambleMove(lastMoveInfo);
         lastMoveInfo = move;
      }
      
      let safetyAttempts = 0;
      while (checkSolved() && safetyAttempts < 5) {
           const move = await performScrambleMove(lastMoveInfo);
           lastMoveInfo = move;
           safetyAttempts++;
      }

      if (isMountedRef.current) {
        setIsBusy(false);
        setLevelStarted(true);
        setIsTimerRunning(true);
        setToast("Solve Level " + level);
      }
  }, [resetPhysicalCube, rotateLayer, checkSolved]);

  // When entering game mode, sync internal state
  // Removed rotateLayer and resetPhysicalCube from deps to prevent infinite reset loops on move
  useEffect(() => {
    if (isGameActive) {
        const targetLevelMode = initialMode === 'campaign';
        setIsLevelMode(targetLevelMode);
        
        resetPhysicalCube();
        moveHistoryRef.current = [];
        setMoveCount(0);
        setLastMove('-');
        setShuffleNotation('');
        setLevelComplete(false);
        setLevelStarted(false);
        setElapsedTime(0);
        setIsTimerRunning(false);

        if (targetLevelMode) {
             setToast("Ready"); 
             const progress = localStorage.getItem(CAMPAIGN_KEY);
             let max = 1;
             if (progress) {
                max = parseInt(progress);
                setMaxLevelReached(max);
             } else {
                 setMaxLevelReached(1);
             }
             if (startingLevel) {
                 setCurrentLevel(startingLevel);
             } else {
                 setCurrentLevel(max);
             }

        } else {
             setToast("Freeplay");
             const saved = localStorage.getItem(STORAGE_KEY);
             if (saved) {
                 try {
                    const data = JSON.parse(saved);
                    if (data.history && Array.isArray(data.history) && data.history.length > 0) {
                         setToast("Resuming...");
                         const restore = async () => {
                            setIsBusy(true);
                            for (const m of data.history) {
                                await rotateLayer(m.axis, m.index, m.direction, 0, true, false, false);
                            }
                            if (isMountedRef.current) {
                                setMoveCount(data.count);
                                setLastMove(data.last);
                                setIsBusy(false);
                                setToast("Ready");
                            }
                         };
                         restore();
                    }
                 } catch(e) { console.error(e); }
             }
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGameActive, initialMode, startingLevel]);
  
  useEffect(() => {
      hasAutoStartedRef.current = false;
  }, [startingLevel]);

  useEffect(() => {
      if (isLevelMode && startingLevel && !hasAutoStartedRef.current && !isBusy) {
          hasAutoStartedRef.current = true;
          const t = setTimeout(() => {
             startLevel(startingLevel);
          }, 300); 
          return () => clearTimeout(t);
      }
  }, [isLevelMode, startingLevel, isBusy, startLevel]);

  useEffect(() => {
    if (isLevelMode) return; 
    const saveState = setTimeout(() => {
        if (moveCount > 0) {
             const state = {
                 history: moveHistoryRef.current,
                 count: moveCount,
                 last: lastMove
             };
             localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }
    }, 500);
    return () => clearTimeout(saveState);
  }, [moveCount, lastMove, isLevelMode]);

  // --- Keyboard Controls ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
          if (isBusy || !isGameActive || showSettings || showScrambleModal) return;
          
          const key = e.key.toUpperCase();
          const isPrime = e.shiftKey;
          const getDir = (baseDir: number) => isPrime ? baseDir * -1 : baseDir;

          if (key === 'L') rotateLayer('y', -1, getDir(1), ANIMATION_SPEED, true, true);
          if (key === 'M') rotateLayer('y', 0, getDir(1), ANIMATION_SPEED, true, true);
          if (key === 'R') rotateLayer('y', 1, getDir(-1), ANIMATION_SPEED, true, true);
          
          if (key === 'U') rotateLayer('x', -1, getDir(-1), ANIMATION_SPEED, true, true);
          if (key === 'E') rotateLayer('x', 0, getDir(1), ANIMATION_SPEED, true, true);
          if (key === 'D') rotateLayer('x', 1, getDir(1), ANIMATION_SPEED, true, true);
          
          if (key === 'F') rotateLayer('z', 1, getDir(-1), ANIMATION_SPEED, true, true);
          if (key === 'S') rotateLayer('z', 0, getDir(1), ANIMATION_SPEED, true, true);
          if (key === 'B') rotateLayer('z', -1, getDir(1), ANIMATION_SPEED, true, true);
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBusy, isGameActive, showSettings, showScrambleModal, rotateLayer]);

  // --- Gestures ---
  useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let pointerDownState: {
          x: number, y: number,
          cubie: THREE.Mesh,
          normal: THREE.Vector3,
          point: THREE.Vector3
      } | null = null;

      const onPointerDown = (e: PointerEvent) => {
          if (!e.isPrimary) return; // Ignore multi-touch for layer rotation
          if (isBusy || !isGameActive || showSettings || showScrambleModal) return;
          
          const rect = rendererRef.current?.domElement.getBoundingClientRect();
          if (!rect || !cameraRef.current) return;
          
          const mouse = new THREE.Vector2(
              ((e.clientX - rect.left) / rect.width) * 2 - 1,
              -((e.clientY - rect.top) / rect.height) * 2 + 1
          );

          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, cameraRef.current);
          
          const intersects = raycaster.intersectObjects(cubiesRef.current);
          if (intersects.length > 0) {
              const inter = intersects[0];
              const normal = inter.face!.normal.clone().transformDirection(inter.object.matrixWorld).round();
              
              pointerDownState = {
                  x: e.clientX,
                  y: e.clientY,
                  cubie: inter.object as THREE.Mesh,
                  normal: normal,
                  point: inter.point
              };
              
              if (controlsRef.current) {
                  controlsRef.current.enableRotate = false;
              }
          }
      };

      const onPointerMove = (e: PointerEvent) => {
          if (!pointerDownState || !e.isPrimary) return;
      };

      const onPointerCancel = (e: PointerEvent) => {
          if (controlsRef.current) {
              controlsRef.current.enableRotate = isGameActive;
          }
          pointerDownState = null;
      };

      const onPointerUp = (e: PointerEvent) => {
          if (!e.isPrimary) return;
          if (controlsRef.current) {
              controlsRef.current.enableRotate = isGameActive;
          }
          
          if (!pointerDownState) return;
          
          const dx = e.clientX - pointerDownState.x;
          const dy = e.clientY - pointerDownState.y;
          
          if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
              pointerDownState = null;
              return;
          }
          
          const swipeVec = new THREE.Vector2(dx, -dy).normalize();
          const n = pointerDownState.normal;
          const candidates: { axis: Axis, dir3D: THREE.Vector3 }[] = [];

          if (Math.abs(n.x) > 0.5) {
              candidates.push({ axis: 'y', dir3D: new THREE.Vector3(0, 1, 0) });
              candidates.push({ axis: 'z', dir3D: new THREE.Vector3(0, 0, 1) });
          } else if (Math.abs(n.y) > 0.5) {
              candidates.push({ axis: 'x', dir3D: new THREE.Vector3(1, 0, 0) });
              candidates.push({ axis: 'z', dir3D: new THREE.Vector3(0, 0, 1) });
          } else if (Math.abs(n.z) > 0.5) {
              candidates.push({ axis: 'x', dir3D: new THREE.Vector3(1, 0, 0) });
              candidates.push({ axis: 'y', dir3D: new THREE.Vector3(0, 1, 0) });
          }

          let bestAxis: Axis | null = null;
          let bestDot = -1;
          let bestSign = 1;

          for (const c of candidates) {
              const tangent = new THREE.Vector3().crossVectors(c.dir3D, n).normalize();
              const p1 = pointerDownState.point.clone();
              const p2 = p1.clone().add(tangent);
              
              p1.project(cameraRef.current!);
              p2.project(cameraRef.current!);
              
              const screenDir = new THREE.Vector2(p2.x - p1.x, p2.y - p1.y).normalize();
              const dot = screenDir.dot(swipeVec);
              
              if (Math.abs(dot) > bestDot) {
                  bestDot = Math.abs(dot);
                  bestAxis = c.axis;
                  bestSign = dot > 0 ? 1 : -1;
              }
          }

          if (bestAxis && bestDot > 0.3) {
              const initialMap = { 'x': 'initialX', 'y': 'initialY', 'z': 'initialZ' };
              // @ts-ignore
              const index = pointerDownState.cubie.userData[initialMap[bestAxis]];
              const rotDir = bestSign > 0 ? -1 : 1;
              
              rotateLayer(bestAxis, index, rotDir, ANIMATION_SPEED, true, true);
          }
          
          pointerDownState = null;
      };

      container.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);

      return () => {
          container.removeEventListener('pointerdown', onPointerDown);
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerCancel);
      };
  }, [isBusy, isGameActive, showSettings, showScrambleModal, rotateLayer]);

  const handleNextLevel = () => {
      if (currentLevel < MAX_LEVELS) {
          const next = currentLevel + 1;
          setCurrentLevel(next);
          startLevel(next);
      }
  };

  const shuffleCube = useCallback(async (length: number = 20) => {
    if (isAnimatingRef.current) return;
    setToast("Mixing...");
    setIsBusy(true);
    setMoveCount(0);
    setLastMove('-');
    setElapsedTime(0);
    setIsTimerRunning(false);
    moveHistoryRef.current = [];
    setShuffleNotation('');
    localStorage.removeItem(STORAGE_KEY); 
    
    const axes: Axis[] = ['x', 'y', 'z'];
    const indices = [-1, 0, 1];
    const dirs = [1, -1];
    const moves: {axis: Axis, index: number, dir: number, notation: string}[] = [];

    for (let i = 0; i < length; i++) {
        const axis = axes[Math.floor(Math.random() * axes.length)];
        const index = indices[Math.floor(Math.random() * indices.length)];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        const notation = getNotation(axis, index, dir);
        moves.push({axis, index, dir, notation});
    }

    setShuffleNotation(moves.map(m => m.notation).join(" "));
    for (const move of moves) {
        await rotateLayer(move.axis, move.index, move.dir, SHUFFLE_SPEED, true, false, false);
    }
    
    if (isMountedRef.current) {
        setToast("Mixed");
        setIsBusy(false);
    }
  }, [rotateLayer]);

  const applyCustomScramble = async () => {
      if (!customScrambleText.trim()) return;
      if (isAnimatingRef.current) return;
      
      const moves = parseScrambleString(customScrambleText);
      if (moves.length === 0) {
          setToast("Invalid Notation");
          return;
      }

      setToast("Processing...");
      setIsBusy(true);
      setMoveCount(0);
      setLastMove('-');
      setElapsedTime(0);
      setIsTimerRunning(false);
      moveHistoryRef.current = [];
      localStorage.removeItem(STORAGE_KEY);
      resetPhysicalCube();

      setShuffleNotation(moves.map(m => m.notation).join(" "));
      
      for (const move of moves) {
          await rotateLayer(move.axis, move.index, move.direction, SHUFFLE_SPEED, true, false, false);
      }

      if (isMountedRef.current) {
          setToast("Custom Mix");
          setIsBusy(false);
          setShowScrambleModal(false);
      }
  };

  const handleApplyRandomScramble = () => {
      resetPhysicalCube();
      setShowScrambleModal(false);
      shuffleCube(scrambleLength);
  };

  const undoMove = useCallback(async () => {
    if (isAnimatingRef.current || moveCount === 0) return;
    const lastMoveData = moveHistoryRef.current.pop();
    if (lastMoveData) {
        setLastMove(getNotation(lastMoveData.axis, lastMoveData.index, lastMoveData.direction * -1));
        await rotateLayer(lastMoveData.axis, lastMoveData.index, lastMoveData.direction * -1, ANIMATION_SPEED, false, false);
        if (isMountedRef.current) {
            setMoveCount(c => Math.max(0, c - 1));
            setToast("Undid move");
            
            if (checkSolved()) {
                setIsTimerRunning(false);
            }
        }
    }
  }, [rotateLayer, moveCount, checkSolved]);

  const resetCube = useCallback(() => {
    if (isBusy) return;
    localStorage.removeItem(STORAGE_KEY);
    moveHistoryRef.current = [];
    setMoveCount(0);
    setLastMove('-');
    setShuffleNotation('');
    setElapsedTime(0);
    setIsTimerRunning(false);
    resetPhysicalCube();
    if (isLevelMode) {
        setLevelStarted(false);
        setLevelComplete(false);
    }
    setToast("Reset Complete");
  }, [isBusy, resetPhysicalCube, isLevelMode]);

  const resetTheme = () => {
      setFaceColors(DEFAULT_COLORS);
      setBgStyle(BG_PRESETS[0].value);
  };

  const handleZoomIn = () => {
    if (controlsRef.current && cameraRef.current) {
        const controls = controlsRef.current;
        const dist = controls.getDistance();
        // Move closer (reduce distance)
        const newDist = Math.max(controls.minDistance, dist / 1.2); 
        
        const offset = new THREE.Vector3().subVectors(cameraRef.current.position, controls.target);
        offset.setLength(newDist);
        
        cameraRef.current.position.copy(controls.target).add(offset);
        controls.update();
    }
  };

  const handleZoomOut = () => {
    if (controlsRef.current && cameraRef.current) {
        const controls = controlsRef.current;
        const dist = controls.getDistance();
        // Move further (increase distance)
        const newDist = Math.min(controls.maxDistance, dist * 1.2); 
        
        const offset = new THREE.Vector3().subVectors(cameraRef.current.position, controls.target);
        offset.setLength(newDist);
        
        cameraRef.current.position.copy(controls.target).add(offset);
        controls.update();
    }
  };

  const handleColorInput = (key: keyof typeof DEFAULT_COLORS, val: string) => {
      const num = parseInt(val.replace('#', '0x'));
      setFaceColors(prev => ({ ...prev, [key]: num }));
  };
  
  // --- Smart Hint Logic ---
  const getCubeState = () => {
    if (!sceneRef.current) return "";
    
    // Raycaster to detect face colors
    const raycaster = new THREE.Raycaster();
    
    // Helper to scan a single position
    const scanAt = (origin: THREE.Vector3, dir: THREE.Vector3) => {
        raycaster.set(origin, dir);
        const intersects = raycaster.intersectObjects(cubiesRef.current);
        if (intersects.length > 0) {
             const matIndex = intersects[0].face?.materialIndex;
             if (matIndex === undefined) return '?';
             const map = ['R', 'L', 'U', 'D', 'F', 'B'];
             return map[matIndex] || '?';
        }
        return '?';
    };

    const d = 1.02; // Distance from center for grid points
    const out = 2.0; // Distance to cast from
    
    let state = "";
    
    // U Face (y=1)
    for(let z of [-d, 0, d]) {
        for(let x of [-d, 0, d]) {
            state += scanAt(new THREE.Vector3(x, out, z), new THREE.Vector3(0, -1, 0)) + " ";
        }
    }
    
    // R Face (x=1)
    for(let y of [d, 0, -d]) {
        for(let z of [d, 0, -d]) {
            state += scanAt(new THREE.Vector3(out, y, z), new THREE.Vector3(-1, 0, 0)) + " ";
        }
    }

    // F Face (z=1)
    for(let y of [d, 0, -d]) {
        for(let x of [-d, 0, d]) {
            state += scanAt(new THREE.Vector3(x, y, out), new THREE.Vector3(0, 0, -1)) + " ";
        }
    }

    // D Face (y=-1)
    for(let z of [d, 0, -d]) {
        for(let x of [-d, 0, d]) {
            state += scanAt(new THREE.Vector3(x, -out, z), new THREE.Vector3(0, 1, 0)) + " ";
        }
    }
    
    // L Face (x=-1)
    for(let y of [d, 0, -d]) {
        for(let z of [-d, 0, d]) {
            state += scanAt(new THREE.Vector3(-out, y, z), new THREE.Vector3(1, 0, 0)) + " ";
        }
    }
    
    // B Face (z=-1)
    for(let y of [d, 0, -d]) {
        for(let x of [d, 0, -d]) {
            state += scanAt(new THREE.Vector3(x, y, -out), new THREE.Vector3(0, 0, 1)) + " ";
        }
    }
    
    return state.trim();
  };

  const handleGetHint = async () => {
      if (isBusy) return;
      setIsBusy(true);
      setToast("Thinking...");
      
      try {
          const state = getCubeState();
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: `You are a Rubik's cube solver. Current state (U R F D L B order): ${state}. What is the single next move to progress solving? standard notation (e.g. R, U', F2). Output JSON: {"nextMove": "R"}`,
              config: {
                responseMimeType: "application/json"
              }
          });
          
          const text = response.text;
          if (text) {
              const json = JSON.parse(text);
              if (json.nextMove) {
                  const moveStr = json.nextMove;
                  setToast(`Hint: ${moveStr}`);
                  
                  // Parse move to trigger highlight
                  const moves = parseScrambleString(moveStr);
                  if (moves.length > 0) {
                      const m = moves[0];
                      triggerHighlight(m.axis, m.index);
                      setTimeout(() => {
                           if (highlightMeshRef.current) highlightMeshRef.current.visible = false;
                      }, 1500);
                  }
              } else {
                  setToast("No hint found");
              }
          }
      } catch (e) {
          console.error(e);
          setToast("AI Error");
      }
      setIsBusy(false);
  };

  // Helper to convert hex number to hex string for input
  const toHexStr = (num: number) => '#' + new THREE.Color(num).getHexString();

  return (
    <div className="relative w-full h-full font-sans select-none">
      <div 
        ref={containerRef} 
        className="w-full h-full absolute top-0 left-0 z-0 touch-none" 
        style={{ background: bgStyle }}
      />

      {/* --- Settings Modal --- */}
      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-pop cursor-default pointer-events-auto">
           <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2"><Palette size={20} className="text-blue-500" /> Customize</h2>
                    <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-6">
                    <div>
                        <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Cube Colors</p>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { k: 'U', l: 'Top' }, { k: 'D', l: 'Bottom' },
                                { k: 'L', l: 'Left' }, { k: 'R', l: 'Right' },
                                { k: 'F', l: 'Front' }, { k: 'B', l: 'Back' }
                            ].map((f) => (
                                <div key={f.k} className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/5">
                                    <input 
                                        type="color" 
                                        value={toHexStr(faceColors[f.k as keyof typeof DEFAULT_COLORS])}
                                        onChange={(e) => handleColorInput(f.k as keyof typeof DEFAULT_COLORS, e.target.value)}
                                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none p-0 overflow-hidden" 
                                    />
                                    <span className="text-xs font-bold text-white/80">{f.l}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Environment</p>
                        <div className="grid grid-cols-2 gap-2">
                            {BG_PRESETS.map((preset) => (
                                <button 
                                    key={preset.name}
                                    onClick={() => setBgStyle(preset.value)}
                                    className={`
                                        p-3 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer
                                        ${bgStyle === preset.value ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-white/5 bg-white/5 text-white/60 hover:bg-white/10'}
                                    `}
                                >
                                    <div className="flex justify-between items-center">
                                        {preset.name}
                                        {bgStyle === preset.value && <Check size={12} className="text-blue-400" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <button 
                        onClick={resetTheme}
                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white/60 hover:text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                        <RefreshCw size={14} /> Reset to Defaults
                    </button>
                </div>
           </div>
        </div>
      )}

      {/* --- Scramble Tools Modal --- */}
      {showScrambleModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-pop cursor-default pointer-events-auto">
           <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2"><Settings2 size={20} className="text-emerald-500" /> Scramble Tools</h2>
                    <button onClick={() => setShowScrambleModal(false)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex bg-white/5 rounded-xl p-1 mb-6 border border-white/5">
                    <button 
                        onClick={() => setScrambleTab('random')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${scrambleTab === 'random' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
                    >
                        <Wand2 size={14} /> Generator
                    </button>
                    <button 
                        onClick={() => setScrambleTab('custom')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${scrambleTab === 'custom' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
                    >
                        <Keyboard size={14} /> Custom Input
                    </button>
                </div>

                {scrambleTab === 'random' ? (
                    <div className="space-y-6">
                        <div>
                             <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-white/60 uppercase tracking-widest">Scramble Length</label>
                                <span className="text-emerald-400 font-mono font-bold text-sm">{scrambleLength} Moves</span>
                             </div>
                             <input 
                                type="range" 
                                min="1" 
                                max="50" 
                                value={scrambleLength} 
                                onChange={(e) => setScrambleLength(parseInt(e.target.value))}
                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                             />
                             <div className="flex justify-between text-[10px] text-white/30 mt-1 font-mono">
                                 <span>1</span>
                                 <span>25</span>
                                 <span>50</span>
                             </div>
                        </div>
                        
                        <button 
                            onClick={handleApplyRandomScramble}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 font-bold cursor-pointer transition-all"
                        >
                            <Shuffle size={16} /> Generate & Mix
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4 flex-1 flex flex-col">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-white/60 uppercase tracking-widest mb-2 block">Standard Notation</label>
                            <textarea 
                                value={customScrambleText}
                                onChange={(e) => setCustomScrambleText(e.target.value)}
                                placeholder="e.g. R U R' U' F2 D L"
                                className="w-full h-32 bg-black/20 border border-white/10 rounded-xl p-4 text-white font-mono text-sm focus:outline-none focus:border-emerald-500/50 resize-none"
                            />
                            <p className="text-[10px] text-white/30 mt-2 leading-relaxed">
                                Supports standard WCA notation: R, L, U, D, F, B, M, E, S. <br/>
                                Modifiers: ' (Prime/CCW), 2 (Double).
                            </p>
                        </div>
                        <button 
                            onClick={applyCustomScramble}
                            disabled={!customScrambleText.trim()}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/5 disabled:text-white/20 text-white rounded-xl shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 font-bold cursor-pointer transition-all"
                        >
                            <Check size={16} /> Apply Scramble
                        </button>
                    </div>
                )}
           </div>
        </div>
      )}

      {/* --- UI HUD LAYER --- */}
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ease-out ${isGameActive ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* TOP BAR: Navigation & Info */}
        <div className="absolute top-4 left-4 right-4 z-40 flex justify-between items-center pointer-events-none">
             
             {/* Left Group: Home & Settings */}
             <div className="flex items-center gap-2 pointer-events-auto">
                 <button 
                    onClick={onHome} 
                    className="w-10 h-10 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    title="Return to Menu"
                 >
                     <Home size={18} />
                 </button>
                 <button 
                    onClick={() => setShowSettings(true)} 
                    className="w-10 h-10 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    title="Customize Theme"
                 >
                     <Palette size={18} />
                 </button>
             </div>

             {/* Right Group: Status & Stats Bar */}
             <div className="flex items-center gap-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-2 pl-4 shadow-2xl pointer-events-auto">
                  <span className="text-xs font-bold text-white/60 uppercase tracking-wider mr-2 hidden sm:block">
                      {toast}
                  </span>
                  
                  <div className="w-px h-4 bg-white/10 hidden sm:block"></div>

                  {isLevelMode ? (
                     <div className="flex items-center gap-3">
                         {(levelStarted || levelComplete) && (
                            <div className="flex items-center gap-1.5">
                                <Timer size={14} className={levelComplete ? "text-green-400" : "text-white/60"} />
                                <span className={`text-sm font-mono font-bold ${levelComplete ? "text-green-400" : "text-white"}`}>
                                    {formatTime(elapsedTime)}
                                </span>
                            </div>
                         )}
                         <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                            <span className="text-[10px] text-white/40 font-bold uppercase">LVL</span>
                            <span className="text-sm font-bold text-white">{currentLevel} <span className="text-white/30 text-[10px]">/ {MAX_LEVELS}</span></span>
                         </div>
                     </div>
                  ) : (
                     <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <MoveIcon size={14} className="text-blue-400" />
                            <span className="text-sm font-mono font-bold text-white">{moveCount}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Timer size={14} className={elapsedTime > 0 ? "text-green-400" : "text-white/60"} />
                            <span className={`text-sm font-mono font-bold ${elapsedTime > 0 ? "text-green-400" : "text-white"}`}>
                                {formatTime(elapsedTime)}
                            </span>
                        </div>
                     </div>
                  )}
             </div>
        </div>

        {/* Zoom Controls (Left Center) */}
        <div className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-40 group pointer-events-auto">
            <div className="absolute left-0 top-0 bottom-0 w-full bg-black/20 backdrop-blur-xl -z-10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <button onClick={handleZoomIn} className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white/80 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all active:scale-95 cursor-pointer"><ZoomIn size={18} /></button>
            <button onClick={handleZoomOut} className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white/80 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all active:scale-95 cursor-pointer"><ZoomOut size={18} /></button>
        </div>

        {/* Bottom Control Panel */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-50 pointer-events-auto">
             <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-3 shadow-2xl transition-all duration-300">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} 
                    className="w-full flex justify-center pb-2 text-white/20 hover:text-white/60 transition-colors cursor-pointer"
                  >
                      {isMinimized ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>

                  <div className={`overflow-hidden transition-all duration-300 ${isMinimized ? 'max-h-0 opacity-0' : 'max-h-[350px] opacity-100'}`}>
                       
                        {isLevelMode ? (
                            <div className="mb-3 space-y-2">
                                {levelComplete && (
                                    <button onClick={(e) => { e.stopPropagation(); handleNextLevel(); }} className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl shadow-lg shadow-green-900/40 flex items-center justify-center gap-2 font-bold animate-pop cursor-pointer">
                                        <span>Next Level</span> <ArrowRight size={16} />
                                    </button>
                                )}
                                
                                <div className="grid grid-cols-2 gap-1">
                                    <ActionButton icon={<Undo2 size={14} />} label="Undo" onClick={undoMove} disabled={isBusy || moveCount === 0 || levelComplete} />
                                    {levelStarted ? (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); startLevel(currentLevel); }}
                                            disabled={isBusy}
                                            className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-all duration-200 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 disabled:opacity-50 cursor-pointer"
                                        >
                                            <RefreshCw size={14} />
                                            <span className="text-[8px] font-bold uppercase tracking-wider">Retry</span>
                                        </button>
                                    ) : (
                                        <ActionButton icon={<Trash2 size={14} />} label="Reset" onClick={resetCube} disabled={isBusy} />
                                    )}
                                </div>

                                <div className="pt-2 border-t border-white/5 mt-2">
                                    <ActionButton icon={<Lightbulb size={14} className="text-yellow-400" />} label="AI Hint" onClick={handleGetHint} disabled={isBusy} />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 gap-1 mb-3">
                                <ActionButton icon={<Undo2 size={14} />} label="Undo" onClick={undoMove} disabled={isBusy || moveCount === 0} />
                                <ActionButton icon={<Trash2 size={14} />} label="Reset" onClick={resetCube} disabled={isBusy} />
                                <ActionButton icon={<Shuffle size={14} />} label="Mix" onClick={() => shuffleCube(20)} disabled={isBusy} />
                                <ActionButton icon={<Settings2 size={14} />} label="Tools" onClick={() => setShowScrambleModal(true)} disabled={isBusy} primary />
                            </div>
                        )}
                        
                        {!isLevelMode && (
                             <div className="grid grid-cols-1 gap-1 mb-3">
                                <ActionButton icon={<Lightbulb size={14} className="text-yellow-400" />} label="Get AI Hint" onClick={handleGetHint} disabled={isBusy} />
                             </div>
                        )}

                        {!isLevelMode && shuffleNotation && (
                            <div className="mb-3 px-2 py-1.5 bg-white/5 rounded-lg border border-white/5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Shuffle size={10} className="text-white/40" />
                                    <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Scramble Sequence</span>
                                </div>
                                <p className="text-[10px] font-mono text-white/80 leading-relaxed break-words">
                                    {shuffleNotation}
                                </p>
                            </div>
                        )}

                        <div>
                            <div className="flex items-center gap-1 mb-2 px-1">
                                <RotateCcw size={10} className="text-white/40" />
                                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Manual</span>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-1">
                                <RotateButton label="L" sub="Left" onClick={() => rotateLayer('y', -1, 1, ANIMATION_SPEED, true, true)} disabled={isBusy} color="border-l-2 border-l-orange-500" />
                                <RotateButton label="M" sub="Mid" onClick={() => rotateLayer('y', 0, 1, ANIMATION_SPEED, true, true)} disabled={isBusy} />
                                <RotateButton label="R" sub="Right" onClick={() => rotateLayer('y', 1, -1, ANIMATION_SPEED, true, true)} disabled={isBusy} color="border-r-2 border-r-red-600" />
                                
                                <RotateButton label="U" sub="Up" onClick={() => rotateLayer('x', -1, -1, ANIMATION_SPEED, true, true)} disabled={isBusy} color="border-t-2 border-t-white" />
                                <RotateButton label="E" sub="Equator" onClick={() => rotateLayer('x', 0, 1, ANIMATION_SPEED, true, true)} disabled={isBusy} />
                                <RotateButton label="D" sub="Down" onClick={() => rotateLayer('x', 1, 1, ANIMATION_SPEED, true, true)} disabled={isBusy} color="border-b-2 border-b-yellow-400" />
                                
                                <RotateButton label="F" sub="Front" onClick={() => rotateLayer('z', 1, -1, ANIMATION_SPEED, true, true)} disabled={isBusy} color="border-b-2 border-b-green-600" />
                                <RotateButton label="S" sub="Standing" onClick={() => rotateLayer('z', 0, 1, ANIMATION_SPEED, true, true)} disabled={isBusy} />
                                <RotateButton label="B" sub="Back" onClick={() => rotateLayer('z', -1, 1, ANIMATION_SPEED, true, true)} disabled={isBusy} color="border-t-2 border-t-blue-600" />
                            </div>
                        </div>
                  </div>
             </div>
        </div>
      </div>
    </div>
  );
};

// --- Sub Components ---

interface ActionBtnProps {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled: boolean;
    primary?: boolean;
    className?: string; // Allow overrides
}

const ActionButton: React.FC<ActionBtnProps> = ({ icon, label, onClick, disabled, primary, className }) => (
    <button 
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        disabled={disabled}
        className={`
            flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer
            ${primary 
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40' 
                : 'bg-white/5 hover:bg-white/10 text-white/90 hover:text-white border border-white/10'}
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent
            active:scale-95
            ${className || ''}
        `}
    >
        {icon}
        <span className="text-[8px] font-bold uppercase tracking-wider">{label}</span>
    </button>
);

interface RotateBtnProps {
  label: string;
  sub: string;
  onClick: () => void;
  disabled: boolean;
  color?: string;
}

const RotateButton: React.FC<RotateBtnProps> = ({ label, sub, onClick, disabled, color = "border-transparent" }) => {
    const [isPopping, setIsPopping] = useState(false);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (disabled) return;
        setIsPopping(true);
        onClick();
        setTimeout(() => setIsPopping(false), 200);
    };

    return (
        <button
            onClick={handleClick}
            disabled={disabled}
            className={`
            h-8 rounded-lg bg-white/5 hover:bg-white/10 
            disabled:opacity-30 disabled:cursor-not-allowed
            text-white transition-all border border-white/5
            flex flex-col items-center justify-center relative overflow-hidden ${color}
            ${isPopping ? 'animate-pop bg-white/20' : ''} cursor-pointer
            `}
        >
            <span className="font-mono font-bold text-sm leading-none">{label}</span>
            <span className="text-[7px] text-white/40 font-medium uppercase">{sub}</span>
        </button>
    );
};

export default RubiksCube;