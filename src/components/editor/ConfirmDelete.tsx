/**
 * A plain confirm for the editor's deletes: a Delete button that turns into
 * one sentence saying what goes with it, then "Delete" or "Keep it". Inline,
 * never a modal.
 */
import { useState } from 'react';

interface Props {
  /** "Delete step", "Delete stage". */
  label: string;
  /** "Delete Install windows? 4 items on it lose their step." */
  question: string;
  disabled?: boolean;
  onConfirm: () => void;
}

export function ConfirmDelete({ label, question, disabled, onConfirm }: Props) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className="btn btn--desktop btn--danger" disabled={disabled} data-testid="editor-delete" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <div className="ed__confirm" role="alertdialog" aria-label={question} data-testid="editor-delete-confirm-box">
      <p>{question}</p>
      <div className="ed__actions">
        <button
          type="button"
          className="btn btn--desktop btn--danger"
          data-testid="editor-delete-confirm"
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
        >
          {label}
        </button>
        <button type="button" className="btn btn--desktop" data-testid="editor-delete-keep" onClick={() => setAsking(false)}>
          Keep it
        </button>
      </div>
    </div>
  );
}
