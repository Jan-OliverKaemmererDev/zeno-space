# 🌌 ZenoSpace

Welcome to **ZenoSpace**, an immersive, interactive portfolio and minigame hub built with Angular 21 and Three.js. This project features a stunning visual experience with WebGL-powered cloudscapes, fluid animations, ambient audio, and a collection of relaxing and interactive web experiences.

## ✨ Features

- **Immersive 3D Backgrounds:** Dynamic anime-style cloudscape powered by Three.js and custom WebGL shaders.
- **Interactive Minigame Hub:** Dive into different "Welten" (Worlds) directly from the landing page:
  - 🪐 **Cosmic Sculptor:** Shape the cosmos.
  - 🫧 **Bubble Harmony:** Interactive auditory bubble experience.
  - 🏖️ **Zen Sand:** Relaxing sandbox simulation.
  - 🎵 **Soundscape Mixer:** Mix your own ambient environments.
- **Fluid UI & UX:** 
  - Custom orb-cursor and liquid navigation components.
  - Physics-based pointer evasion effects (bubbles and text smoothly react to mouse movement).
  - Smooth scrolling and staggered entrance animations.
- **Ambient Audio:** Integrated background music and sound effects with responsive UI toggles.

## 🛠️ Tech Stack

- **Framework:** [Angular 21](https://angular.dev/) (Standalone Components, Signals)
- **3D Graphics:** [Three.js](https://threejs.org/) (WebGL Renderers, ShaderMaterials)
- **Styling:** SCSS, Custom CSS Properties, Flexbox/Grid
- **Testing:** [Vitest](https://vitest.dev/)
- **Build Tool:** Angular CLI

## 🚀 Getting Started

### Prerequisites

Make sure you have Node.js and npm installed.

```bash
node -v
npm -v
```

### Installation

1. Clone the repository and navigate into the project directory.
2. Install the dependencies:

```bash
npm install
```

### Development Server

Start the local development server:

```bash
npm start
```
> Or run `ng serve -o` to automatically open your browser.

Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## 📂 Project Structure

- `src/app/core/`: Singleton services (`AudioService`, `GameRegistryService`, `SmoothScrollService`) and core models.
- `src/app/features/`: 
  - `landing/`: The main landing page with the WebGL cloudscape and game hub.
  - `games/`: Individual interactive minigame components.
- `src/app/shared/`: Reusable, highly interactive UI components like `bubble-card`, `liquid-nav`, `orb-cursor`, and `orb-nav`.

## 📜 Available Scripts

- `npm start` - Starts the development server.
- `npm run build` - Builds the application for production into the `dist/` folder.
- `npm run watch` - Builds the application and watches for file changes.
- `npm run test` - Executes unit tests using Vitest.

---

*Designed and built with Angular and Three.js.*
