import type { Collection as CollectionI } from "@/types";
import MultiTenancyCollection from "./MultiTenancyCollection";
import Collection from "./Collection";

interface Props {
  collection: CollectionI;
}

const GeneralCollection: React.FC<Props> = ({ collection }) => {
  if (collection.multiTenancyConfig?.enabled) {
    return <MultiTenancyCollection collection={collection} />;
  }

  return <Collection collection={collection} />;
};

export default GeneralCollection;
