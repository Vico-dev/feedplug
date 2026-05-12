import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";

interface ChartDatum {
  name?: string;
  value: number;
  [key: string]: string | number | undefined;
}

interface ChartProps {
  data: ChartDatum[];
  type: "line" | "area" | "bar" | "pie";
  title?: string;
  description?: string;
  className?: string;
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
  colors?: string[];
}

const defaultColors = [
  "var(--ink)", // slate-900
  "var(--ink-2)", // slate-800
  "var(--ink-2)", // slate-700
  "var(--ink-2)", // slate-600
  "var(--ink-3)", // slate-500
];

export function Chart({
  data,
  type,
  title,
  description,
  className,
  height = 300,
  showGrid = true,
  showTooltip = true,
  showLegend = false,
  colors = defaultColors,
}: ChartProps) {
  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 20, right: 30, left: 20, bottom: 20 },
    };

    switch (type) {
      case "line":
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />}
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--ink-3)" }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--ink-3)" }}
            />
            {showTooltip && (
              <Tooltip 
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              />
            )}
            {showLegend && <Legend />}
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={colors[0]} 
              strokeWidth={3}
              dot={{ fill: colors[0], strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: colors[0], strokeWidth: 2 }}
            />
          </LineChart>
        );

      case "area":
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />}
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--ink-3)" }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--ink-3)" }}
            />
            {showTooltip && (
              <Tooltip 
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              />
            )}
            {showLegend && <Legend />}
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={colors[0]} 
              fill={`url(#colorGradient)`}
              strokeWidth={2}
            />
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[0]} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={colors[0]} stopOpacity={0.05}/>
              </linearGradient>
            </defs>
          </AreaChart>
        );

      case "bar":
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />}
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--ink-3)" }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--ink-3)" }}
            />
            {showTooltip && (
              <Tooltip 
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              />
            )}
            {showLegend && <Legend />}
            <Bar 
              dataKey="value" 
              fill={colors[0]}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        );

      case "pie":
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            {showTooltip && (
              <Tooltip 
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              />
            )}
            {showLegend && <Legend />}
          </PieChart>
        );

      default:
        return null;
    }
  };

  if (title || description) {
    return (
      <Card className={cn("border-0 shadow-sm", className)}>
        {(title || description) && (
          <CardHeader className="pb-4">
            {title && <CardTitle className="text-lg font-semibold text-slate-900">{title}</CardTitle>}
            {description && <CardDescription className="text-slate-600">{description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent className="pt-0">
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}


