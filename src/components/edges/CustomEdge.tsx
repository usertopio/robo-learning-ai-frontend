import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps
} from '@xyflow/react';

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    setEdges((edges) => edges.filter((e) => e.id !== id));
  };

  return (
    <>
      {/* Background interaction path (invisible but wide for easier clicking) */}
      <BaseEdge 
        path={edgePath} 
        style={{ ...style, strokeWidth: 20, stroke: 'transparent' }} 
      />
      {/* Visible path */}
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{ 
          ...style, 
          strokeWidth: 3, 
          stroke: style.stroke || '#94a3b8',
          transition: 'stroke-width 0.2s, stroke 0.2s'
        }} 
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            fontSize: 14,
            pointerEvents: 'all',
            zIndex: 20,
          }}
          className="nodrag nopan"
        >
          <button
            className="w-5 h-5 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm transition-all cursor-pointer font-bold leading-none pb-[2px]"
            onClick={onEdgeClick}
            title="Delete connection"
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
