import { Bold, Italic, List, ListOrdered, Underline } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
}

function ToolbarButton(props: { onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-100"
      title={props.label}
    >
      {props.icon}
    </button>
  );
}

export function Editor({ value, onChange }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const run = (command: string) => {
    document.execCommand(command, false);
    onChange(editorRef.current?.innerHTML ?? "");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
        <ToolbarButton onClick={() => run("bold")} icon={<Bold size={16} />} label="Bold" />
        <ToolbarButton onClick={() => run("italic")} icon={<Italic size={16} />} label="Italic" />
        <ToolbarButton onClick={() => run("underline")} icon={<Underline size={16} />} label="Underline" />
        <ToolbarButton onClick={() => run("insertUnorderedList")} icon={<List size={16} />} label="Bullets" />
        <ToolbarButton onClick={() => run("insertOrderedList")} icon={<ListOrdered size={16} />} label="Numbers" />
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(event) => onChange((event.target as HTMLDivElement).innerHTML)}
        className="min-h-[240px] rounded-xl border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-800 outline-none focus:border-ink"
      />
    </div>
  );
}
