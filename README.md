# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Realtime Environment

Voice realtime and WhatsApp realtime use different backends and different protocols.

For local development:

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_WHATSAPP_WS_URL=ws://localhost:3001
VITE_VOICE_API_URL=http://localhost:5000
VITE_VOICE_SOCKET_URL=http://localhost:5000
VITE_PYTHON_AI_URL=http://localhost:4000
VITE_API_ADMIN_URL=http://localhost:8080
```

For live deployments:

```env
VITE_API_BASE_URL=https://YOUR-WHATSAPP-BROADCAST-BACKEND
VITE_WHATSAPP_WS_URL=wss://YOUR-WHATSAPP-BROADCAST-BACKEND
VITE_VOICE_API_URL=https://YOUR-VOICE-NODE-BACKEND
VITE_VOICE_SOCKET_URL=https://YOUR-VOICE-NODE-BACKEND
VITE_PYTHON_AI_URL=https://YOUR-PYTHON-SERVICE
VITE_API_ADMIN_URL=https://YOUR-ADMIN-BACKEND
```

Avoid using shared `VITE_WS_URL` or `VITE_SOCKET_URL` for new voice/WhatsApp deployments; they remain only as legacy fallback values.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
