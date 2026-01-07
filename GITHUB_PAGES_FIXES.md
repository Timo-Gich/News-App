# GitHub Pages 404 Error Fixes

This document outlines the fixes applied to resolve 404 errors in the Currents News PWA when deployed on GitHub Pages.

## Issues Fixed

### 1. Manifest.json Path Issues
**Problem**: The manifest.json had absolute paths (`/`) that don't work with GitHub Pages subdirectories.

**Fix**: Updated `start_url` and added `scope` to use relative paths:
```json
{
    "start_url": "./?standalone=true",
    "scope": "./"
}
```

### 2. 404.html Redirect Logic
**Problem**: The 404.html page redirected to root domain instead of GitHub Pages subdirectory.

**Fix**: Updated redirect logic to dynamically calculate base URL:
```javascript
const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/');
let targetUrl = baseUrl;
```

### 3. Service Worker Scope Registration
**Problem**: Service worker registered with fixed scope `'./'` instead of dynamic scope for GitHub Pages.

**Fix**: Added dynamic scope calculation in cache-controller.js:
```javascript
const baseUrl = window.location.pathname.replace(/\/[^\/]*$/, '/');
const scope = baseUrl || './';
```

### 4. Enhanced Error Handling
**Problem**: No graceful handling of 404 errors and resource loading failures.

**Fix**: Added comprehensive error handling in script.js:
- Resource loading error detection
- Fetch error handling with 404 detection
- Service worker registration error handling
- Manifest.json loading error handling

## Deployment Instructions

### 1. Repository Setup
1. Ensure your repository is set up for GitHub Pages
2. Go to Settings → Pages → Source
3. Select the branch you want to deploy (usually `main` or `master`)

### 2. Automatic Deployment
The `.github/workflows/deploy.yml` file will automatically deploy your site when you push to the main branch.

### 3. Manual Deployment
```bash
git add .
git commit -m "Fix GitHub Pages 404 errors"
git push origin main
```

## Testing Your Deployment

### 1. Check GitHub Pages URL
Your site will be available at:
- `https://username.github.io/repository-name`

### 2. Test Deep Links
Try accessing deep links directly:
- `https://username.github.io/repository-name/#/latest`
- `https://username.github.io/repository-name/#/search`

### 3. Test PWA Installation
1. Open your site in Chrome
2. Click the install button or use Chrome DevTools → Application → Manifest
3. Verify the PWA installs correctly

### 4. Test Offline Functionality
1. Open Chrome DevTools → Network
2. Check "Offline" checkbox
3. Verify the site still works with cached content

## Troubleshooting

### Issue: 404 Errors on Deep Links
**Solution**: Ensure your 404.html file is properly configured and the redirect logic is working.

### Issue: PWA Not Installing
**Solution**: Check that:
- manifest.json is accessible
- start_url uses relative paths
- Service worker is registering correctly

### Issue: Service Worker Not Caching
**Solution**: Verify:
- Service worker scope is correct for GitHub Pages
- Static assets are being cached properly
- Network requests are being intercepted

### Issue: Resources Not Loading
**Solution**: Check:
- All asset paths are relative
- CORS headers are properly set
- GitHub Pages is serving files correctly

## Performance Optimization

### 1. Caching Strategy
The service worker uses a multi-layer caching strategy:
- Static assets: Cache-first
- API responses: Network-first with cache fallback
- Images: Cache-first with network update

### 2. Offline Fallbacks
- Cached articles when offline
- Offline library for saved articles
- Graceful degradation for missing resources

### 3. GitHub Pages Optimization
- Use `.nojekyll` file to prevent Jekyll processing
- Proper MIME types for all assets
- Efficient caching headers

## Monitoring and Maintenance

### 1. Check GitHub Pages Status
Monitor your deployment at:
- GitHub → Settings → Pages
- GitHub Actions → Workflows → deploy.yml

### 2. Monitor Console Errors
Check browser console for:
- 404 errors
- Service worker registration issues
- Manifest loading problems

### 3. Regular Testing
Test your site regularly for:
- Deep link functionality
- PWA installation
- Offline functionality
- Cross-browser compatibility

## Additional Resources

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [PWA Best Practices](https://web.dev/progressive-web-apps/)
- [Service Worker Guide](https://web.dev/service-workers-cache-storage/)
- [Manifest.json Reference](https://developer.mozilla.org/en-US/docs/Web/Manifest)

## Support

If you continue to experience issues:

1. Check the browser console for specific error messages
2. Verify your GitHub Pages URL structure
3. Test with different browsers
4. Review the deployment logs in GitHub Actions
5. Ensure all files are properly committed and pushed to the repository
