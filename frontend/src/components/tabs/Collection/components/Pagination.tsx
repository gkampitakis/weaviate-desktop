import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";

interface BrowseProps {
  mode?: "browse";
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

interface SearchProps {
  mode: "search";
  searchPage: number;
  resultsOnPage: number;
  hasMore: boolean;
  /** True when next page would cross Weaviate's server-side cap. */
  capReached?: boolean;
}

type CommonProps = {
  className?: string;
  pageSize: number;
  setPageSize: (p: number) => void;
  next: () => void;
  previous: () => void;
  loading?: boolean;
  disabled?: boolean;
};

type Props = CommonProps & (BrowseProps | SearchProps);

const Pagination: React.FC<Props> = (props) => {
  const {
    className,
    pageSize,
    setPageSize,
    next,
    previous,
    disabled = false,
    loading,
  } = props;

  const isSearch = props.mode === "search";

  const disabledNext = isSearch
    ? loading || disabled || !props.hasMore
    : loading || props.totalPages === 0 || props.currentPage === props.totalPages || disabled;

  const disabledPrevious = isSearch
    ? loading || disabled || props.searchPage === 1
    : loading || props.totalPages === 0 || props.currentPage === 1 || disabled;

  const label = isSearch
    ? `Page ${props.searchPage} · ${props.resultsOnPage} result${props.resultsOnPage === 1 ? "" : "s"}`
    : props.totalPages === 0
      ? "0 of 0"
      : `${props.currentPage} - ${props.totalPages} of ${props.totalCount}`;

  return (
    <div
      className={`flex flex-row items-center gap-1 ${
        className ? className : ""
      }`}
    >
      {loading && (
        <LoaderCircle size="1.3em" className="animate-spin text-green-600" />
      )}
      <Select
        value={pageSize.toString()}
        onValueChange={(e) => {
          setPageSize(Number(e));
        }}
      >
        <span className={`flex text-center ${disabled ? "opacity-50" : ""}`}>
          {label}
        </span>
        <ChevronLeft
          className={`rounded-full p-1 transition ${
            disabledPrevious
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer hover:bg-gray-200"
          }`}
          onClick={() => {
            if (disabledPrevious) return;
            previous();
          }}
        />
        <ChevronRight
          className={`rounded-full p-1 transition ${
            disabledNext
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer hover:bg-gray-200"
          }`}
          onClick={() => {
            if (disabledNext) return;
            next();
          }}
        />
        <SelectTrigger
          size="sm"
          className="pr-1 pl-2"
          disabled={loading || disabled}
        >
          <SelectValue placeholder="Select page size" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="75">75</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

export default Pagination;
