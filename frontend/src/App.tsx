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
      className="flex flex-row h-screen"
    >
      <ResizablePanel
        minSize={10}
        defaultSize={20}
        maxSize={45}
        className="flex h-screen min-w-64 bg-gray-100 border-r border-gray-200 text-gray-700 left-0 top-0 flex-1 flex-col"
      >
      <Sidebar />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel className="flex flex-col flex-5">
        <Tabs />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default App;
