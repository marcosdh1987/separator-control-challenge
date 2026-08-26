"use client";

import { Environment, Html, Lightformer, OrbitControls, ContactShadows } from "@react-three/drei";
import { addAfterEffect, Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { type ComponentRef, useEffect, useRef } from "react";
import { ACESFilmicToneMapping, Color, PointLight, SRGBColorSpace } from "three";

import { AlarmBeacon, alarmPulseFactor } from "./alarm-beacon";
import { ControlValve } from "./control-valve";
import { PhaseVolumes } from "./phase-volumes";
import { ProcessPipe } from "./process-pipe";
import { establishSceneReadiness } from "./scene-readiness";
import { SeparatorVessel } from "./separator-vessel";
import { selectScenePresentation, type ScenePresentationMode } from "./scene-presentation";
import { useSceneQuality, type SceneQuality } from "./use-scene-quality";
import { useMessages } from "@/lib/i18n/provider";
import type { SimulationSample, SimulationStatus } from "@/lib/simulation/types";
import { createSceneModel, PIPE_PATHS, VALVE_POSITIONS } from "@/lib/visualization/scene-model";

interface SeparatorSceneProps {
  sample: SimulationSample;
  status: SimulationStatus;
  resetToken: number;
  mode?: ScenePresentationMode;
  onReady?: () => void;
  onSceneError?: (error: Error) => void;
}

export const DESIGNED_CAMERA_POSITION = [4.8, 2.4, 5.8] as const;
export const DESIGNED_CAMERA_TARGET = [0, 0, 0] as const;

export function SeparatorScene({ sample, status, resetToken, mode = "dashboard", onReady, onSceneError }: SeparatorSceneProps) {
  const presentation = selectScenePresentation(mode, useSceneQuality());
  const quality = presentation.quality;
  const model = createSceneModel(sample);
  // The Canvas mounts its own React reconciler, so context does not cross into it.
  // Resolve every string here and hand them down as props instead.
  const messages = useMessages();
  const safetyText = {
    condition: messages.simulation.safetyCondition[model.safety.condition],
    severity: messages.challenge.status.severity[model.safety.severity].toLocaleUpperCase(),
    safeBadge: messages.challenge.mimic.safeBadge,
    accentLabel: messages.challenge.mimic.sceneAccentLabel,
  };
  const processMotion = presentation.interactive && quality.animateAmbient && model.safety.motionEnabled && status === "running";

  return (
    <Canvas
      className="separator-canvas"
      camera={{ position: [...DESIGNED_CAMERA_POSITION], fov: 36, near: 0.1, far: 50 }}
      dpr={quality.dpr}
      frameloop={presentation.frameloop}
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
      <SceneLights environment={presentation.environment} quality={quality} />
      {presentation.interactive ? <CameraRig resetToken={resetToken} /> : null}
      <group position={[0, 0.16, 0]}>
        <ProcessPipe name="Feed" points={PIPE_PATHS.feed} color="#6ce9db" motion={model.inletFlow} animate={processMotion} quality={quality.tier} />
        <ProcessPipe name="Oil outlet" points={PIPE_PATHS.oil} color="#f2ad4e" motion={model.oilFlow} animate={processMotion} quality={quality.tier} />
        <ProcessPipe name="Water outlet" points={PIPE_PATHS.water} color="#3ecbe6" motion={model.waterFlow} animate={processMotion} quality={quality.tier} />
        <PhaseVolumes model={model} quality={quality} sample={sample} status={status} />
        <SeparatorVessel quality={quality} />
        <ControlValve tag="LV-101" description="Oil outlet valve" openFraction={model.oilValve.openFraction} position={[...VALVE_POSITIONS.oil]} accent="#f2ad4e" compact={quality.tier === "low"} />
        <ControlValve tag="WV-101" description="Water outlet valve" openFraction={model.waterValve.openFraction} position={[...VALVE_POSITIONS.water]} accent="#3ecbe6" compact={quality.tier === "low"} />
        <AlarmBeacon
          safety={model.safety}
          animate={processMotion}
        />
        <SafetyAccent safety={model.safety} animate={processMotion} text={safetyText} />
      </group>
      <mesh position={[0, -1.14, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={quality.shadows}>
        <planeGeometry args={[12, 9]} />
        <meshStandardMaterial color="#071216" metalness={0.08} roughness={0.86} />
      </mesh>
      {presentation.contactShadows ? (
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

interface SafetyAccentText {
  condition: string;
  severity: string;
  safeBadge: string;
  accentLabel: (condition: string) => string;
}

function SafetyAccent({ safety, animate, text }: {
  safety: ReturnType<typeof createSceneModel>["safety"];
  animate: boolean;
  text: SafetyAccentText;
}) {
  const light = useRef<PointLight>(null);
  const phase = useRef(0);
  const color = safety.severity === "trip" ? "#ff4d5d" : safety.severity === "alarm" ? "#ffb04d" : "#2fd5d4";
  useFrame((_, delta) => {
    if (animate && safety.severity === "alarm") phase.current += delta * safety.pulseHz;
    const wave = animate && safety.severity === "alarm" ? alarmPulseFactor(phase.current) : 1;
    if (light.current) light.current.intensity = safety.rimIntensity * wave;
  });
  return (
    <group name={text.accentLabel(text.condition)}>
      <pointLight ref={light} color={color} distance={7} decay={2} position={[2.45, 1.15, -1.9]} />
      {safety.markerY !== null ? (
        <group position={[0, safety.markerY, 0.7]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.14, 0.018, 10, 32]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <Html center position={[0, 0.18, 0]} className="scene-html-anchor" zIndexRange={[18, 0]}>
            <div className={`scene-safety-label is-${safety.severity}`} data-pulsing={animate && safety.severity === "alarm" ? "true" : "false"}>
              <strong>{text.severity}</strong>
              <span>{text.condition}</span>
            </div>
          </Html>
        </group>
      ) : (
        <Html center position={[0, 1.05, 0.72]} className="scene-html-anchor" zIndexRange={[18, 0]}>
          <div className="scene-safety-label is-safe" data-pulsing="false">
            <strong>{text.safeBadge}</strong><span>{text.condition}</span>
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

function SceneLights({ environment, quality }: { environment: boolean; quality: SceneQuality }) {
  return (
    <>
      <ambientLight intensity={0.16} color="#b6d9de" />
      <hemisphereLight args={["#78bdc7", "#171008", 0.36]} />
      <rectAreaLight color="#bce7ef" intensity={quality.tier === "low" ? 4.8 : 6.4} width={4.8} height={2.8} position={[1.4, 3.8, 3.5]} rotation={[-0.65, 0.3, 0.12]} />
      <pointLight color="#ff9f55" intensity={1.7} distance={7} decay={2} position={[-3.2, -0.2, 2.5]} />
      <spotLight color="#24d8df" intensity={2.9} distance={9} angle={0.55} penumbra={0.8} position={[2.8, 1.2, -3.6]} castShadow={quality.shadows} />
      {environment ? <Environment resolution={quality.tier === "high" ? 128 : 64}>
        <Lightformer form="rect" intensity={1.8} color="#bcecf0" position={[0, 4, 3]} scale={[5, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ff9c52" position={[-4, 0, 1]} rotation={[0, Math.PI / 2, 0]} scale={[2, 3, 1]} />
        <Lightformer form="ring" intensity={1.4} color="#16c9d3" position={[2, 1, -4]} scale={[2.5, 2.5, 1]} />
      </Environment> : null}
    </>
  );
}
