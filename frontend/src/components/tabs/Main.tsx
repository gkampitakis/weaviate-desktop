import React from "react";
import { Tabs } from "antd";
import { useTabStore } from "@/store/tab-store";
import { useShallow } from "zustand/shallow";
import { X } from "lucide-react";
import TabLabel from "@/components/tabs/TabLabel";

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

const Main = () => {
  const { addNewTab, remove, setActiveTab, tabs, activeTab } = useTabStore(
    useShallow((state) => ({
      addNewTab: state.add,
      remove: state.remove,
      tabs: state.tabs,
      setActiveTab: state.setActive,
      activeTab: state.active,
    }))
  );

  const onChange = (key: string) => {
    setActiveTab(key);
  };

  const newTab = () => {
    addNewTab({
      label: <TabLabel>New Tab</TabLabel>,
      children: <div>Content of new Tab</div>,
    });
  };

  const removeTab = (key?: TargetKey) => {
    if (!key) return;
    remove(key.toString());
  };

  const onEdit = (targetKey: TargetKey, action: "add" | "remove") => {
    if (action === "add") newTab();
    else removeTab(targetKey);
  };

  return (
    <Tabs
      type="editable-card"
      items={tabs}
      removeIcon={<X size="1.2em" />}
      onChange={onChange}
      onEdit={onEdit}
      activeKey={activeTab}
      className="bg-gray-100 flex-1"
    />
  );
};

export default Main;
