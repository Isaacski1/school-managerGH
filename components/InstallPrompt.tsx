import React, { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "schoolManagerPwaPromptDismissed";
const PROMPT_DELAY_MS = 3000;

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as any).standalone === true)
    );
  }, []);

  const isIos = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }, []);

  const isIosBrowser = isIos && !isStandalone;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone) return;
    if (localStorage.getItem(DISMISS_KEY) === "true") return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    const timer = window.setTimeout(() => {
      if (localStorage.getItem(DISMISS_KEY) === "true") return;
      if (isIosBrowser) {
        setVisible(true);
      }
    }, PROMPT_DELAY_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.clearTimeout(timer);
    };
  }, [deferredPrompt, isIosBrowser, isStandalone]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      handleDismiss();
      return;
    }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, "true");
    }
    setVisible(false);
    setDeferredPrompt(null);
  };

  if (!visible || isStandalone) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Install School Manager GH
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Get quick access by installing the app on your device.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="rounded-md p-1 text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {isIosBrowser ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-800">iPhone/iPad install</p>
            <ol className="mt-2 list-decimal pl-5 space-y-1">
              <li>Tap the Share button in Safari.</li>
              <li>Select “Add to Home Screen”.</li>
              <li>Confirm to install.</li>
            </ol>
          </div>
        ) : (
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleInstall}
              className="flex-1 rounded-lg bg-[#0B4A82] px-4 py-2 text-white hover:bg-[#0A3F6F] transition-colors"
            >
              Install App
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstallPrompt;
