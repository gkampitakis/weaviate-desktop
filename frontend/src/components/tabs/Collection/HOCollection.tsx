import MultiTenantCollection from "./MultiTenantCollection";
import SingleTenantCollection from "./SingleTenantCollection";
import { Props } from "./types";

const HOCollection: React.FC<Props> = ({ collection, selectedTab }) => {
  if (collection.multiTenancyConfig?.enabled) {
    return (
      <MultiTenantCollection
        collection={collection}
        selectedTab={selectedTab}
      />
    );
  }

  return (
    <SingleTenantCollection collection={collection} selectedTab={selectedTab} />
  );
};

export default HOCollection;
