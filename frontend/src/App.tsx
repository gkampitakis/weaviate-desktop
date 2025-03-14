import React from "react";
import Sidebar from "./components/sidebar/Sidebar";

const App: React.FC = () => {
  return (
    <div className="flex flex-row h-screen">
      <Sidebar />
      <div className="flex flex-col flex-5">
        <div className="flex-1 bg-gray-100 text-white h-16 flex items-center px-4">
          <span className="text-black">Hello World</span>
        </div>
        <main className="flex-2 bg-white min-h-[95vh]">
          <div className="p-6">
            <h2 className="text-2xl font-bold">Welcome to Weaviate GUI</h2>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;

// Backlog

// Next feature create connect clients and add tabs so we can see data

// Add edit connection dialog
// Add favorite connection on creation
//  - Add validations for URI and input
//  - add permissions / credentials
//  - add random name generator for name if not present

// Can we add all methods even the "backend"  to the store? How does it handle errors ? This will reduce inconsistency between the frontend and backend

// Better error handling on
// - set favorite
// - remove connection
// - add connection

// Build connect option

// Backend fix context handling on storage
// think about migrations and how to handle them
// check about updating the client and the schema
// add better logger to wails with slogger
// how to handle failures in a graceful way?
// start adding unit tests slowly
