# Veritas News App

A Progressive Web App (PWA) for reading news from around the world. Built with vanilla JavaScript, HTML, and CSS.

## Features

- **Global News**: Access news from over 50 countries in 15 languages
- **Offline Reading**: Read cached articles when you're offline
- **PWA Support**: Install as a native app on your device
- **Dark Mode**: Built-in theme switching
- **Search & Filters**: Advanced search with date and category filters
- **Bookmarking**: Save articles for later reading
- **Share Articles**: Easy sharing to social media and messaging apps

## Technologies Used

- Vanilla JavaScript (ES6+)
- HTML5
- CSS3 with custom properties
- Service Worker for offline functionality
- Web Manifest for PWA features
- Currents News API

## Installation & Setup

### Prerequisites

You need a Currents News API key to fetch real news. Get a free API key from [Currents API](https://currentsapi.services/).

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/veritas-news-app.git
   cd veritas-news-app
   ```

2. Open `index.html` in your browser or serve it locally:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js (install http-server first)
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```

3. Open your browser and navigate to `http://localhost:8000`

4. Enter your API key when prompted

### GitHub Pages Deployment

This app is optimized for GitHub Pages deployment:

1. Push your code to a GitHub repository
2. Go to repository settings → Pages
3. Select the branch you want to deploy (usually `main` or `gh-pages`)
4. Your app will be available at `https://your-username.github.io/your-repo-name`

## GitHub Pages Configuration

The following files are included for optimal GitHub Pages PWA support:

- `.nojekyll` - Prevents Jekyll processing
- `_headers` - Custom headers for PWA features
- `404.html` - Enhanced 404 handling for PWA routing
- `sw.js` - Service worker for offline functionality
- `manifest.json` - PWA manifest configuration

## Troubleshooting

### 404 Errors on GitHub Pages

If you're experiencing 404 errors when accessing deep links (like `/latest` or `/search`):

1. Ensure your `404.html` file is properly configured (included in this repo)
2. Check that your service worker is registered correctly
3. Verify your GitHub Pages URL structure matches your app's routing

### API Key Issues

- Make sure you have a valid Currents News API key
- Check your internet connection
- Verify the API key is entered correctly in the app

### Offline Functionality

- The app caches articles automatically when online
- Offline mode shows previously viewed articles
- Service worker handles offline requests gracefully

## Browser Support

- Chrome/Chromium (recommended)
- Firefox
- Safari (limited PWA features)
- Edge

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## API Terms

This app uses the Currents News API. Please review their [terms of service](https://currentsapi.services/terms) when using this application.

## Support

If you encounter issues:

1. Check the browser console for errors
2. Verify your API key is valid
3. Ensure you're serving the app over HTTPS (required for service workers)
4. Check GitHub Pages deployment settings

## Future Enhancements

- Push notifications
- Reading list management
- Custom news sources
- Advanced filtering options
- Multi-language interface
