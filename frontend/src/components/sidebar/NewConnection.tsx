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
import { TestConnection } from "../../../wailsjs/go/weaviate/Weaviate";
import { toast } from "sonner";
import { useState } from "react";
import { Check, LoaderCircle, X } from "lucide-react";

interface Props {
  open: boolean;
  setOpen: (v: boolean) => void;
}

interface NewConnectionForm {
  uri: string;
  name: string;
}

// FIXME: handle error
// FIXME: add a loader on the button
// FIXME: test should be enabled when URI only exists
//

export const NewConnection: React.FC<Props> = ({ open, setOpen }) => {
  const [disabled, setDisabled] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    getValues,
    // clearErrors,
    // control,
    reset,
  } = useForm<NewConnectionForm>({ disabled });

  const onSubmit: SubmitHandler<NewConnectionForm> = (data) => {
    console.log(data);
  };

  const testConnection = async () => {
    console.log("testing connection");
    try {
      await TestConnection(getValues("uri"));
    } catch (error) {
      console.error(error);
      toast(String(error.error), { duration: 10000 });
    }
  };

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) {
      reset();
    }
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
          <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
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
                  <Button variant="secondary" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={!getValues("uri")}
                    variant="secondary"
                    onClick={testConnection}
                  >
                    Test
                    {/* <LoaderCircle className="animate-spin" /> */}
                    {/* <Check className="text-green-600" /> */}
                    {/* <X className="text-red-500" /> */}
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
