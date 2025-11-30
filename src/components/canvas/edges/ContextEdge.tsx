import { BaseEdge, EdgeProps, getBezierPath } from 'reactflow'

export default function ContextEdge({
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
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: 'var(--accent)',
          strokeWidth: 2,
          ...style,
        }}
        markerEnd={markerEnd}
      />
    </>
  )
}

