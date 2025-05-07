import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { TestConnection } from "wailsjs/go/weaviate/Weaviate";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Check, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useConnectionStore } from "@/store/connection-store";
import { ConnectionStatus } from "@/types/enums";
import { errorReporting } from "@/lib/utils";
import {
  newConnectionColorBg400,
  connectionColors,
} from "@/lib/dynamic-colors";

interface Props {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const RestTestAfterSuccessMS = 3000;

interface NewConnectionForm {
  uri: string;
  name: string;
  apiKey?: string;
  color: string;
  favorite: boolean;
}

export const NewConnection: React.FC<Props> = ({ open, setOpen }) => {
  const [testLoading, setTestLoading] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid, isDirty },
    getValues,
    reset,
  } = useForm<NewConnectionForm>({
    mode: "onChange",
    defaultValues: {
      color: connectionColors[0].value, // Default to "No color"
      // FIXME:
      favorite: false, // Default favorite to false
    },
  });
  const saveConnection = useConnectionStore((state) => state.save);

  const save: SubmitHandler<NewConnectionForm> = async ({
    name,
    uri,
    apiKey,
    color,
    favorite,
  }) => {
    try {
      await saveConnection({
        name,
        uri,
        status: ConnectionStatus.Disconnected,
        favorite,
        api_key: apiKey,
        color: color,
      });
      setOpen(false);
      reset();
    } catch (error) {
      errorReporting(error);
    }
  };

  const testConnection = async () => {
    if (testSuccess) {
      return;
    }
    setTestLoading(true);

    try {
      await TestConnection({
        URI: getValues("uri"),
        ApiKey: getValues("apiKey"),
      });

      setTestSuccess(true);

      setTimeout(() => {
        setTestSuccess(false);
      }, RestTestAfterSuccessMS);
    } catch (error) {
      errorReporting(error);
    }

    setTestLoading(false);
  };

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) {
      reset();
    }
  };

  const OnCancel = () => {
    setOpen(false);
    reset();
  };

  // Function to check if URI is valid for the test button
  const isUriValid = () => {
    if (!getValues("uri")) return false;

    try {
      const url = new URL(getValues("uri"));
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        className="sm:max-w-[50vw]"
      >
        <DialogHeader>
          <DialogTitle>New Connection</DialogTitle>
          <DialogDescription>
            Create a new Weaviate Connection
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(save)}
          className="flex flex-col gap-4"
          autoComplete="off"
        >
          <div className="flex flex-row gap-4">
            <div className="gap flex flex-1 flex-col gap-1">
              <Label className="gap-0">
                <span className="text-xs">*</span>Name
              </Label>
              <Input
                id="name"
                placeholder="e.g. my-connection"
                {...register("name", {
                  required: "Name is required",
                })}
              />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="gap flex flex-1 flex-col gap-1">
              <Label>Color</Label>
              <Controller
                control={control}
                name="color"
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger className="flex flex-1">
                      <SelectValue placeholder="Select a color" />
                    </SelectTrigger>
                    <SelectContent>
                      {connectionColors.map((color) => (
                        <SelectItem
                          key={color.value}
                          value={color.value}
                          className="flex items-center gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-4 w-4 rounded-full border border-gray-300 ${newConnectionColorBg400[color.value]}`}
                            />
                            {color.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="gap-0">
              <span className="text-xs">*</span>URI
            </Label>
            <Input
              id="uri"
              {...register("uri", {
                required: "URI is required",
                validate: {
                  validUrl: (value) => {
                    try {
                      const url = new URL(value);
                      return (
                        url.protocol === "http:" ||
                        url.protocol === "https:" ||
                        "URI must start with http:// or https://"
                      );
                    } catch {
                      return "Please enter a valid URL";
                    }
                  },
                },
              })}
              placeholder="e.g. http://localhost:8080"
            />
            <FieldError message={errors.uri?.message} />
          </div>
          <Separator />
          <h1 className="text-sm font-semibold text-gray-500">
            Authentication
          </h1>
          <div className="flex flex-col gap-1">
            <Label>Api Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showPassword ? "text" : "password"}
                {...register("apiKey")}
              />
              <button
                type="button"
                className="absolute top-0 right-0 h-full cursor-pointer px-3 py-2 text-gray-400 hover:text-gray-600 focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <FieldError message={errors.apiKey?.message} />
          </div>
        </form>
        <DialogFooter>
          <div className="flex min-w-full justify-between">
            <div>
              <Button variant="secondary" type="reset" onClick={OnCancel}>
                Cancel
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={!isUriValid()}
                variant="secondary"
                type="button"
                onClick={testConnection}
              >
                Test
                {testLoading && <LoaderCircle className="animate-spin" />}
                {testSuccess && <Check className="text-green-600" />}
              </Button>
              <Button disabled={!isValid || !isDirty} type="submit">
                Save
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const FieldError = ({ message }: { message?: string }) => {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-red-500">{message}</p>;
};
