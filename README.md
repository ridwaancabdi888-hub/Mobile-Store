# Ridwaan Mobile Store

A polished, mobile-first smartphone shopping demo built with HTML5, CSS3 and vanilla JavaScript.

**Live demo:** https://ridwaan-mobile-store.vercel.app

## Features

- Home, Shop, Cart, Rewards and Profile screens
- Sign up, sign in, password reset, persistent sessions and protected customer shopping
- Installable mobile PWA with Android/Samsung install prompt and offline app shell
- Role-aware Admin Control Center for inventory, orders, payments and users
- Product add/edit/delete, user role management and account suspension
- 12 searchable and filterable smartphones
- Product details with storage, color and quantity options
- Persistent cart, wishlist, rewards, orders, profile and theme using localStorage
- Validated checkout flow and order success experience
- Animated Gold membership rewards interface
- Responsive phone-sized desktop presentation and dark mode

## Demo accounts

- Admin: `admin@ridwaanstore.com` / `Admin123!`
- Customer: `demo@ridwaanstore.com` / `Demo123!`

Authentication and payments are front-end demonstrations stored in the browser with `localStorage`; they do not process real payments.

## Run locally

No dependencies or build process are required. Because service workers do not run reliably from `file://` URLs, use a local HTTP server when testing installation or offline PWA behavior.

From the repository folder, run the command for your operating system:

```bash
# macOS or Linux
python3 -m http.server 8000

# Windows Command Prompt or PowerShell
py -m http.server 8000
```

Alternatively, if Node.js is installed, run:

```bash
npx serve .
```

Then open `http://localhost:8000` for the Python server, or the URL printed by `serve`.

For a quick UI-only preview, you can still open `index.html` directly in a modern browser, but PWA installation and offline caching may be unavailable.

## Reset demo data

The demo saves accounts, cart items, orders, rewards, preferences and admin changes in the browser. To return the app to its original demo state, clear the site's stored data in the browser and reload the page.

In Chrome or Edge, open **Developer Tools → Application → Storage**, select **Clear site data**, then refresh. On a phone, clear the site's storage from the browser's site settings. This also removes the saved demo session, so sign in again with one of the demo accounts above.

## Deployment

This is a static site. On Vercel, use the project root as the root directory and leave the build command empty.

## Install on a phone

Open the live site in Chrome or Samsung Internet and tap **Install Mobile App**. If the browser does not show the prompt, open its menu and choose **Add to Home screen** or **Install app**.
