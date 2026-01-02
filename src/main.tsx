import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { NextIntlClientProvider } from 'next-intl';
import { TooltipProvider } from './components/ui/tooltip'; // Import TooltipProvider
import { BrowserRouter } from 'react-router-dom';
import enMessages from '@/messages/en.json';
import zhMessages from '@/messages/zh.json';
import jaMessages from '@/messages/ja.json';

const messages = {
  en: enMessages,
  zh: zhMessages,
  ja: jaMessages,
};

const locale = 'en'; // Set your default locale here

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <NextIntlClientProvider locale={locale} messages={messages[locale]}>
        <TooltipProvider> {/* Wrap your App with TooltipProvider */}
            <App />
        </TooltipProvider>
      </NextIntlClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
