"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const CHART_COLORS = { navy: "#0b1f3a", blue: "#3d5a85", gold: "#f0b429", slate: "#8a94a1", green: "#2b7a55", red: "#b4443a" };

interface Series {
  key: string;
  label: string;
  color?: string;
}

const axis = { fontSize: 11, fill: "#566272" };

function fmt(v: number, kind: "money" | "count") {
  if (kind === "money") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(v);
  }
  return new Intl.NumberFormat("en-US").format(v);
}

export function BarSeries({
  data,
  xKey,
  series,
  kind = "money",
  height = 240,
  horizontal = false,
  stacked = false,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: Series[];
  kind?: "money" | "count";
  height?: number;
  horizontal?: boolean;
  stacked?: boolean;
}) {
  const palette = [CHART_COLORS.navy, CHART_COLORS.gold, CHART_COLORS.blue, CHART_COLORS.slate];
  return (
    <div style={{ height }} role="img" aria-label={`Bar chart: ${series.map((s) => s.label).join(", ")} by ${xKey}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e2dac5" strokeDasharray="3 3" vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={axis} tickFormatter={(v) => fmt(v, kind)} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey={xKey} tick={axis} width={110} axisLine={false} tickLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={axis} axisLine={{ stroke: "#e2dac5" }} tickLine={false} />
              <YAxis tick={axis} tickFormatter={(v) => fmt(v, kind)} axisLine={false} tickLine={false} width={56} />
            </>
          )}
          <Tooltip
            cursor={{ fill: "rgba(11,31,58,0.05)" }}
            formatter={(v) => fmt(Number(v), kind)}
            contentStyle={{ border: "1px solid #e2dac5", background: "#fcfaf5", fontSize: 12, borderRadius: 4 }}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? palette[i % palette.length]} stackId={stacked ? "a" : undefined} radius={0} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AreaSeries({
  data,
  xKey,
  series,
  kind = "money",
  height = 240,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: Series[];
  kind?: "money" | "count";
  height?: number;
}) {
  const palette = [CHART_COLORS.navy, CHART_COLORS.gold, CHART_COLORS.blue];
  return (
    <div style={{ height }} role="img" aria-label={`Trend chart: ${series.map((s) => s.label).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e2dac5" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tick={axis} axisLine={{ stroke: "#e2dac5" }} tickLine={false} />
          <YAxis tick={axis} tickFormatter={(v) => fmt(v, kind)} axisLine={false} tickLine={false} width={56} allowDecimals={false} />
          <Tooltip formatter={(v) => fmt(Number(v), kind)} contentStyle={{ border: "1px solid #e2dac5", background: "#fcfaf5", fontSize: 12, borderRadius: 4 }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => {
            const c = s.color ?? palette[i % palette.length];
            return <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={c} fill={c} fillOpacity={0.14} strokeWidth={2} />;
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data, height = 220 }: { data: { name: string; value: number; color: string }[]; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div style={{ height }} role="img" aria-label={`Distribution: ${data.map((d) => `${d.name} ${d.value}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={1} stroke="#fcfaf5" strokeWidth={2}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v, n) => [`${v} (${total ? Math.round((Number(v) / total) * 100) : 0}%)`, n]} contentStyle={{ border: "1px solid #e2dac5", background: "#fcfaf5", fontSize: 12, borderRadius: 4 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
