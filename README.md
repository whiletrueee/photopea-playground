# Photopea Playground

A basic playground to interact with [Photopea](https://www.photopea.com/) via `postMessage` API and understand how scripts can work with the embedded editor.

## What is this?

This is a Next.js-based testing environment to:
- Embed Photopea in an iframe
- Communicate with Photopea using the `postMessage` API
- Identify and experiment with various Photopea scripting capabilities
- Test automation workflows with the Photopea editor

## Getting Started

Run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to see the playground.

## Features

- Embeds Photopea editor in an iframe
- Provides interface to send commands to Photopea via postMessage
- Demonstrates script execution within Photopea
- Session state persistence for ongoing experiments

## Project Structure

- `/app` - Next.js app directory with main page and API routes
- `/lib` - Utility functions for Photopea interaction
- `/app/api` - API routes for session management and Photopea operations

## Learn More

- [Photopea API Documentation](https://www.photopea.com/api)
- [Next.js Documentation](https://nextjs.org/docs)
