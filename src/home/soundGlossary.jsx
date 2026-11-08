import React from 'react';
import { GLOSSARY_TERMS, getTermSummary } from '../services/wikipediaService';

// Picks a random term other than the current one, so "Next Term" always changes.
function pickTerm(current) {
  const choices = GLOSSARY_TERMS.filter((term) => term !== current);
  return choices[Math.floor(Math.random() * choices.length)];
}

// A random live-sound term, explained by Wikipedia (the third-party API).
export function SoundGlossary() {
  const [term, setTerm] = React.useState(() => pickTerm(null));
  const [summary, setSummary] = React.useState(null);
  const [error, setError] = React.useState('');

  // Fetch the summary whenever the term changes (including the first one).
  React.useEffect(() => {
    let ignore = false;
    setSummary(null);
    setError('');
    getTermSummary(term)
      .then((result) => {
        if (!ignore) setSummary(result);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, [term]);

  const isLoading = !summary && !error;

  return (
    <section id="sound-glossary">
      <h2>Sound Engineering Glossary</h2>
      {isLoading && <p>Looking up "{term}"…</p>}
      {error && <p className="text-danger" role="alert">{error}</p>}
      {summary && (
        <div id="glossary-entry">
          {summary.thumbnailUrl && <img src={summary.thumbnailUrl} alt="" />}
          <h3>{summary.title}</h3>
          <p>{summary.extract}</p>
          <p>
            <small>
              From{' '}
              <a href={summary.pageUrl} target="_blank" rel="noopener">
                Wikipedia
              </a>
              , available under CC BY-SA.
            </small>
          </p>
        </div>
      )}
      <button type="button" className="btn btn-brand" onClick={() => setTerm(pickTerm(term))} disabled={isLoading}>
        {error ? 'Try Another Term' : 'Next Term'}
      </button>
    </section>
  );
}
