import Reveal from 'reveal.js';
import 'reveal.js/reveal.css';
import 'reveal.js/theme/black.css';
import Markdown from 'reveal.js/plugin/markdown';
import Highlight from 'reveal.js/plugin/highlight';
import Notes from 'reveal.js/plugin/notes';
import Internation from 'reveal.js-internation/plugin/internation/internation.esm.js';
import Simplemenu from 'reveal.js-simplemenu';
import Smallcontrol from 'reveal.js-smallcontrol';
import 'reveal.js/plugin/highlight/monokai.css';
import 'reveal.js-simplemenu/simplemenu.css';
import 'reveal.js-smallcontrol/smallcontrol.css';
import english from '../locales/en.json' with { type: 'json' };
import norwegian from '../locales/no.json' with { type: 'json' };
import './theme.css';

const deck = new Reveal({
  hash: true,
  width: 1280,
  height: 720,
  margin: 0.06,
  controls: true,
  progress: true,
  slideNumber: 'c/t',
  transition: 'fade',
  backgroundTransition: 'fade',
  simplemenu: {
    menubarclass: 'menubar',
  },
  internation: {
    locale: 'no',
    localename: 'Norsk',
    switchselector: '.langchooser',
    languages: {
      en: {
        name: 'English',
        dictionary: english,
      },
      no: {
        name: 'Norsk',
        dictionary: norwegian,
      },
    },
  },
  plugins: [Markdown, Highlight, Notes, Internation, Simplemenu, Smallcontrol],
});

const menuDictionaries = {
  en: english.menubar,
  no: norwegian.menubar,
};
const languageFlags = {
  en: new URL('../assets/en.png', import.meta.url).href,
  no: new URL('../assets/no.png', import.meta.url).href,
};
const languageSelector = document.querySelector('.langchooser');
const languageFlag = document.querySelector('#language-flag');

const updateLanguageFlag = (language) => {
  const flag = languageFlags[language];
  if (!flag) throw new Error(`Missing flag for language "${language}"`);
  languageFlag.src = flag;
};

const translateMenubar = (language) => {
  const dictionary = menuDictionaries[language];
  if (!dictionary) throw new Error(`Missing menubar translations for language "${language}"`);

  document.querySelectorAll('.menubar [data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    const translation = dictionary[key];
    if (!translation) throw new Error(`Missing menubar translation "${key}" for language "${language}"`);
    element.textContent = translation;
  });
  const navigationLabel = dictionary.navigation;
  if (!navigationLabel) throw new Error(`Missing navigation label for language "${language}"`);
  document.querySelector('.menubar').setAttribute('aria-label', navigationLabel);
};

languageSelector.addEventListener('change', (event) => {
  const language = event.currentTarget.value;
  translateMenubar(language);
  updateLanguageFlag(language);
});
deck.on('ready', () => {
  translateMenubar(languageSelector.value);
  updateLanguageFlag(languageSelector.value);
});
deck.initialize();
