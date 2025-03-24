import TabContainer from "./TabContainer";
import SearchImage from "@/assets/images/file_search.svg";

const Welcome = () => {
  return (
    <TabContainer className="flex items-center justify-center">
      <div className="flex flex-row">
        <img
          src={SearchImage}
          className="w-[400px] select-none pointer-events-none"
          alt="Search Image"
        />

        <div className="flex-1 ">
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
            Welcome to Weaviate GUI
          </h1>
          <div className="flex flex-col py-10">
            <span>
              You can get started on{" "}
              <a
                href="https://weaviate.io/developers/weaviate/quickstart"
                target="_blank"
              >
                Weaviate Console
              </a>
            </span>
            <span>
              or{" "}
              <a
                href="https://weaviate.io/developers/weaviate/quickstart/local"
                target="_blank"
              >
                locally
              </a>
              .
            </span>
          </div>
        </div>
      </div>
    </TabContainer>
  );
};

export default Welcome;
