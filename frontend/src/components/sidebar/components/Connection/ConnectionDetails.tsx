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
import { Label } from "../../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { TestConnection } from "wailsjs/go/weaviate/Weaviate";
import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Check, Eye, EyeOff, LoaderCircle, Star, X } from "lucide-react";
import { useConnectionStore } from "@/store/connection-store";
import { ConnectionStatus } from "@/types/enums";
import { errorReporting } from "@/lib/utils";
import {
  newConnectionColorBg400,
  connectionColors,
} from "@/lib/dynamic-colors";
import { Connection } from "@/types";
import { useShallow } from "zustand/shallow";
import { useTabStore } from "@/store/tab-store";

interface Props {
  open: boolean;
  setOpen: (v: boolean) => void;
  connection?: Connection;
}

const RestTestAfterMS = 3000;

interface NewConnectionForm {
  uri: string;
  name: string;
  apiKey?: string;
  color: string;
  favorite: boolean;
}

export const ConnectionDetails: React.FC<Props> = ({
  open,
  connection,
  setOpen,
}) => {
  const [testStatus, setTestStatus] = useState<
    "success" | "fail" | "loading"
  >();
  const [showPassword, setShowPassword] = useState(false);
  // a hacky way to capture the apiKey value
  const [apiKey, setApiKey] = useState<string | undefined>(undefined);
  const isEditing = !!connection;
  const defaultValues = isEditing
    ? {
        color: connection.color,
        favorite: connection.favorite,
        name: connection.name,
        uri: connection.uri,
      }
    : {
        color: connectionColors[0].value, // Default to "No color"
        favorite: false, // Default favorite to false
      };

  useEffect(() => {
    reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid, isDirty },
    getValues,
    reset,
  } = useForm<NewConnectionForm>({
    mode: "onChange",
    defaultValues,
  });
  const { saveConnection, updateConnection, connectToConnection } =
    useConnectionStore(
      useShallow((state) => ({
        saveConnection: state.save,
        updateConnection: state.update,
        connectToConnection: state.connect,
      }))
    );
  const updateTabsByConnection = useTabStore(
    (state) => state.updateByConnection
  );

  const save: SubmitHandler<NewConnectionForm> = async ({
    name,
    uri,
    apiKey,
    color,
    favorite,
  }) => {
    try {
      if (isEditing) {
        await updateConnection({
          id: connection.id,
          name,
          uri: uri ? uri : connection.uri,
          api_key: apiKey ? apiKey : connection.api_key,
          color,
          favorite,
        });
        if (connection.color !== color || connection.name !== name) {
          updateTabsByConnection(connection.id, name, color);
        }
      } else {
        await saveConnection({
          name,
          uri,
          status: ConnectionStatus.Disconnected,
          favorite,
          api_key: apiKey,
          color: color,
        });
      }

      setOpen(false);
      reset();
    } catch (error) {
      errorReporting(error);
    }
  };

  const [isSavingAndConnecting, setIsSavingAndConnecting] = useState(false);

  const saveAndConnect: SubmitHandler<NewConnectionForm> = async ({
    name,
    uri,
    apiKey,
    color,
    favorite,
  }) => {
    try {
      setIsSavingAndConnecting(true);
      if (isEditing) {
        await updateConnection({
          id: connection.id,
          name,
          uri: uri ? uri : connection.uri,
          api_key: apiKey ? apiKey : connection.api_key,
          color,
          favorite,
        });
        if (connection.color !== color || connection.name !== name) {
          updateTabsByConnection(connection.id, name, color);
        }
        await connectToConnection(connection.id);
      } else {
        const id = await saveConnection({
          name,
          uri,
          status: ConnectionStatus.Disconnected,
          favorite,
          api_key: apiKey,
          color: color,
        });
        await connectToConnection(id);
      }

      setOpen(false);
      reset();
    } catch (error) {
      errorReporting(error);
    } finally {
      setIsSavingAndConnecting(false);
    }
  };

  const testConnection = async () => {
    if (testStatus) {
      return;
    }
    setTestStatus("loading");

    try {
      await TestConnection({
        URI: getValues("uri"),
        ApiKey: getValues("apiKey") ? getValues("apiKey") : connection?.api_key,
      });

      setTestStatus("success");
    } catch (error) {
      setTestStatus("fail");
      errorReporting(error);
    }

    setTimeout(() => {
      setTestStatus(undefined);
    }, RestTestAfterMS);
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

  const disableWhenConnected =
    isEditing && connection.status === ConnectionStatus.Connected;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        className="sm:max-w-[50vw]"
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit" : "New"} Connection</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Edit "${connection.name}" connection details`
              : "Create a new Weaviate Connection"}
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
            <div className="gap flex flex-col gap-1">
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
            <div className="flex items-center justify-center pt-4">
              <Controller
                control={control}
                name="favorite"
                render={({ field }) => (
                  <div
                    className="flex cursor-pointer items-center"
                    onClick={() => field.onChange(!field.value)}
                  >
                    <Star
                      className={
                        field.value
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-400"
                      }
                      size={22}
                    />
                  </div>
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
                disabled: disableWhenConnected,
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
                placeholder={isEditing ? obscureApiKey(connection.api_key) : ""}
                type={
                  showPassword || (isEditing && !apiKey) ? "text" : "password"
                }
                className="pr-10"
                {...register("apiKey", {
                  disabled: disableWhenConnected,
                  onChange: () => {
                    setApiKey(getValues("apiKey"));
                  },
                })}
              />
              {!disableWhenConnected && getValues("apiKey") && (
                <button
                  type="button"
                  className="absolute top-0 right-0 h-full cursor-pointer px-3 py-2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  disabled={disableWhenConnected}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>
            <FieldError message={errors.apiKey?.message} />
          </div>
          <DialogFooter>
            <div className="flex min-w-full justify-between">
              <div>
                <Button variant="secondary" type="reset" onClick={OnCancel}>
                  Cancel
                </Button>
              </div>
              <div className="flex gap-2">
                {!disableWhenConnected && (
                  <TestConnectionButton
                    disabled={!isUriValid()}
                    test={testConnection}
                    status={testStatus}
                  />
                )}
                <Button disabled={!isValid || !isDirty} variant="secondary">
                  Save
                </Button>
                {!disableWhenConnected && (
                  <Button
                    disabled={!isValid || !isDirty || isSavingAndConnecting}
                    type="submit"
                    onClick={handleSubmit(saveAndConnect)}
                  >
                    {isSavingAndConnecting && (
                      <LoaderCircle className="animate-spin" />
                    )}
                    Save & Connect
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </form>
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

interface TestConnectionButtonProps {
  test: () => void;
  disabled: boolean;
  status: "success" | "fail" | "loading" | undefined;
}

const TestConnectionButton = ({
  test,
  disabled,
  status,
}: TestConnectionButtonProps) => {
  return (
    <Button
      disabled={disabled}
      variant="secondary"
      type="button"
      onClick={test}
    >
      Test
      {status === "loading" && <LoaderCircle className="animate-spin" />}
      {status === "success" && <Check className="text-green-600" />}
      {status === "fail" && <X className="text-red-600" />}
    </Button>
  );
};

const obscureApiKey = (apiKey?: string) => {
  if (!apiKey) return "";
  const length = apiKey.length;
  if (length <= 3) return apiKey;
  return `${apiKey.slice(0, 3)}${"*".repeat(length - 3)}`;
};
