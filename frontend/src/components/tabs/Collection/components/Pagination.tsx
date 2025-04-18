import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";

interface Props {
  className?: string;
  pageSize: number;
  setPageSize: (p: number) => void;
  next: () => void;
  previous: () => void;
  currentPage: number;
  totalPages: number;
  loading?: boolean;
}

const Pagination: React.FC<Props> = ({
  className,
  pageSize,
  setPageSize,
  next,
  previous,
  currentPage,
  totalPages,
  loading,
}) => {
  const disabledNext =
    loading || totalPages === 0 || currentPage === totalPages;

  const disabledPrevious = loading || totalPages === 0 || currentPage === 1;

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
        <span className="flex text-center">
          {totalPages === 0 ? "0 of 0" : `${currentPage} of ${totalPages}`}
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
        <SelectTrigger size="sm" className="pr-1 pl-2" disabled={loading}>
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
