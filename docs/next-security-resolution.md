# Next.js security resolution
Installed baseline 16.4.2 emitted SecurityFatalError after compilation; this was a package advisory, not a layout/build configuration error. Vendor release 16.4.5 lists seven fixes; 16.4.6 is the latest stable patch on the same minor line and backports fixes without pending canary features.

References: https://github.com/vercel/next.js/releases/tag/v16.4.5 and https://github.com/vercel/next.js/releases/tag/v16.4.6 . Reviewed before upgrade. Pin next exactly 16.4.6; package lock updated (3 installed packages changed). npm audit reported zero vulnerabilities after install. Production static export and hash routes retained. No middleware, server actions or image-optimization server was added. This does not imply every other possible security issue is absent.

Installer warned about an old loaded SWC DLL it could not remove; the old dev server was stopped and restarted on 16.4.6. No recursive deletion performed. Dev warning is gone; final production build recorded in refinement report.
