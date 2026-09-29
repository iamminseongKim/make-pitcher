/** ACE PROJECT mark: a home-plate shield holding a stitched ball, with a strike-zone tick. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return <svg className="logo-mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
    <defs>
      <linearGradient id="ace-shield" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffb400" /><stop offset="1" stopColor="#ff7a00" /></linearGradient>
    </defs>
    <path d="M6 4h28v18L20 37 6 22z" fill="#0b1220" stroke="url(#ace-shield)" strokeWidth="2.6" strokeLinejoin="round" />
    <circle cx="20" cy="17" r="8.2" fill="#f5f8fc" />
    <path d="M14.4 11.4c2.4 3.4 2.4 7.8 0 11.2M25.6 11.4c-2.4 3.4-2.4 7.8 0 11.2" fill="none" stroke="#ff4d5e" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M30 6.5v5M27.5 9h5" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
}

export function Logo({ sub }: { sub?: string }) {
  return <div className="logo">
    <LogoMark />
    <div className="logo-type">
      <strong>ACE<span>PROJECT</span></strong>
      {sub && <small>{sub}</small>}
    </div>
  </div>
}
