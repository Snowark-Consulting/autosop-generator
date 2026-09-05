<div align="center">
<h1>SnowArk AutoSOP Creator</h1>
<p><strong>Turn screen recordings into professional PDF Standard Operating Procedures.</strong></p>
</div>

SnowArk internal tool. Upload a screen-recording video (MP4, MOV, WebM); the app extracts frames and audio in your browser, sends them to the Gemini API to draft an SOP, then lets you edit the steps and screenshots before exporting a branded PDF.

## How it runs

Fully client-side and static. No backend, no account, no server to maintain. The Gemini API is called directly from your browser.

**Live tool:** https://snowark-consulting.github.io/autosop-generator/

## Local development

**Prerequisites:** Node.js

```bash
npm install
npm run dev       # starts Vite dev server
npm run build     # production build to dist/
npm run preview   # serve the built site
```

## Gemini API key

The app needs a Google Gemini API key: click **Settings → Add API Key** in the tool and paste it in, or set one programmatically with

```js
localStorage.setItem('snowark.geminiApiKey', 'YOUR_KEY')
```

The key is stored **only in your browser's localStorage** and never leaves your machine. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

## Deploy

Built with Vite. `npm run build` produces a static `dist/` that can be hosted on GitHub Pages (this repo), Netlify, Vercel Static, or any static host. The `base` path in `vite.config.ts` is set to `/autosop-generator/` to match the GitHub Pages subdirectory.