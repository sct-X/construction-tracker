import { PageHeader } from '../shell/PageHeader';

export default function NotFound() {
  return (
    <main className="page" data-testid="not-found">
      <PageHeader title="Not found" meta="There is nothing at this address." />
      <p className="page__lede">
        <a href="#/">Go to your home screen</a>
      </p>
    </main>
  );
}
