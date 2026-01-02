import { TabsProps } from "antd";
import TabContainer from "../components/TabContainer";
import Nodes from "./Nodes";
import { Tabs as AntdTabs } from "antd";
import { useConnectionStore } from "@/store/connection-store";
import { useShallow } from "zustand/shallow";
import Backups from "./Backups";

export const ClusterInformationName = "ClusterInformation";

interface Props {
  connectionID: number;
}

const ClusterInformation = ({ connectionID }: Props) => {
  const { getConnection } = useConnectionStore(
    useShallow((state) => ({
      getConnection: state.get,
    }))
  );
  const connection = getConnection(connectionID);

  const items: TabsProps["items"] = [
    {
      key: "nodes",
      label: "Nodes",
      children: <Nodes connectionID={connectionID} />,
    },
  ];

  // For now assuming that RBAC and DB users are enabled together
  if (connection?.usersEnabled) {
    items.push(
      {
        key: "users",
        label: "Users",
        children: <div>Users Tab Content</div>,
      },
      {
        key: "roles",
        label: "Roles",
        children: <div>Roles Tab Content</div>,
      }
    );
  }

  if (connection?.backupModules?.length) {
    items.push({
      key: "backups",
      label: "Backups",
      children: (
        <Backups
          connectionID={connectionID}
          backends={connection.backupModules}
        />
      ),
    });
  }

  return (
    <TabContainer className="flex flex-col gap-1 overflow-y-auto">
      <AntdTabs
        defaultActiveKey="nodes"
        items={items}
        className="custom-green-tabs flex h-full w-full flex-row"
        tabBarStyle={{
          marginBottom: "16px",
        }}
      />
    </TabContainer>
  );
};

export default ClusterInformation;
