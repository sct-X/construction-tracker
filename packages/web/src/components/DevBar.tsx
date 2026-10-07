/** Demo only: move "today" and put the seed back. Nothing else lives here. */
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
      <label className="devbar-today">
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
      <button type="button" className="btn btn-quiet" onClick={() => void dev.reset().then(refresh)}>
        Reset
      </button>
    </div>
  );
}
