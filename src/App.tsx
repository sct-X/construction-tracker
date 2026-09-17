import { HashRouter, Route, Routes } from 'react-router-dom';
import { DevBar } from './dev/DevBar';
import { useSession } from './data/context';
import { formatLong } from './domain/dates';

function Stage0Home() {
  const session = useSession();
  return (
    <main className="stage0" data-testid="stage0-home">
      <h1 className="stage0__title">Construction Tracker: Stage 0</h1>
      <p className="stage0__lede">
        Types, seed data, calculator, data layer and dev bar are in. Screens arrive from Stage 1. You are{' '}
        <strong data-testid="stage0-person">{session.person.shortName}</strong> ({session.role}) on {session.side.name}, and
        today is <span className="num">{formatLong(session.today)}</span>
        {session.offline ? ', offline' : ''}.
      </p>
    </main>
  );
}

function NotYet() {
  return (
    <main className="stage0">
      <h1 className="stage0__title">Not built yet</h1>
      <p className="stage0__lede">This route is listed in src/screens/README.md and arrives in a later stage.</p>
    </main>
  );
}

export default function App() {
  return (
    <HashRouter>
      <DevBar />
      <Routes>
        <Route path="/" element={<Stage0Home />} />
        <Route path="*" element={<NotYet />} />
      </Routes>
    </HashRouter>
  );
}
