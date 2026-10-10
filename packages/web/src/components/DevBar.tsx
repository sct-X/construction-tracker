/** Mock mode only (the Pages demo): move "today" and put the seed back. Nothing else lives here. */
import { useEffect, useState } from 'react';
import { isISODate } from '@ct/core';
import { useData } from '../data/DataContext';

export function DevBar() {
  const { dev, refresh, version } = useData();
  const [today, setToday] = useState('');
  useEffect(() => {
    void dev?.getToday().then(setToday);
  }, [dev, version]);
  if (!dev) return null;
  return (
    <div className="devbar" role="region" aria-label="Demo controls">
      <span className="devbar__tag" aria-hidden="true">
        <span className="devbar__dot" />
        demo
      </span>
      <label className="devbar__field">
        Today is
        <input
          type="date"
          value={today}
          data-testid="dev-today"
          onChange={(e) => {
            const v = e.target.value;
            setToday(v);
            if (isISODate(v)) void dev.setToday(v).then(refresh);
          }}
        />
      </label>
      <button type="button" className="devbar__button" onClick={() => void dev.reset().then(refresh)}>
        Reset
      </button>
    </div>
  );
}
