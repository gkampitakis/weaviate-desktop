import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import App from "./App";
import { Toaster } from "./components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const container = document.getElementById("root");
const root = createRoot(container!);
const queryClient = new QueryClient();

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
    {/* className fixes the issue with dialog being on top of toaster */}
    <Toaster className="pointer-events-auto" />
  </React.StrictMode>
);
