import { WLink } from "@/components/ui/wLink";
import TabContainer from "./components/TabContainer";
import SearchImage from "@/assets/images/file_search.svg";

export const WelcomeName = "Welcome";

const Welcome = () => {
  return (
    <TabContainer className="flex items-center justify-center">
      <div className="flex flex-row">
        <img
          src={SearchImage}
          className="pointer-events-none w-[250px] select-none"
          alt="Search Image"
        />
        <div className="m-2 flex-1">
          <h1 className="scroll-m-20 text-2xl font-extrabold tracking-tight lg:text-5xl">
            Welcome to Weaviate GUI
          </h1>
          <div className="flex flex-col py-4">
            <span>
              You can get started on{" "}
              <WLink
                href={"https://weaviate.io/developers/weaviate/quickstart"}
              >
                Weaviate Console
              </WLink>
            </span>
            <span>
              or{" "}
              <WLink href="https://weaviate.io/developers/weaviate/quickstart/local">
                locally
              </WLink>
              .
            </span>
          </div>
        </div>
      </div>
    </TabContainer>
  );
};

export default Welcome;
