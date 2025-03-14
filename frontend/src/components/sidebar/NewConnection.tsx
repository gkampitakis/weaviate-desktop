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
import { useForm, SubmitHandler } from "react-hook-form";
import { TestConnection } from "wailsjs/go/weaviate/Weaviate";
import { SaveConnection } from "wailsjs/go/sql/Storage";
import { toast } from "sonner";
import { useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { sql } from "wailsjs/go/models";
import { useConnectionsStore } from "@/store/connections-store";
import { ConnectionStatus } from "@/types";

interface Props {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const RestTestAfterSuccessMS = 3000;

interface NewConnectionForm {
  uri: string;
  name: string;
}

export const NewConnection: React.FC<Props> = ({ open, setOpen }) => {
  // const [disabled, setDisabled] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    getValues,
    reset,
  } = useForm<NewConnectionForm>({});
  const saveConnection = useConnectionsStore((state) => state.save);

  const save: SubmitHandler<NewConnectionForm> = async ({ name, uri }) => {
    try {
      const id = await SaveConnection(
        new sql.Connection({ uri: uri, name: name, favorite: false })
      );

      saveConnection({
        id,
        name,
        uri,
        status: ConnectionStatus.Disconnected,
        favorite: false,
      });
      setOpen(false);
      reset();
    } catch (error) {
      console.error(error);
      toast.error(String(error), {
        dismissible: true,
        duration: 5000,
        closeButton: true,
      });
    }
  };

  const testConnection = async () => {
    if (testSuccess) {
      return;
    }
    setTestLoading(true);

    try {
      await TestConnection(getValues("uri"));

      setTestSuccess(true);

      setTimeout(() => {
        setTestSuccess(false);
      }, RestTestAfterSuccessMS);
    } catch (error) {
      toast.error(String(error), {
        dismissible: true,
        duration: 5000,
        closeButton: true,
      });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        className="sm:max-w-[70vw]"
      >
        <DialogHeader>
          <DialogTitle>New Connection</DialogTitle>
          <DialogDescription>
            Create a new Weaviate Connection
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <form onSubmit={handleSubmit(save)} autoComplete="off">
            <div className="grid grid-rows-4 items-center">
              <Label>*Name</Label>
              <Input
                id="name"
                placeholder="e.g. my-connection"
                className="col-span-2"
                {...register("name")}
              />
              <FieldError
                show={Boolean(errors.name)}
                message={errors.name?.message}
              />
            </div>
            <div className="grid grid-rows-4 items-center">
              <Label>*URI</Label>
              <Input
                id="uri"
                {...register("uri", { required: true })}
                placeholder="e.g. http://localhost:8080"
                className="col-span-2"
              />
              <FieldError
                show={Boolean(errors.uri)}
                message={errors.uri?.message}
              />
            </div>
            <DialogFooter>
              <div className="flex justify-between min-w-full">
                <div>
                  <Button variant="secondary" type="reset" onClick={OnCancel}>
                    Cancel
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={!getValues("uri")}
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
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const FieldError = ({ message, show }: { message?: string; show: boolean }) => {
  if (!show) {
    return null;
  }

  return <p className="text-xs text-red-500">{message}</p>;
};
