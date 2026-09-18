import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Web-only HTML shell. Har static-rendered page isi ke andar aata hai.
 *
 * Yeh file SIRF web par chalti hai — native builds ise kabhi nahi dekhte.
 * Yahan koi app logic mat daalna; yeh sirf document wrapper hai.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover taaki notch wale phones par safe areas sahi rahein */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>NearBux</title>
        <meta
          name="description"
          content="Fresh groceries and local stores, delivered near you."
        />
        <meta name="theme-color" content="#2563EB" />

        {/*
          RN ka body scroll reset. Iske bina web par do scroll containers ban
          jaate hain (document aur RN ka root), aur page do baar scroll hota
          hua mehsoos hota hai.
        */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: backgroundStyle }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Body ka background app ke background se match karta hai. Iske bina
// overscroll par white flash dikhta hai, aur centered mobile column ke
// dono taraf gutters bhi white dikhte.
const backgroundStyle = `
body { background-color: #F9FAFB; }
`;
