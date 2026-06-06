import { Toaster } from "sonner";
import { useAppController } from "./hooks/useAppController";
import { TrayPanel } from "./views/TrayPanel";

function App() {
  const controller = useAppController();

  return (
    <>
      <TrayPanel {...controller} />
      <Toaster position="bottom-center" richColors closeButton />
    </>
  );
}

export default App;
