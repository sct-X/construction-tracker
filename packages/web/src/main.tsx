import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './app/App';
import { DataProvider } from './data/DataContext';
import { loadDataLayer } from './data/layer';

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
