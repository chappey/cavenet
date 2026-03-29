import * as React from 'react';
import { ResponsiveContainer, Tooltip } from 'recharts';

import { cn } from '../../lib/utils';

export type ChartConfig = Record<string, {
  label: string;
  color: string;
}>;

const ChartConfigContext = React.createContext<ChartConfig | null>(null);

export function useChartConfig() {
  const config = React.useContext(ChartConfigContext);
  if (!config) {
    throw new Error('useChartConfig must be used within ChartContainer');
  }
  return config;
}

export const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { config: ChartConfig }
>(({ className, config, children, ...props }, ref) => {
  return (
    <ChartConfigContext.Provider value={config}>
      <div
        ref={ref}
        className={cn('rounded-2xl border border-cave-500/80 bg-cave-800/80 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.25)]', className)}
        {...props}
      >
        {children}
      </div>
    </ChartConfigContext.Provider>
  );
});
ChartContainer.displayName = 'ChartContainer';

export function ChartTooltipContent({ active, payload, label }: any) {
  const config = useChartConfig();

  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-cave-500 bg-cave-900/95 px-3 py-2 text-sm shadow-2xl backdrop-blur">
      {label && <div className="mb-1 text-xs uppercase tracking-[0.08em] text-cave-300">{label}</div>}
      <div className="space-y-1">
        {payload.map((item: any) => {
          const key = String(item.dataKey);
          const entry = config[key] ?? { label: key, color: item.color ?? 'var(--color-fire-hot)' };
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-cave-100">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{entry.label}</span>
              </div>
              <span className="font-semibold text-white">{Number(item.value).toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { ResponsiveContainer, Tooltip };
