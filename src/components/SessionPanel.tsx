import type { ActionSession } from "../types/domain";
import { useState } from "react";

export function SessionPanel({ session, onSendInput }: { session: ActionSession | null; onSendInput: (input: string) => void }) {
  const [input, setInput] = useState("");

  if (!session) {
    return null;
  }

  const running = session.status === "running" || session.status === "starting";

  return (
    <section className="session-panel">
      <div className="section-title">
        <h2>{session.kind} session</h2>
        <span>{session.status}</span>
      </div>
      <p>{session.message}</p>
      {session.recentOutput.length > 0 && (
        <pre>{session.recentOutput.join("\n")}</pre>
      )}
      {running && (
        <form
          className="session-input"
          onSubmit={(event) => {
            event.preventDefault();
            const value = input.trim();
            if (!value) return;
            onSendInput(value);
            setInput("");
          }}
        >
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="세션 입력" />
          <button type="submit">Send</button>
        </form>
      )}
    </section>
  );
}
