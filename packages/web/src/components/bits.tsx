export function LoadingRows({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div className="loading" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="loading-row" />
      ))}
    </div>
  );
}

export function LoadError({ what, error, retry }: { what: string; error: string; retry: () => void }) {
  // An id that doesn't exist (a stale link): v1's plain "Not found", not the raw server words.
  if (/^Unknown (job|step|shipment|photo|template|trade)\b/.test(error)) {
    return (
      <div className="load-error" role="alert" data-testid="not-found">
        <p className="load-error__title">Not found</p>
        <p>Nothing at this address.</p>
        <a className="btn btn--desktop" href="#/">
          Overview
        </a>
      </div>
    );
  }
  return (
    <div className="load-error" role="alert">
      <p>
        Couldn't load {what}. {error}
      </p>
      <button type="button" className="btn" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
