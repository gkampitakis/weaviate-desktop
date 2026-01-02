import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface Props {
  handleSearch: (s: string) => void;
  resetSearch: () => void;
  searchObjects: number;
  executionTime: string;
  children: React.ReactNode;
  changeId: string;
}

const Search: React.FC<Props> = ({
  handleSearch,
  resetSearch,
  searchObjects,
  executionTime,
  changeId,
  children,
}) => {
  const [searchOptionsOpen, setSearchOptionsOpen] = useState(false);
  // Use changeId to reset the searchQuery state when it changes
  // This pattern is acceptable for derived/synchronized state
  const [lastChangeId, setLastChangeId] = useState(changeId);
  const [searchQuery, setSearchQuery] = useState("");

  if (changeId !== lastChangeId) {
    setSearchQuery("");
    setLastChangeId(changeId);
  }

  return (
    <>
      <Collapsible open={searchOptionsOpen} onOpenChange={setSearchOptionsOpen}>
        <Card className="mb-2 w-full">
          <CardContent className="flex flex-col">
            <div className="flex flex-row content-center items-center">
              <form
                className="relative flex w-full"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearch(searchQuery);
                }}
              >
                <input
                  type="text"
                  className="focus:ring-primary h-10 w-full rounded-md border px-4 py-0 focus:ring-2 focus:outline-none"
                  placeholder="Keyword Search"
                  autoComplete="off"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button
                  type="button"
                  className="absolute top-1/2 right-[90px] h-6 -translate-y-1/2"
                  onClick={() => {
                    setSearchQuery("");
                    resetSearch();
                  }}
                  variant="outline"
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  className="absolute top-1/2 right-2 h-6 -translate-y-1/2"
                >
                  Search
                </Button>
              </form>
              {/* <CollapsibleTrigger className="ml-2" asChild>
              <Button variant="ghost" size="sm" className="flex justify-start">
                <span>Options</span>
                {searchOptionsOpen ? (
                  <ChevronUp size="1em" />
                ) : (
                  <ChevronDown size="1em" />
                )}
              </Button>
            </CollapsibleTrigger> */}
            </div>
            <CollapsibleContent className="mt-2">TODO</CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>
      {children}
      <div
        className={`mt-1 flex justify-between ${!searchQuery ? "hidden" : ""}`}
      >
        <span className="text-xs text-gray-500">
          {searchObjects} results displayed
        </span>
        <span className="text-xs text-gray-500">
          Query took {executionTime}
        </span>
      </div>
    </>
  );
};

export default Search;
