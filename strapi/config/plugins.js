// Strapi Plugins Configuration

module.exports = ({ env }) => ({
  // Users & Permissions plugin configuration
  'users-permissions': {
    config: {
      jwt: {
        expiresIn: '7d',
      },
      ratelimit: {
        interval: 60000,
        max: 100,
      },
    },
  },
  // Upload plugin - local storage for media
  upload: {
    config: {
      provider: 'local',
      providerOptions: {
        sizeLimit: 10 * 1024 * 1024, // 10MB
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },
  // i18n plugin - disabled for single language (Dutch/English)
  i18n: {
    enabled: true,
    config: {
      defaultLocale: 'en',
      locales: ['en', 'nl', 'es'],
    },
  },
  // Import/Export plugin - for bulk adding products via CSV/Excel
  'import-export-entries': {
    enabled: true,
    config: {
      // Allow importing these content types
      importModels: ['product', 'category', 'brand'],
    },
  },
});
