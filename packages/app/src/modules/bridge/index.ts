import type { Hono } from 'hono';
import { createKitRoutes } from './api/routes/create-kit-routes.js';

export type BridgeModuleOptions = {
  readonly kitDirectory: string;
};

export type BridgeModule = {
  readonly kitRoutes: Hono;
};

export function createBridgeModule(options: BridgeModuleOptions): BridgeModule {
  return { kitRoutes: createKitRoutes({ kitDirectory: options.kitDirectory }) };
}
