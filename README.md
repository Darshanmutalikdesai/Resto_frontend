# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Production Docker

Build and start the production frontend:

```bash
docker compose up -d --build
```

Open http://localhost:8080.

Stop and remove the container:

```bash
docker compose down
```

The API URL is passed into the Vite build from `VITE_API_BASE_URL` in `.env`. You can override it for a build with:

```bash
VITE_API_BASE_URL=https://your-api.example.com/ docker compose up -d --build
```

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh
