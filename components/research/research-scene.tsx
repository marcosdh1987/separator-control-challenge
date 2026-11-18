"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect } from "react";
import { ACESFilmicToneMapping, Color, SRGBColorSpace } from "three";

import { ResearchValve } from "./research-valve";
import { PhaseVolumes } from "@/components/scene/phase-volumes";
import { ProcessPipe } from "@/components/scene/process-pipe";
import { SeparatorVessel } from "@/components/scene/separator-vessel";
import { useSceneQuality } from "@/components/scene/use-scene-quality";
import { flowMotion, phaseGeometryFromLevels, PIPE_PATHS, VALVE_POSITIONS } from "@/lib/visualization/scene-model";

/**
 * The separator scene driven by recorded eng_dacs signals.
 *
 * It reuses the vessel, phase volumes and pipes of the training scene, but
 * every number comes from the replay frame: levels, flows, valve command and
 * stem. Nothing here calls the educational engine. The decorative surface
 * ripple of the training scene is switched off, because it would add motion
 * the recording does not contain.
 */

export interface ResearchSceneFrame {
  timeS: number;
  totalPct: number;
  interfacePct: number;
  inletM3H: number;
  oilM3H: number;
  waterM3H: number;
  oilCommandPct: number;
  oilStemPct: number;
  waterCommandPct: number;
  waterStemPct: number;
}

export interface ResearchSceneLabels {
  oilValve: string;
  waterValve: string;
}

interface ResearchSceneProps {
  frame: ResearchSceneFrame;
  labels: ResearchSceneLabels;
  playing: boolean;
  onReady?: () => void;
}

const CAMERA_POSITION = [4.8, 2.4, 5.8] as const;

export function ResearchScene({ frame, labels, playing, onReady }: ResearchSceneProps) {
  const sceneQuality = useSceneQuality();
  const quality = { ...sceneQuality, animateAmbient: false };
  const levelsKnown = Number.isFinite(frame.totalPct) && Number.isFinite(frame.interfacePct);
  const geometry = phaseGeometryFromLevels(frame.totalPct, frame.interfacePct);
  const animatePipes = playing && sceneQuality.animateAmbient;
  const motionSource = { timeS: frame.timeS, total: { processValuePct: frame.totalPct }, flows: { totalInletM3H: frame.inletM3H } };

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return (
    <Canvas
      camera={{ position: [...CAMERA_POSITION], fov: 36, near: 0.1, far: 50 }}
      className="separator-canvas research-canvas"
      dpr={quality.dpr}
      gl={{ antialias: quality.tier !== "low", alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.outputColorSpace = SRGBColorSpace;
        gl.localClippingEnabled = true;
        gl.setClearColor(new Color("#050c10"), 0);
      }}
    >
      <ambientLight color="#b6d9de" intensity={0.3} />
      <hemisphereLight args={["#78bdc7", "#171008", 0.5]} />
      <directionalLight color="#bce7ef" intensity={1.6} position={[2, 4, 3]} />
      <pointLight color="#ff9f55" decay={2} distance={7} intensity={1.4} position={[-3.2, -0.2, 2.5]} />
      <OrbitControls enableDamping enablePan={false} maxAzimuthAngle={0.9} maxDistance={8} maxPolarAngle={1.75} minAzimuthAngle={-0.9} minDistance={4.5} minPolarAngle={0.85} target={[0, 0, 0]} />
      <group position={[0, 0.16, 0]}>
        <ProcessPipe animate={animatePipes} color="#6ce9db" motion={flowMotion(frame.inletM3H)} name="Feed" points={PIPE_PATHS.feed} quality={quality.tier} />
        <ProcessPipe animate={animatePipes} color="#f2ad4e" motion={flowMotion(frame.oilM3H)} name="Oil outlet" points={PIPE_PATHS.oil} quality={quality.tier} />
        <ProcessPipe animate={animatePipes} color="#3ecbe6" motion={flowMotion(frame.waterM3H)} name="Water outlet" points={PIPE_PATHS.water} quality={quality.tier} />
        {levelsKnown ? <PhaseVolumes model={geometry} quality={quality} sample={motionSource} status="paused" /> : null}
        <SeparatorVessel quality={quality} />
        <ResearchValve
          accent="#f2ad4e"
          commandFraction={frame.oilCommandPct / 100}
          compact={quality.tier === "low"}
          label={labels.oilValve}
          labelOffsetX={-0.42}
          position={VALVE_POSITIONS.oil}
          stemFraction={frame.oilStemPct / 100}
          tag="LCV-102"
        />
        <ResearchValve
          accent="#3ecbe6"
          commandFraction={frame.waterCommandPct / 100}
          compact={quality.tier === "low"}
          label={labels.waterValve}
          labelOffsetX={0.28}
          position={VALVE_POSITIONS.water}
          stemFraction={frame.waterStemPct / 100}
          tag="LCV-103"
        />
      </group>
      <mesh position={[0, -1.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 9]} />
        <meshStandardMaterial color="#071216" metalness={0.08} roughness={0.86} />
      </mesh>
    </Canvas>
  );
}
