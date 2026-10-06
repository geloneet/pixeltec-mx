/** Decorative stars: the parent owns the localized rating label. */
export function RatingStars() {
  return <span aria-hidden="true" style={{display:'inline-flex', gap:4}}>
    {Array.from({length:5}, (_, index) => <svg key={index} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" focusable="false">
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"/>
    </svg>)}
  </span>;
}
