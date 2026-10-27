import Reveal from 'reveal.js';
import 'reveal.js/reveal.css';
import 'reveal.js/theme/black.css';
import Markdown from 'reveal.js/plugin/markdown';
import Highlight from 'reveal.js/plugin/highlight';
import Notes from 'reveal.js/plugin/notes';
import 'reveal.js/plugin/highlight/monokai.css';
import './theme.css';

const deck = new Reveal({
  hash: true,
  plugins: [Markdown, Highlight, Notes],
});
deck.initialize();
