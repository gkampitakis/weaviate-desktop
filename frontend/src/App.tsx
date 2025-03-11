import React, { useState } from "react";
import Sidebar from "./components/sidebar/Sidebar";
import { Connection, ConnectionStatus } from "@/types/index";

const App: React.FC = () => {
  const [connections] = useState<Connection[]>([
    { id: "1", name: "WCS Dev", starred: true },
    { id: "2", name: "WCS Prod (No W majority)" },
    { id: "3", name: "WCS Prod (wcs-prod user)" },
    // TODO: icon showing connected
    {
      id: "4",
      name: "WCS Staging",
      status: ConnectionStatus.Connected,
    },
  ]);

  return (
    <div className="flex flex-row h-screen">
      <Sidebar connections={connections} />
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
