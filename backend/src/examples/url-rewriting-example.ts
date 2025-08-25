/**
 * Example demonstrating the URL rewriting functionality
 * This file shows how to use the UrlRewriter class and utility functions
 */

import { UrlRewriter, createUrlRewriter, rewriteHtmlUrls, rewriteCssUrls, AssetPathMapping } from '../utils/url-rewriter';
import { AssetType } from '../types';

// Example HTML content with various types of URLs
const sampleHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Sample Page</title>
  <link rel="stylesheet" href="https://example.com/styles/main.css">
  <link rel="stylesheet" href="/local/theme.css">
  <script src="https://example.com/js/app.js"></script>
</head>
<body>
  <h1>Welcome to Example.com</h1>
  <img src="https://example.com/images/logo.png" alt="Logo">
  <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmZmYiLz48L3N2Zz4=" alt="Placeholder">
  <img srcset="https://example.com/images/hero-small.jpg 480w, https://example.com/images/hero-large.jpg 800w" alt="Hero">
  
  <nav>
    <a href="https://example.com/about">About Us</a>
    <a href="https://external.com/partner">External Partner</a>
    <a href="mailto:contact@example.com">Contact</a>
    <a href="#section1">Jump to Section</a>
  </nav>
  
  <form action="https://example.com/submit" method="post">
    <input type="text" name="query">
    <button type="submit">Submit</button>
  </form>
  
  <iframe src="https://example.com/embed/video"></iframe>
  <object data="https://example.com/documents/manual.pdf"></object>
  <embed src="https://example.com/media/presentation.swf">
  
  <video controls>
    <source src="https://example.com/videos/intro.mp4" type="video/mp4">
    <track src="https://example.com/subtitles/en.vtt" kind="subtitles" srclang="en">
  </video>
</body>
</html>
`;

// Example CSS content with various URL references
const sampleCss = `
@import url("https://example.com/fonts/roboto.css");
@import "https://example.com/base/normalize.css";

body {
  background-image: url("https://example.com/images/background.jpg");
  font-family: 'Roboto', sans-serif;
}

.hero {
  background: url('https://example.com/images/hero-bg.png') no-repeat center;
  background-size: cover;
}

.icon {
  background-image: url(https://example.com/icons/search.svg);
}

@font-face {
  font-family: 'CustomFont';
  src: url('https://example.com/fonts/custom.woff2') format('woff2'),
       url('https://example.com/fonts/custom.woff') format('woff');
}

/* Data URL should be preserved */
.placeholder {
  background-image: url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmZmYiLz48L3N2Zz4=");
}

/* External URL should be preserved */
.external {
  background-image: url("https://external.com/images/banner.jpg");
}
`;

function demonstrateUrlRewriting() {
  console.log('=== URL Rewriting Demonstration ===\n');

  const baseUrl = 'https://example.com';
  const archiveId = 'demo-archive-2023';

  // Create a URL rewriter instance
  const rewriter = createUrlRewriter({
    archiveId,
    baseUrl,
  });

  // Add some custom asset mappings
  const assetMappings: AssetPathMapping[] = [
    {
      originalUrl: 'https://example.com/styles/main.css',
      localPath: 'assets/css/main-v2.css',
      assetType: AssetType.CSS,
    },
    {
      originalUrl: 'https://example.com/images/logo.png',
      localPath: 'assets/images/company-logo.png',
      assetType: AssetType.IMAGE,
    },
  ];

  rewriter.addAssetMappings(assetMappings);

  console.log('1. HTML URL Rewriting:');
  console.log('Original HTML (excerpt):');
  console.log(sampleHtml.substring(0, 500) + '...\n');

  const rewrittenHtml = rewriter.rewriteHtmlUrls(sampleHtml);
  console.log('Rewritten HTML (excerpt):');
  console.log(rewrittenHtml.substring(0, 800) + '...\n');

  console.log('2. CSS URL Rewriting:');
  console.log('Original CSS:');
  console.log(sampleCss.substring(0, 400) + '...\n');

  const rewrittenCss = rewriter.rewriteCssUrls(sampleCss);
  console.log('Rewritten CSS:');
  console.log(rewrittenCss.substring(0, 600) + '...\n');

  console.log('3. Individual URL Rewriting Examples:');
  const testUrls = [
    'https://example.com/about',
    'https://example.com/images/photo.jpg',
    '/relative/path.css',
    'https://external.com/resource',
    'data:image/png;base64,iVBORw0KGgo...',
    'javascript:void(0)',
    'mailto:test@example.com',
    '#fragment',
  ];

  testUrls.forEach(url => {
    const rewritten = rewriter.rewriteUrl(url);
    const isPageLink = url.includes('/about');
    const rewrittenAsPage = rewriter.rewriteUrl(url, isPageLink);
    
    console.log(`Original: ${url}`);
    console.log(`Rewritten: ${rewritten}`);
    if (isPageLink) {
      console.log(`As page link: ${rewrittenAsPage}`);
    }
    console.log('---');
  });

  console.log('4. Utility Function Examples:');
  
  // Using utility functions
  const quickHtmlRewrite = rewriteHtmlUrls(
    '<img src="https://example.com/test.jpg" alt="test">',
    { archiveId, baseUrl }
  );
  console.log('Quick HTML rewrite:', quickHtmlRewrite);

  const quickCssRewrite = rewriteCssUrls(
    'background: url("https://example.com/bg.png");',
    { archiveId, baseUrl }
  );
  console.log('Quick CSS rewrite:', quickCssRewrite);

  console.log('\n=== Demonstration Complete ===');
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateUrlRewriting();
}

export { demonstrateUrlRewriting };