import type { Collection as CollectionI } from "@/types";
import MultiTenantCollection from "./MultiTenantCollection";
import SingleTenantCollection from "./SingleTenantCollection";

interface Props {
  collection: CollectionI;
}

const HOCollection: React.FC<Props> = ({ collection }) => {
  if (collection.multiTenancyConfig?.enabled) {
    return <MultiTenantCollection collection={collection} />;
  }

  return <SingleTenantCollection collection={collection} />;
};

export default HOCollection;
