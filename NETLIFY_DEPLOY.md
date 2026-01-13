# Netlify Deployment Guide

This document provides instructions for deploying the Furbank ERP application to Netlify.

## Prerequisites

- A Netlify account
- GitHub repository connected to Netlify
- Supabase project with environment variables configured

## Environment Variables

Before deploying, ensure the following environment variables are set in Netlify:

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Add the following variables:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Deployment Configuration

The project is configured for Netlify deployment with the following settings:

- **Base directory**: `furbank-erp-web`
- **Build command**: `npm run build`
- **Publish directory**: `furbank-erp-web/dist`
- **Node version**: 20

These settings are defined in `netlify.toml` at the root of the repository.

## Deployment Steps

### Option 1: Automatic Deployment (Recommended)

1. Connect your GitHub repository to Netlify:
   - Go to [Netlify Dashboard](https://app.netlify.com)
   - Click **Add new site** → **Import an existing project**
   - Select **GitHub** and authorize Netlify
   - Choose your repository: `Furbank-Group/erp`
   - Netlify will automatically detect the `netlify.toml` configuration

2. Configure environment variables (see above)

3. Click **Deploy site**

Netlify will automatically deploy on every push to the `main` branch.

### Option 2: Manual Deployment

1. Build the project locally:
   ```bash
   cd furbank-erp-web
   npm install
   npm run build
   ```

2. Deploy to Netlify:
   - Go to [Netlify Drop](https://app.netlify.com/drop)
   - Drag and drop the `furbank-erp-web/dist` folder

## Post-Deployment

After deployment:

1. Verify the site is accessible
2. Test authentication flow
3. Check that all API calls are working
4. Verify environment variables are correctly set

## Troubleshooting

### Build Fails

- Check that Node version 20 is being used
- Verify all dependencies are installed (`npm install`)
- Check build logs in Netlify dashboard

### Environment Variables Not Working

- Ensure variables are prefixed with `VITE_` for Vite projects
- Verify variables are set in Netlify dashboard (not just `.env` file)
- Redeploy after adding/changing environment variables

### Routing Issues

- The `_redirects` file in `public/` ensures SPA routing works correctly
- All routes should redirect to `index.html` with status 200

## Continuous Deployment

By default, Netlify will:
- Deploy automatically on push to `main` branch
- Run build command defined in `netlify.toml`
- Deploy previews for pull requests

To customize deployment settings, edit `netlify.toml`.
