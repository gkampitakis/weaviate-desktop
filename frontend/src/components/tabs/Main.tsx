import React from "react";
import { Tabs } from "antd";
import { useTabStore } from "@/store/tab-store";
import { useShallow } from "zustand/shallow";
import { X } from "lucide-react";
import TabLabel from "@/components/tabs/TabLabel";

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

const Main = () => {
  const { add, remove, setActiveTab, nextIndex, tabs, activeTab } = useTabStore(
    useShallow((state) => ({
      add: state.add,
      remove: state.remove,
      tabs: state.tabs,
      setActiveTab: state.setActive,
      activeTab: state.active,
      nextIndex: state.nextIndex,
    }))
  );

  const onChange = (key: string) => {
    setActiveTab(key);
  };

  const newTab = () => {
    const newTabIndex = nextIndex();

    add({
      key: newTabIndex.toString(),
      label: <TabLabel>New Tab</TabLabel>,
      children: <div>Content of new Tab {newTabIndex}</div>,
    });

    setActiveTab(newTabIndex.toString());
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
      className="bg-gray-100"
    />
  );
};

export default Main;
