import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.jsx';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function GoogleIdentityInitializer() {
  useEffect(() => {
    if (!googleClientId || typeof window === 'undefined') {
      return;
    }

    const initializeGoogleIdentity = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          auto_select: false,
          cancel_on_tap_outside: false,
        });
      }
    };

    if (window.google?.accounts?.id) {
      initializeGoogleIdentity();
      return;
    }

    const existingScript = document.getElementById('google-gsi-script');
    if (existingScript) {
      existingScript.addEventListener('load', initializeGoogleIdentity, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleIdentity;
    document.head.appendChild(script);
  }, []);

  return null;
}

const app = (
  <StrictMode>
    <>
      {googleClientId ? <GoogleIdentityInitializer /> : null}
      <App />
    </>
  </StrictMode>
);

const rootElement = googleClientId ? (
  <GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>
) : (
  app
);

createRoot(document.getElementById('root')).render(rootElement);
