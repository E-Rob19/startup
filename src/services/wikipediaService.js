// Third-party API: Wikipedia's REST "page summary" endpoint.
// Free, no API key, and it allows requests straight from the browser (CORS),
// so the frontend calls it directly instead of going through our backend.
// Docs: https://en.wikipedia.org/api/rest_v1/#/Page%20content/get_page_summary__title_

const SUMMARY_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

// Live-sound and ear-training terms, as Wikipedia article titles.
export const GLOSSARY_TERMS = [
  'Audio feedback',
  'Pink noise',
  'Equal-loudness contour',
  'Equalization (audio)',
  'Sound reinforcement system',
  'Octave',
  'Decibel',
  'Room modes',
  'Comb filter',
  'Psychoacoustics',
  'Hertz',
  'Absolute pitch',
  'Frequency response',
  'Missing fundamental',
  'Critical band',
];

// Returns { title, extract, thumbnailUrl, pageUrl } for one Wikipedia article.
// thumbnailUrl is null when the article has no image.
export async function getTermSummary(title) {
  let response;
  try {
    // Wikipedia titles use underscores for spaces in URLs.
    response = await fetch(SUMMARY_URL + encodeURIComponent(title.replaceAll(' ', '_')));
  } catch {
    throw new Error("Couldn't reach Wikipedia. Check your connection and try again.");
  }

  if (response.status === 429) {
    throw new Error('Wikipedia is getting a lot of requests right now. Try again in a moment.');
  }
  if (!response.ok) {
    throw new Error(`Couldn't load "${title}" from Wikipedia.`);
  }

  // Keep only what the page needs, in our own shape, so the component doesn't
  // depend on the details of Wikipedia's (much bigger) response.
  const data = await response.json();
  return {
    title: data.title,
    extract: data.extract,
    thumbnailUrl: data.thumbnail?.source ?? null,
    pageUrl: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
  };
}
