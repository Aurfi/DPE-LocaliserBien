import config from './playwright.config.js'

export default {
  ...config,
  testMatch: 'product-pages.spec.js',
  grep: /Static guides/,
  projects: config.projects.filter(project => ['chromium', 'Mobile Chrome'].includes(project.name)),
  outputDir: 'test-results/guides',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/guides', open: 'never' }],
    ['json', { outputFile: 'reports/guides/results.json' }],
    ['junit', { outputFile: 'reports/guides/junit.xml' }]
  ],
  use: { ...config.use, baseURL: 'http://127.0.0.1:4187' },
  webServer: {
    ...config.webServer,
    command: 'npm run preview -- --host 127.0.0.1 --port 4187 --strictPort',
    url: 'http://127.0.0.1:4187'
  }
}
