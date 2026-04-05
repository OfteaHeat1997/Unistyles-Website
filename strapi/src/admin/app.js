const config = {
  // Replace default Strapi branding
  auth: {
    logo: null, // Uses default Strapi logo on login; replace with a URL to your own logo
  },
  head: {
    favicon: null,
  },
  locales: [],
  translations: {},
  menu: {
    logo: null,
  },
  theme: {
    light: {
      colors: {
        // Primary actions & links — brand gold
        primary100: '#FFF8E1',
        primary200: '#FFECB3',
        primary500: '#C9A84C',
        primary600: '#B8943F',
        primary700: '#A07C2E',

        // Navigation sidebar — dark charcoal
        neutral0: '#FFFFFF',
        neutral100: '#F6F6F9',
        neutral150: '#EAEAEF',

        // Success / danger keep Strapi defaults (green / red)

        // Button text on primary background
        buttonPrimary500: '#C9A84C',
        buttonPrimary600: '#B8943F',
      },
    },
    dark: {
      colors: {
        primary100: '#2C2416',
        primary200: '#3D321F',
        primary500: '#C9A84C',
        primary600: '#D4B65E',
        primary700: '#E0C97A',

        buttonPrimary500: '#C9A84C',
        buttonPrimary600: '#D4B65E',
      },
    },
  },
  tutorials: false,
  notifications: {
    releases: false,
  },
};

const bootstrap = (app) => {
  // Set the browser tab title
  document.title = 'UNISTYLES Curacao';
};

export default {
  config,
  bootstrap,
};
