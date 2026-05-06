import type { RequestListener } from "http";

export type KoaNext = () => Promise<void>;

export interface KoaRequest {
  ip: string;
  body?: unknown;
  get(name: string): string | undefined;
}

export interface KoaContext {
  status: number;
  body: unknown;
  path: string;
  request: KoaRequest;
  set(name: string, value: string): void;
}

export type KoaMiddleware = (ctx: KoaContext, next: KoaNext) => unknown | Promise<unknown>;

export interface KoaApp {
  proxy: boolean;
  use(middleware: KoaMiddleware): KoaApp;
  callback(): RequestListener;
}

export type KoaRouteHandler = (ctx: KoaContext) => unknown | Promise<unknown>;

export interface KoaRouter {
  get(path: string, handler: KoaRouteHandler): KoaRouter;
  post(path: string, handler: KoaRouteHandler): KoaRouter;
  routes(): KoaMiddleware;
  allowedMethods(): KoaMiddleware;
}

export type KoaAppCtor = new () => KoaApp;
export type KoaRouterCtor = new () => KoaRouter;

export type KoaBodyOptions = { jsonLimit?: number };
export type KoaBodyFactory = (opts?: KoaBodyOptions) => KoaMiddleware;
export interface KoaBodyModule {
  (opts?: KoaBodyOptions): KoaMiddleware;
  default?: KoaBodyFactory;
}
