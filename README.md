<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1-56gnW586aluP0SgnoHPew3agymlze47

**Live Demo:** https://averybee24601.github.io/Evidence/

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Build for Production

1. Build the app:
   `npm run build`
2. Preview the production build:
   `npm run preview`

## Deploy to GitHub Pages

This repository is configured to automatically deploy to GitHub Pages on every push to the `main` branch using GitHub Actions.

**Deployment URL:** https://averybee24601.github.io/Evidence/

To enable GitHub Pages:
1. Go to your repository Settings → Pages
2. Under "Build and deployment", select "GitHub Actions" as the source
3. Push your changes to the `main` branch
4. The GitHub Actions workflow will automatically build and deploy your app
