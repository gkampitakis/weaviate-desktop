import { WLink } from "@/components/ui/wLink";
import TabContainer from "./components/TabContainer";
import { Separator } from "@/components/ui/separator";
import { Database, Globe, HardDrive, ArrowRight } from "lucide-react";

export const WelcomeName = "Welcome";

const Welcome = () => {
  return (
    <TabContainer className="flex items-center justify-center">
      <div className="flex w-full max-w-xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to Weaviate Desktop
          </h1>
          <p className="text-muted-foreground text-sm">
            Connect to your Weaviate instances and explore your collections,
            objects, and backups from one place.
          </p>
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Get started
          </p>
          <WLink
            href="https://weaviate.io/developers/weaviate/quickstart"
            className="group no-underline"
          >
            <div className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border bg-background">
                <Globe className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">Weaviate Cloud</span>
                <span className="text-xs text-muted-foreground">
                  Connect to a managed cloud instance
                </span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </WLink>
          <WLink
            href="https://weaviate.io/developers/weaviate/quickstart/local"
            className="group no-underline"
          >
            <div className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border bg-background">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">Run locally</span>
                <span className="text-xs text-muted-foreground">
                  Set up Weaviate on your own machine
                </span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </WLink>
        </div>

        <Separator />

        <div className="flex items-center gap-3">
          <Database className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Add a connection from the sidebar to start exploring your data.
          </p>
        </div>
      </div>
    </TabContainer>
  );
};

export default Welcome;
