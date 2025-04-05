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
  return (
    <div
      className={`flex flex-row gap-1 items-center ${
        className ? className : ""
      }`}
    >
      {loading && (
        <LoaderCircle size={"1.3em"} className="animate-spin text-green-600" />
      )}
      <Select
        value={pageSize.toString()}
        onValueChange={(e) => {
          setPageSize(Number(e));
        }}
      >
        <span className="min-w-[20px]">
          {totalPages === 0 ? "0 of 0" : `${currentPage} of ${totalPages}`}
        </span>
        <ChevronLeft
          className={`p-1 rounded-full transition ${
            loading || currentPage === 1
              ? "opacity-50 cursor-not-allowed"
              : "cursor-pointer hover:bg-gray-200"
          }`}
          onClick={previous}
        />
        <ChevronRight
          className={`p-1 rounded-full transition ${
            loading || currentPage === totalPages
              ? "opacity-50 cursor-not-allowed"
              : "cursor-pointer hover:bg-gray-200"
          }`}
          onClick={next}
        />
        <SelectTrigger size="sm" className="pl-2 pr-1" disabled={loading}>
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
