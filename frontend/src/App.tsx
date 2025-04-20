import React from "react";
import Sidebar from "./components/sidebar/Sidebar";
import Tabs from "./components/tabs/Tabs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./components/ui/resizable";

const App: React.FC = () => {
  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="flex h-screen flex-row"
    >
      <ResizablePanel
        minSize={10}
        defaultSize={20}
        maxSize={45}
        className="top-0 left-0 flex h-screen min-w-64 flex-1 flex-col border-r border-gray-200 bg-gray-100 text-gray-700"
      >
        <Sidebar />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel className="flex flex-5 flex-col">
        <Tabs />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default App;
