"use client";

import { useMemo } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

import { useMessages } from "@/lib/i18n/provider";
import { DEFAULT_SIMULATION } from "@/lib/simulation/types";
import type { SimulationSample } from "@/lib/simulation/types";

interface TrendChartsProps { samples: SimulationSample[]; }
interface ChartCardProps { title: string; subtitle: string; children: React.ReactNode; }

const tooltipStyle = {
  background: "#0b151a", border: "1px solid #44606a", borderRadius: "2px",
  color: "#f0f6f7", fontSize: "12px",
};
const commonAxis = { axisLine: false, tickLine: false, tick: { fill: "#9aadb2", fontSize: 10 } };
const lineProps = { dot: false, isAnimationActive: false } as const;

function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return <article className="chart-card">
    <div className="chart-heading"><h3>{title}</h3><span>{subtitle}</span></div>
    <div className="chart-frame">{children}</div>
  </article>;
}

export function TrendCharts({ samples }: TrendChartsProps) {
  const copy = useMessages().challenge.trends;
  const s = copy.series;
  const data = useMemo(() => samples.map((sample) => ({
    timeS: sample.timeS,
    totalTruth: sample.total.processValuePct,
    totalMeasurement: sample.total.measuredValuePct,
    totalSetpoint: sample.total.setpointPct,
    interfaceTruth: sample.interface.processValuePct,
    interfaceMeasurement: sample.interface.measuredValuePct,
    interfaceSetpoint: sample.interface.setpointPct,
    totalFeed: sample.flows.totalInletM3H,
    oilIn: sample.flows.oilInletM3H,
    oilOut: sample.flows.oilOutletM3H,
    waterIn: sample.flows.waterInletM3H,
    waterOut: sample.flows.waterOutletM3H,
    waterCut: sample.flows.waterCutFraction * 100,
    oilCommand: sample.total.valveCommandPct,
    oilActual: sample.total.valvePositionPct,
    waterCommand: sample.interface.valveCommandPct,
    waterActual: sample.interface.valvePositionPct,
    pressureTruth: sample.gas?.pressureBarG,
    pressureMeasurement: sample.gas?.measuredPressureBarG,
    pressureSetpoint: sample.gas?.setpointBarG,
    gasIn: sample.gas?.inletSm3H,
    gasOut: sample.gas?.outletSm3H,
  })), [samples]);

  // The pressure charts only make sense once the gas cap is in the run.
  const hasGas = samples.some((sample) => sample.gas !== undefined);

  const axes = <>
    <CartesianGrid stroke="#253940" strokeDasharray="2 5" vertical={false} />
    <XAxis dataKey="timeS" domain={[0, DEFAULT_SIMULATION.durationS]} type="number" unit=" s" {...commonAxis} />
    <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => `${value} s`} />
    <Legend iconType="line" wrapperStyle={{ fontSize: 10 }} />
  </>;

  return <section aria-labelledby="trends-heading" className="panel trends-panel" data-tour="live-trends">
    <div className="panel-heading"><div><p className="eyebrow">Synchronized historian</p><h2 id="trends-heading">Live control trends</h2></div><span className="sample-counter">{samples.length} / 900 samples</span></div>
    <div className="chart-grid">
      <ChartCard title={copy.totalTitle} subtitle={copy.totalSubtitle}>
        <ResponsiveContainer height="100%" width="100%"><LineChart data={data} syncId="separator-history" margin={{ left: -22, right: 8, top: 8 }}>{axes}<YAxis domain={[0, 100]} unit="%" {...commonAxis} />
          <ReferenceLine stroke="#ffcd70" strokeDasharray="6 4" y={25} label="L" /><ReferenceLine stroke="#ffcd70" strokeDasharray="6 4" y={75} label="H" />
          <ReferenceLine stroke="#ff626a" strokeDasharray="2 3" y={10} label="LL" /><ReferenceLine stroke="#ff626a" strokeDasharray="2 3" y={90} label="HH" />
          <Line {...lineProps} dataKey="totalTruth" name={s.trueTotal} stroke="#55e4cf" strokeWidth={2.2} /><Line {...lineProps} dataKey="totalMeasurement" name={s.measuredTotal} stroke="#d8f3f0" strokeDasharray="2 3" /><Line {...lineProps} dataKey="totalSetpoint" name={s.totalSetpoint} stroke="#b6a2ff" strokeDasharray="8 4" />
        </LineChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title={copy.interfaceTitle} subtitle={copy.interfaceSubtitle}>
        <ResponsiveContainer height="100%" width="100%"><LineChart data={data} syncId="separator-history" margin={{ left: -22, right: 8, top: 8 }}>{axes}<YAxis domain={[0, 50]} unit="%" {...commonAxis} />
          <ReferenceLine stroke="#ffcd70" strokeDasharray="6 4" y={8} label="L" /><ReferenceLine stroke="#ffcd70" strokeDasharray="6 4" y={35} label="H" />
          <ReferenceLine stroke="#ff626a" strokeDasharray="2 3" y={3} label="LL" /><ReferenceLine stroke="#ff626a" strokeDasharray="2 3" y={45} label="HH" />
          <Line {...lineProps} dataKey="interfaceTruth" name={s.trueInterface} stroke="#28bff2" strokeWidth={2.2} /><Line {...lineProps} dataKey="interfaceMeasurement" name={s.measuredInterface} stroke="#d8f3f0" strokeDasharray="2 3" /><Line {...lineProps} dataKey="interfaceSetpoint" name={s.interfaceSetpoint} stroke="#b6a2ff" strokeDasharray="8 4" />
        </LineChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title={copy.flowsTitle} subtitle={copy.flowsSubtitle}>
        <ResponsiveContainer height="100%" width="100%"><LineChart data={data} syncId="separator-history" margin={{ left: -18, right: -16, top: 8 }}>{axes}<YAxis domain={[0, 120]} unit=" m³/h" yAxisId="flow" {...commonAxis} /><YAxis domain={[0, 100]} orientation="right" unit="%" yAxisId="cut" {...commonAxis} />
          <Line {...lineProps} dataKey="totalFeed" name={s.totalFeed} stroke="#f2f6f7" strokeWidth={2} yAxisId="flow" /><Line {...lineProps} dataKey="oilIn" name={s.oilIn} stroke="#f7a93d" yAxisId="flow" /><Line {...lineProps} dataKey="oilOut" name={s.oilOut} stroke="#f7a93d" strokeDasharray="7 3" yAxisId="flow" /><Line {...lineProps} dataKey="waterIn" name={s.waterIn} stroke="#28bff2" yAxisId="flow" /><Line {...lineProps} dataKey="waterOut" name={s.waterOut} stroke="#28bff2" strokeDasharray="7 3" yAxisId="flow" /><Line {...lineProps} dataKey="waterCut" name={s.waterCut} stroke="#b6a2ff" strokeDasharray="2 4" yAxisId="cut" />
        </LineChart></ResponsiveContainer>
      </ChartCard>
      {hasGas ? (
        <ChartCard title={copy.pressureTitle} subtitle={copy.pressureSubtitle}>
          <ResponsiveContainer height="100%" width="100%"><LineChart data={data} syncId="separator-history" margin={{ left: -22, right: 8, top: 8 }}>
            {axes}
            <YAxis domain={["auto", "auto"]} unit=" barg" {...commonAxis} />
            <Line {...lineProps} dataKey="pressureTruth" name={s.truePressure} stroke="#ffb45c" strokeWidth={2.2} />
            <Line {...lineProps} dataKey="pressureMeasurement" name={s.measuredPressure} stroke="#ffe0b8" strokeDasharray="2 3" />
            <Line {...lineProps} dataKey="pressureSetpoint" name={s.pressureSetpoint} stroke="#b6a2ff" strokeDasharray="8 4" />
          </LineChart></ResponsiveContainer>
        </ChartCard>
      ) : null}
      {hasGas ? (
        <ChartCard title={copy.gasFlowsTitle} subtitle={copy.gasFlowsSubtitle}>
          <ResponsiveContainer height="100%" width="100%"><LineChart data={data} syncId="separator-history" margin={{ left: -6, right: 8, top: 8 }}>
            {axes}
            <YAxis domain={[0, "auto"]} {...commonAxis} />
            <Line {...lineProps} dataKey="gasIn" name={s.gasIn} stroke="#78e8dc" strokeWidth={2} />
            <Line {...lineProps} dataKey="gasOut" name={s.gasOut} stroke="#78e8dc" strokeDasharray="7 3" />
          </LineChart></ResponsiveContainer>
        </ChartCard>
      ) : null}
      <ChartCard title={copy.valvesTitle} subtitle={copy.valvesSubtitle}>
        <ResponsiveContainer height="100%" width="100%"><LineChart data={data} syncId="separator-history" margin={{ left: -22, right: 8, top: 8 }}>{axes}<YAxis domain={[0, 100]} unit="%" {...commonAxis} />
          <Line {...lineProps} dataKey="oilCommand" name={s.oilCommand} stroke="#f7a93d" strokeDasharray="3 3" /><Line {...lineProps} dataKey="oilActual" name={s.oilActual} stroke="#f7a93d" strokeWidth={2.2} /><Line {...lineProps} dataKey="waterCommand" name={s.waterCommand} stroke="#28bff2" strokeDasharray="3 3" /><Line {...lineProps} dataKey="waterActual" name={s.waterActual} stroke="#28bff2" strokeWidth={2.2} />
        </LineChart></ResponsiveContainer>
      </ChartCard>
    </div>
    <p className="sr-only">Four synchronized trends compare both controlled levels, phase flows, water cut, and both valve responses.</p>
  </section>;
}
