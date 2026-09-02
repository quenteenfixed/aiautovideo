// EChartComponent.tsx — ECharts 集成组件
// 在 Remotion 中渲染 ECharts 图表，支持动画进度同步
import React, { useEffect, useRef, useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import * as echarts from 'echarts';
import type { TemplateConfig, ChartType } from '../types/script';

interface EChartComponentProps {
  chartType: ChartType;
  data: Record<string, any>;
  template: TemplateConfig;
  width?: number;
  height?: number;
}

export const EChartComponent: React.FC<EChartComponentProps> = ({
  chartType,
  data,
  template,
  width = 800,
  height = 500,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Animation progress (0 to 1 over first 2 seconds)
  const animProgress = interpolate(frame, [0, fps * 2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Build ECharts option based on chart type
  const option = useMemo(() => {
    return buildEChartsOption(chartType, data, template, animProgress);
  }, [chartType, data, template, animProgress]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = echarts.init(containerRef.current, undefined, {
      renderer: 'svg',
      width,
      height,
    });
    chartRef.current = chart;

    return () => {
      chart.dispose();
      chartRef.current = null;
    };
  }, [width, height]);

  // Update chart option when frame changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setOption(option, {
        notMerge: true,
      });
    }
  }, [option]);

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  );
};

// Build ECharts option based on chart type and data
function buildEChartsOption(
  chartType: ChartType,
  data: Record<string, any>,
  template: TemplateConfig,
  progress: number
): echarts.EChartsOption {
  const colors = template.chart_colors;
  const labels: string[] = data.labels || [];
  const values: number[] = data.values || [];
  const title = data.title;
  const yLabel = data.y_axis_label;

  const baseOption: any = {
    backgroundColor: 'transparent',
    textStyle: {
      color: template.text_color,
      fontFamily: template.body_font,
    },
    title: title ? {
      text: title,
      left: 'center',
      top: 10,
      textStyle: {
        color: template.text_color,
        fontSize: 28,
        fontFamily: template.title_font,
      },
    } : undefined,
    grid: {
      top: title ? 80 : 40,
      bottom: 80,
      left: 60,
      right: 40,
    },
    tooltip: { show: false },
    animation: false,
  };

  switch (chartType) {
    case 'bar': {
      const visibleCount = Math.ceil(values.length * progress);
      const visibleValues = values.map((v, i) =>
        i < visibleCount ? v : Math.round(v * Math.min(1, Math.max(0, progress - i * (1 / values.length)) * values.length))
      );
      return {
        ...baseOption,
        xAxis: {
          type: 'category',
          data: labels,
          axisLine: { lineStyle: { color: template.card_border } },
          axisLabel: { color: template.text_color, fontSize: 18 },
        },
        yAxis: {
          type: 'value',
          name: yLabel || '',
          axisLine: { lineStyle: { color: template.card_border } },
          axisLabel: { color: template.text_color, fontSize: 16 },
          splitLine: { lineStyle: { color: template.card_border, opacity: 0.3 } },
        },
        series: [{
          type: 'bar',
          data: visibleValues.map((v: number, i: number) => ({
            value: v,
            itemStyle: {
              color: colors[i % colors.length],
              borderRadius: [8, 8, 0, 0],
            },
          })),
          barWidth: '50%',
          label: {
            show: true,
            position: 'top',
            color: template.text_color,
            fontSize: 20,
            fontWeight: 'bold',
          },
        }],
      };
    }

    case 'line': {
      const visibleCount = Math.ceil(labels.length * progress);
      return {
        ...baseOption,
        xAxis: {
          type: 'category',
          data: labels,
          axisLine: { lineStyle: { color: template.card_border } },
          axisLabel: { color: template.text_color, fontSize: 18 },
        },
        yAxis: {
          type: 'value',
          name: yLabel || '',
          axisLine: { lineStyle: { color: template.card_border } },
          axisLabel: { color: template.text_color, fontSize: 16 },
          splitLine: { lineStyle: { color: template.card_border, opacity: 0.3 } },
        },
        series: [{
          type: 'line',
          data: values.slice(0, visibleCount),
          smooth: true,
          symbol: 'circle',
          symbolSize: 12,
          lineStyle: { color: colors[0], width: 3 },
          itemStyle: { color: colors[0] },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: `${colors[0]}66` },
                { offset: 1, color: `${colors[0]}11` },
              ],
            },
          },
          label: {
            show: true,
            color: template.text_color,
            fontSize: 18,
          },
        }],
      };
    }

    case 'pie': {
      const pieData = labels.map((label, i) => ({
        name: label,
        value: values[i] || 0,
        itemStyle: { color: colors[i % colors.length] },
      }));
      return {
        ...baseOption,
        series: [{
          type: 'pie',
          radius: progress > 0.5 ? ['40%', '70%'] : ['0%', '70%'],
          center: ['50%', '55%'],
          data: pieData,
          label: {
            show: true,
            color: template.text_color,
            fontSize: 20,
            formatter: '{b}\n{c}%',
          },
          labelLine: {
            lineStyle: { color: template.card_border },
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 20,
              shadowColor: 'rgba(0,0,0,0.3)',
            },
          },
        }],
      };
    }

    case 'scatter': {
      const scatterData = data.points || values.map((v, i) => [i, v]);
      const visibleCount = Math.ceil(scatterData.length * progress);
      return {
        ...baseOption,
        xAxis: {
          type: 'value',
          axisLine: { lineStyle: { color: template.card_border } },
          axisLabel: { color: template.text_color, fontSize: 16 },
        },
        yAxis: {
          type: 'value',
          axisLine: { lineStyle: { color: template.card_border } },
          axisLabel: { color: template.text_color, fontSize: 16 },
          splitLine: { lineStyle: { color: template.card_border, opacity: 0.3 } },
        },
        series: [{
          type: 'scatter',
          data: scatterData.slice(0, visibleCount),
          symbolSize: (val: number[]) => val[1] || 20,
          itemStyle: { color: colors[0], opacity: 0.7 },
        }],
      };
    }

    case 'radar': {
      const maxVal = Math.max(...values, 100);
      return {
        ...baseOption,
        radar: {
          indicator: labels.map((label: string) => ({ name: label, max: maxVal })),
          axisName: { color: template.text_color, fontSize: 18 },
          splitLine: { lineStyle: { color: template.card_border, opacity: 0.5 } },
          splitArea: { areaStyle: { color: ['transparent', `${template.primary_color}11`] } },
          axisLine: { lineStyle: { color: template.card_border } },
        },
        series: [{
          type: 'radar',
          data: [{
            value: values.map(v => v * progress),
            name: title || '',
            itemStyle: { color: colors[0] },
            areaStyle: { color: `${colors[0]}44` },
            lineStyle: { width: 3, color: colors[0] },
          }],
        }],
      };
    }

    case 'spectrum': {
      const spectrumData = values.map((v, i) => ({
        value: v * Math.min(1, progress * 2 + i * 0.05),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: colors[0] },
              { offset: 0.5, color: colors[1] || colors[0] },
              { offset: 1, color: colors[2] || colors[0] },
            ],
          },
        },
      }));
      return {
        ...baseOption,
        xAxis: { type: 'category', data: labels, show: false },
        yAxis: { type: 'value', show: false, max: Math.max(...values) * 1.2 },
        series: [{
          type: 'bar',
          data: spectrumData,
          barWidth: '80%',
          itemStyle: { borderRadius: [4, 4, 0, 0] },
        }],
      };
    }

    default:
      return baseOption;
  }
}
