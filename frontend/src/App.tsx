import React from "react";
import Sidebar from "./components/sidebar/Sidebar";
import Tabs from "./components/tabs/Tabs";
import { Group, Panel } from "react-resizable-panels";

const App: React.FC = () => {
  return (
    <Group orientation="horizontal" className="h-screen">
      <Panel
        minSize="15%"
        defaultSize="25%"
        maxSize="45%"
        className="flex min-w-64 flex-col border-r border-gray-200 bg-gray-100 text-gray-700"
      >
        <Sidebar />
      </Panel>
      <Panel className="flex flex-col">
        <Tabs />
      </Panel>
    </Group>
  );
};

export default App;
