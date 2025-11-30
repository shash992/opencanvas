import { BaseEdge, EdgeProps, getBezierPath } from 'reactflow'

export default function RagEdge({
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
          strokeDasharray: '5,5',
          ...style,
        }}
        markerEnd={markerEnd}
      />
    </>
  )
}

