import React from "react";
import { Tabs as AntdTabs } from "antd";
import { useTabStore } from "@/store/tab-store";
import { useShallow } from "zustand/shallow";
import { X } from "lucide-react";
import Welcome from "./Welcome";
import NewTab, { NewTabName } from "./NewTab";
import GeneralTabLabel from "./components/GeneralTabLabel";
import type { DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import "./drag-tabs.css";

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

interface DraggableTabPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  "data-node-key": string;
}

const DraggableTabNode: React.FC<Readonly<DraggableTabPaneProps>> = ({
  ...props
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: props["data-node-key"],
    });

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    cursor: "move",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return React.cloneElement(props.children as React.ReactElement<any>, {
    ref: setNodeRef,
    style,
    ...attributes,
    ...listeners,
  });
};

const Tabs = () => {
  const { addNewTab, remove, setActiveTab, reorderTabs, tabs, activeTab } =
    useTabStore(
      useShallow((state) => ({
        addNewTab: state.add,
        remove: state.remove,
        tabs: state.tabs,
        setActiveTab: state.setActive,
        activeTab: state.active,
        reorderTabs: state.reorderTabs,
      }))
    );

  const onChange = (key: string) => {
    setActiveTab(key);
  };

  const newTab = () => {
    if (tabs.length === 0) {
      addNewTab({
        label: <GeneralTabLabel name="Welcome" />,
        children: <Welcome />,
        name: "Welcome",
      });
      return;
    }

    addNewTab({
      label: <GeneralTabLabel name={NewTabName} />,
      name: NewTabName,
      children: <NewTab />,
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

  const sensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (active.id !== over?.id) {
      reorderTabs(active.id.toString(), over?.id.toString() || "");
    }
  };

  return (
    <AntdTabs
      items={tabs}
      type="editable-card"
      removeIcon={<X size="1.2em" />}
      onChange={onChange}
      onEdit={onEdit}
      activeKey={activeTab}
      className="flex-1 bg-gray-100"
      renderTabBar={(tabBarProps, DefaultTabBar) => (
        <DndContext
          sensors={[sensor]}
          onDragEnd={onDragEnd}
          collisionDetection={closestCenter}
        >
          <SortableContext
            items={tabs.map((i) => i.key)}
            strategy={horizontalListSortingStrategy}
          >
            <DefaultTabBar {...tabBarProps}>
              {(node) => (
                <DraggableTabNode
                  {...(node as React.ReactElement<DraggableTabPaneProps>).props}
                  key={node.key}
                >
                  {node}
                </DraggableTabNode>
              )}
            </DefaultTabBar>
          </SortableContext>
        </DndContext>
      )}
    />
  );
};

export default Tabs;
