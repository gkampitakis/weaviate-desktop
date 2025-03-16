import React from "react";
import Sidebar from "./components/sidebar/Sidebar";
import Main from "./main/Main";

const App: React.FC = () => {
  return (
    <div className="flex flex-row h-screen">
      <Sidebar />
      <Main />
    </div>
  );
};

export default App;
