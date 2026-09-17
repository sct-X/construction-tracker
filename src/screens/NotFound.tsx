import './plainPage.css';

export default function NotFound() {
  return (
    <main className="plain" data-testid="not-found">
      <h1 className="plain__title">Not found</h1>
      <p className="plain__line">Nothing at this address.</p>
      <p className="plain__action">
        <a className="btn btn--desktop" href="#/">
          Home
        </a>
      </p>
    </main>
  );
}
