import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

// This line is replaced by the build process with the list of files to cache.
precacheAndRoute(self.__WB_MANIFEST);

cleanupOutdatedCaches();
