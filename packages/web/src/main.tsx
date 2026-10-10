import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// One token set (v1's Apple foundation and Liquid Glass passes); no web font ships: the system face is the type.
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import { App } from './app/App';
import { DataProvider } from './data/DataContext';
import { loadDataLayer } from './data/layer';
import { applyTheme, readTheme } from './shell/theme';

// Before the first paint: light by default, or the viewer's choice.
applyTheme(readTheme());

const root = createRoot(document.getElementById('root')!);

loadDataLayer()
  .then((layer) => {
    root.render(
      <StrictMode>
        <DataProvider layer={layer}>
          <App />
        </DataProvider>
      </StrictMode>,
    );
  })
  .catch((e: unknown) => {
    root.render(<p className="load-error">The tracker couldn't start: {e instanceof Error ? e.message : String(e)}</p>);
  });
