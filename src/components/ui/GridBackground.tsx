import './GridBackground.css'

interface GridBackgroundProps {
  className?: string
}

export default function GridBackground({ className = '' }: GridBackgroundProps) {
  return (
    <div className={`grid-background ${className}`} aria-hidden="true">
      <svg className="grid-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="grid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="var(--grid-color)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  )
}

