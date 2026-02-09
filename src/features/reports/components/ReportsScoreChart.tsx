import React, { useMemo, useState } from 'react';
import { getScoringFramework } from '../../../shared/constants';

interface DataPoint {
  date: string;
  score: number;
  label?: string;
}

interface ReportsScoreChartProps {
  dataPoints: DataPoint[];
  targetLang?: string;
}

const ReportsScoreChart: React.FC<ReportsScoreChartProps> = ({ dataPoints, targetLang }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const framework = targetLang ? getScoringFramework(targetLang) : null;

  const chartData = useMemo(() => {
    if (dataPoints.length === 0) return null;

    // Determine Y-axis scale based on framework
    const yMax = framework ? framework.overallMax : 100;
    const gridValues = framework?.id === 'ielts'
      ? [3, 5, 7]
      : framework?.id === 'hsk'
        ? [2, 3, 4, 5]
        : [25, 50, 75];

    const width = 600;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 35 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const points = dataPoints.map((d, i) => {
      // Convert 0-100 score to framework scale for display
      const displayScore = framework ? framework.fromGenericScore(d.score) : d.score;
      return {
        x: padding.left + (dataPoints.length === 1 ? chartW / 2 : (i / (dataPoints.length - 1)) * chartW),
        y: padding.top + chartH - (displayScore / yMax) * chartH,
        displayScore,
        ...d,
      };
    });

    const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
    const areaPoints = [
      `${points[0].x},${padding.top + chartH}`,
      ...points.map((p) => `${p.x},${p.y}`),
      `${points[points.length - 1].x},${padding.top + chartH}`,
    ].join(' ');

    let pathLength = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      pathLength += Math.sqrt(dx * dx + dy * dy);
    }

    const gridLines = gridValues.map((val) => ({
      y: padding.top + chartH - (val / yMax) * chartH,
      label: val.toString(),
    }));

    // Deduplicate X-axis labels — only show each unique date string once, evenly spaced
    const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const maxLabels = Math.min(6, dataPoints.length);
    const step = Math.max(1, Math.floor(dataPoints.length / maxLabels));
    const candidateLabels = points.filter((_, i) => i % step === 0 || i === points.length - 1);
    // Remove consecutive duplicate date strings
    const xLabels: typeof candidateLabels = [];
    let lastDateStr = '';
    for (const p of candidateLabels) {
      const dateStr = formatDate(p.date);
      if (dateStr !== lastDateStr) {
        xLabels.push(p);
        lastDateStr = dateStr;
      }
    }

    return { width, height, padding, chartH, points, polylinePoints, areaPoints, pathLength, gridLines, xLabels, formatDate };
  }, [dataPoints, framework]);

  if (!chartData || dataPoints.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-stone-400">
        Complete more practice sessions to see your score trend
      </div>
    );
  }

  const { width, height, padding, chartH, points, polylinePoints, areaPoints, pathLength, gridLines, xLabels, formatDate } = chartData;

  // Tooltip label
  const tooltipLabel = framework ? framework.overallLabel : 'Score';

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 sm:h-56">
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7C9CBF" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#7C9CBF" stopOpacity="0.02" />
          </linearGradient>
          <style>{`
            @keyframes drawLine {
              from { stroke-dashoffset: ${pathLength}; }
              to { stroke-dashoffset: 0; }
            }
            .chart-line { animation: drawLine 1s ease-out forwards; }
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            .chart-area { animation: fadeIn 0.8s ease-out 0.3s both; }
          `}</style>
        </defs>

        {/* Grid lines */}
        {gridLines.map((g) => (
          <g key={g.label}>
            <line
              x1={padding.left}
              y1={g.y}
              x2={width - padding.right}
              y2={g.y}
              stroke="#e7e5e4"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text x={padding.left - 8} y={g.y + 4} textAnchor="end" className="text-[10px] fill-stone-400">
              {g.label}
            </text>
          </g>
        ))}

        {/* Baseline */}
        <line
          x1={padding.left}
          y1={padding.top + chartH}
          x2={width - padding.right}
          y2={padding.top + chartH}
          stroke="#d6d3d1"
          strokeWidth="1"
        />

        {/* X-axis labels */}
        {xLabels.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={padding.top + chartH + 18}
            textAnchor="middle"
            className="text-[10px] fill-stone-400"
          >
            {formatDate(p.date)}
          </text>
        ))}

        {/* Area fill */}
        <polygon points={areaPoints} fill="url(#scoreGradient)" className="chart-area" />

        {/* Line */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#7C9CBF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          strokeDashoffset={pathLength}
          className="chart-line"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === i ? 5 : 3}
              fill={hoveredIndex === i ? '#7C9CBF' : 'white'}
              stroke="#7C9CBF"
              strokeWidth="2"
              className="transition-all duration-150 cursor-pointer"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={12}
              fill="transparent"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          </g>
        ))}

        {/* Tooltip */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <g>
            <rect
              x={points[hoveredIndex].x - 40}
              y={points[hoveredIndex].y - 32}
              width="80"
              height="22"
              rx="6"
              fill="#292524"
              opacity="0.9"
            />
            <text
              x={points[hoveredIndex].x}
              y={points[hoveredIndex].y - 17}
              textAnchor="middle"
              className="text-[11px] fill-white font-medium"
            >
              {tooltipLabel}: {framework ? (framework.id === 'hsk' ? Math.round(points[hoveredIndex].displayScore) : points[hoveredIndex].displayScore.toFixed(1)) : points[hoveredIndex].score}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export default ReportsScoreChart;
