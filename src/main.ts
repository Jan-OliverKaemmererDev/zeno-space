import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/**
 * Main entry point for the Angular application.
 * Bootstraps the root App component with the provided application configuration.
 */
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
