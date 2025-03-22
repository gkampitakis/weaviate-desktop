import React, { useRef, useState } from "react";
import { Tabs } from "antd";
import { useTabStore } from "@/store/tab-store";
import { useShallow } from "zustand/shallow";
import { X } from "lucide-react";
import TabLabel from "@/components/tabs/TabLabel";

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

const Main = () => {
  const { add, remove, tabs } = useTabStore(
    useShallow((state) => ({ ...state }))
  );
  const [activeTab, setActiveTab] = useState(
    tabs.length > 0 ? tabs[0].key : undefined
  );
  const newTabIndex = useRef(0);

  const onChange = (key: string) => {
    setActiveTab(key);
  };

  const newTab = () => {
    newTabIndex.current += 1;

    add({
      key: newTabIndex.current.toString(),
      label: <TabLabel>New Tab</TabLabel>,
      children: <div>Content of new Tab {newTabIndex.current}</div>,
    });

    setActiveTab(newTabIndex.current.toString());
  };

  const removeTab = (key?: TargetKey) => {
    if (!key) return;

    let newActiveKey = activeTab;

    if (tabs.length > 1 && newActiveKey === key) {
      newActiveKey = tabs[tabs.length - 2].key;
    }

    remove(key.toString());
    setActiveTab(newActiveKey);
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
