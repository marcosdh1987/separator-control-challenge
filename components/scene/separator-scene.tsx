"use client";

import { Environment, Html, Lightformer, OrbitControls, ContactShadows } from "@react-three/drei";
import { addAfterEffect, Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { type ComponentRef, useEffect, useRef } from "react";
import { ACESFilmicToneMapping, Color, PointLight, SRGBColorSpace } from "three";

import { AlarmBeacon } from "./alarm-beacon";
import { ControlValve } from "./control-valve";
import { PhaseVolumes } from "./phase-volumes";
import { ProcessPipe, type PipePoint } from "./process-pipe";
import { establishSceneReadiness } from "./scene-readiness";
import { SeparatorVessel } from "./separator-vessel";
import { useSceneQuality, type SceneQuality } from "./use-scene-quality";
import type { SimulationSample, SimulationStatus } from "@/lib/simulation/types";
import { createSceneModel } from "@/lib/visualization/scene-model";

interface SeparatorSceneProps {
  sample: SimulationSample;
  status: SimulationStatus;
  resetToken: number;
  onReady?: () => void;
  onSceneError?: (error: Error) => void;
}

export const DESIGNED_CAMERA_POSITION = [4.8, 2.4, 5.8] as const;
export const DESIGNED_CAMERA_TARGET = [0, 0, 0] as const;

const FEED_PATH = [
  [-2.9, 1.38, -0.18],
  [-2.15, 1.38, -0.18],
  [-1.55, 1.2, -0.08],
  [-0.95, 1.05, 0],
] as const satisfies readonly PipePoint[];
const OIL_PATH = [
  [0.82, -1.05, 0],
  [1.2, -1.2, 0.05],
  [1.75, -1.2, 0.18],
  [2.85, -1.2, 0.18],
] as const satisfies readonly PipePoint[];
const WATER_PATH = [
  [-0.1, -1.05, 0],
  [-0.42, -1.36, 0.12],
  [-1.25, -1.42, 0.3],
  [-2.72, -1.42, 0.3],
] as const satisfies readonly PipePoint[];

export function SeparatorScene({ sample, status, resetToken, onReady, onSceneError }: SeparatorSceneProps) {
  const quality = useSceneQuality();
  const model = createSceneModel(sample);
  const processMotion = quality.animateAmbient && model.safety.motionEnabled && status === "running";

  return (
    <Canvas
      className="separator-canvas"
      camera={{ position: [...DESIGNED_CAMERA_POSITION], fov: 36, near: 0.1, far: 50 }}
      dpr={quality.dpr}
      gl={{
        antialias: quality.tier !== "low",
        alpha: true,
        powerPreference: "high-performance",
      }}
      shadows={quality.shadows}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.outputColorSpace = SRGBColorSpace;
        gl.localClippingEnabled = true;
        gl.setClearColor(new Color("#050c10"), 0);
      }}
    >
      <fog attach="fog" args={["#071116", 6, 13]} />
      <SceneLights quality={quality} />
      <CameraRig resetToken={resetToken} />
      <group position={[0, 0.16, 0]}>
        <ProcessPipe name="Feed" points={FEED_PATH} color="#6ce9db" motion={model.inletFlow} animate={processMotion} quality={quality.tier} />
        <ProcessPipe name="Oil outlet" points={OIL_PATH} color="#f2ad4e" motion={model.oilFlow} animate={processMotion} quality={quality.tier} />
        <ProcessPipe name="Water outlet" points={WATER_PATH} color="#3ecbe6" motion={model.waterFlow} animate={processMotion} quality={quality.tier} />
        <PhaseVolumes model={model} quality={quality} sample={sample} status={status} />
        <SeparatorVessel quality={quality} />
        <ControlValve tag="LV-101" description="Oil outlet valve" openFraction={model.oilValve.openFraction} position={[2.05, -1.2, 0.18]} accent="#f2ad4e" compact={quality.tier === "low"} />
        <ControlValve tag="WV-101" description="Water outlet valve" openFraction={model.waterValve.openFraction} position={[-1.55, -1.42, 0.3]} accent="#3ecbe6" compact={quality.tier === "low"} />
        <AlarmBeacon
          safety={model.safety}
          animate={processMotion}
        />
        <SafetyAccent safety={model.safety} animate={processMotion} />
      </group>
      <mesh position={[0, -1.14, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={quality.shadows}>
        <planeGeometry args={[12, 9]} />
        <meshStandardMaterial color="#071216" metalness={0.08} roughness={0.86} />
      </mesh>
      {quality.shadows ? (
        <ContactShadows position={[0, -1.125, 0]} opacity={0.42} scale={6.5} blur={2.7} far={3.2} resolution={quality.tier === "high" ? 512 : 256} />
      ) : null}
      {quality.postprocessing ? (
        <EffectComposer multisampling={quality.tier === "high" ? 4 : 0}>
          <Bloom intensity={0.32} luminanceThreshold={0.92} luminanceSmoothing={0.12} mipmapBlur />
          <Vignette eskil={false} offset={0.22} darkness={0.46} />
        </EffectComposer>
      ) : null}
      <PostRenderReadiness onError={onSceneError} onReady={onReady} />
    </Canvas>
  );
}

function SafetyAccent({ safety, animate }: { safety: ReturnType<typeof createSceneModel>["safety"]; animate: boolean }) {
  const light = useRef<PointLight>(null);
  const phase = useRef(0);
  const color = safety.severity === "trip" ? "#ff4d5d" : safety.severity === "alarm" ? "#ffb04d" : "#2fd5d4";
  useFrame((_, delta) => {
    if (animate && safety.severity === "alarm") phase.current += delta * safety.pulseHz;
    const wave = animate && safety.severity === "alarm" ? 0.84 + 0.16 * Math.sin(phase.current * Math.PI * 2) : 1;
    if (light.current) light.current.intensity = safety.rimIntensity * wave;
  });
  return (
    <group name={`Safety accent: ${safety.label}`}>
      <pointLight ref={light} color={color} distance={7} decay={2} position={[2.45, 1.15, -1.9]} />
      {safety.markerY !== null ? (
        <group position={[0, safety.markerY, 0.7]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.14, 0.018, 10, 32]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <Html center position={[0, 0.18, 0]} className="scene-html-anchor" zIndexRange={[18, 0]}>
            <div className={`scene-safety-label is-${safety.severity}`} data-pulsing={animate && safety.severity === "alarm" ? "true" : "false"}>
              <strong>{safety.severity.toUpperCase()}</strong>
              <span>{safety.label}</span>
            </div>
          </Html>
        </group>
      ) : (
        <Html center position={[0, 1.05, 0.72]} className="scene-html-anchor" zIndexRange={[18, 0]}>
          <div className="scene-safety-label is-safe" data-pulsing="false">
            <strong>SAFE</strong><span>{safety.label}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

function CameraRig({ resetToken }: { resetToken: number }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(...DESIGNED_CAMERA_POSITION);
    camera.lookAt(...DESIGNED_CAMERA_TARGET);
    controls.current?.target.set(...DESIGNED_CAMERA_TARGET);
    controls.current?.update();
  }, [camera, resetToken]);

  return (
    <OrbitControls
      ref={controls}
      target={[...DESIGNED_CAMERA_TARGET]}
      enableDamping
      dampingFactor={0.075}
      enablePan={false}
      minDistance={4.5}
      maxDistance={8}
      minPolarAngle={0.85}
      maxPolarAngle={1.75}
      minAzimuthAngle={-0.9}
      maxAzimuthAngle={0.9}
    />
  );
}

function PostRenderReadiness({
  onReady,
  onError,
}: {
  onReady?: () => void;
  onError?: (error: Error) => void;
}) {
  const { camera, gl, invalidate, scene } = useThree();

  useEffect(() => establishSceneReadiness(
    {
      compile: async () => { await gl.compileAsync(scene, camera); },
      invalidate,
      subscribeAfterRender: (callback) => addAfterEffect(callback),
      currentFrame: () => gl.info.render.frame,
      isContextLost: () => gl.getContext().isContextLost(),
    },
    {
      onReady: () => onReady?.(),
      onError: (error) => onError?.(error),
    },
  ), [camera, gl, invalidate, onError, onReady, scene]);

  return null;
}

function SceneLights({ quality }: { quality: SceneQuality }) {
  return (
    <>
      <ambientLight intensity={0.16} color="#b6d9de" />
      <hemisphereLight args={["#78bdc7", "#171008", 0.36]} />
      <rectAreaLight color="#bce7ef" intensity={quality.tier === "low" ? 4.8 : 6.4} width={4.8} height={2.8} position={[1.4, 3.8, 3.5]} rotation={[-0.65, 0.3, 0.12]} />
      <pointLight color="#ff9f55" intensity={1.7} distance={7} decay={2} position={[-3.2, -0.2, 2.5]} />
      <spotLight color="#24d8df" intensity={2.9} distance={9} angle={0.55} penumbra={0.8} position={[2.8, 1.2, -3.6]} castShadow={quality.shadows} />
      <Environment resolution={quality.tier === "high" ? 128 : 64}>
        <Lightformer form="rect" intensity={1.8} color="#bcecf0" position={[0, 4, 3]} scale={[5, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ff9c52" position={[-4, 0, 1]} rotation={[0, Math.PI / 2, 0]} scale={[2, 3, 1]} />
        <Lightformer form="ring" intensity={1.4} color="#16c9d3" position={[2, 1, -4]} scale={[2.5, 2.5, 1]} />
      </Environment>
    </>
  );
}
