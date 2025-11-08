'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type GraphDatum = {
  label: string;
  value: number;
};

type ResultGraphProps = {
  data: GraphDatum[];
  barLabel?: string;
};

export default function ResultGraph({ data, barLabel = "Jawaban Benar" }: ResultGraphProps) {
  return (
    <div className="h-80 w-full rounded-3xl border border-slate-200 bg-white p-4 shadow">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, left: 8, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            angle={-30}
            height={60}
            textAnchor="end"
            tick={{ fontSize: 10 }}
          />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" fill="#14532d" name={barLabel} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
