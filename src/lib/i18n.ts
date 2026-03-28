import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import translationES from '../locales/es/translation.json';

// Define resources
const resources = {
    es: {
        translation: translationES,
    },
};

i18n
    // detect user language
    .use(LanguageDetector)
    // pass the i18n instance to react-i18next.
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'es', // Default language
        debug: import.meta.env.DEV, // Info logs in dev mode

        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },
    });

export default i18n;
