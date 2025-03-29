import type { Collection } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { GetTotalObjects } from "wailsjs/go/weaviate/Weaviate";
import TabContainer from "./TabContainer";
import ObjectsList from "../objects-list/ObjectsList";

interface Props {
  collection: Collection;
}

const Collection: React.FC<Props> = ({ collection }) => {
  const [totalObjects, setTotalObjects] = useState(0);
  const { connectionID, name } = collection;

  useEffect(() => {
    const effect = async () => {
      try {
        const totalObjects = await GetTotalObjects(connectionID, name, "");

        setTotalObjects(totalObjects);
      } catch (error) {
        console.error(error);
      }
    };

    effect();
  }, [connectionID, name]);

  return (
    <TabContainer>
      <Tabs defaultValue="objects">
        <TabsList className="h-[30px] w-1/3">
          <TabsTrigger
            value="objects"
            className="data-[state=active]:text-primary cursor-pointer"
          >
            Objects ({totalObjects})
          </TabsTrigger>
          <TabsTrigger
            value="indexes"
            className="data-[state=active]:text-primary cursor-pointer"
          >
            Indexes
          </TabsTrigger>
          <TabsTrigger
            value="schema"
            className="data-[state=active]:text-primary cursor-pointer"
          >
            Schema
          </TabsTrigger>
        </TabsList>
        <TabsContent value="objects">
          <ObjectsList
            connectionID={collection.connectionID}
            name={collection.name}
          />
        </TabsContent>
        <TabsContent value="indexes">Not yet implemented</TabsContent>
        <TabsContent value="schema">Not yet implemented</TabsContent>
      </Tabs>
    </TabContainer>
  );
};

export default Collection;
