import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout({children}) {
  return (
    <QueryClientProvider client={queryClient}>
      <link
        href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Cairo', system-ui, sans-serif;
          direction: rtl;
          background: #FFF9FB;
          color: #1A0910;
          -webkit-font-smoothing: antialiased;
        }
        a, input, textarea, select, button {
          font-family: 'Cairo', system-ui, sans-serif;
        }
      `}</style>
      {children}
    </QueryClientProvider>
  );
}