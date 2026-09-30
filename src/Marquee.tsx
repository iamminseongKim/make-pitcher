import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/** One line that slides back and forth when it doesn't fit, instead of being cut off with "…". */
export function Marquee({ children, className = '' }: { children: ReactNode; className?: string }) {
  const boxRef = useRef<HTMLSpanElement>(null), textRef = useRef<HTMLSpanElement>(null)
  const [shift, setShift] = useState(0)
  useLayoutEffect(() => {
    const box = boxRef.current, text = textRef.current
    if (!box || !text) return
    const measure = () => setShift(Math.max(0, Math.ceil(text.scrollWidth - box.clientWidth)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box); ro.observe(text)
    return () => ro.disconnect()
  }, [])
  const run = shift > 2
  return <span ref={boxRef} className={`marquee ${run ? 'run' : ''} ${className}`}
    style={run ? { '--shift': `-${shift}px`, '--dur': `${Math.max(4, 3 + shift / 18).toFixed(1)}s` } as CSSProperties : undefined}>
    <span ref={textRef}>{children}</span>
  </span>
}
