import { useEffect, useRef } from "react";

type Props = {
  valueHtml: string;
  onChangeHtml: (html: string) => void;
  disabled?: boolean;
};

function exec(cmd: string, value?: string) {
  // Magyar komment: execCommand deprecated, de stabilan működik egyszerű toolbarhoz (web+NUI)
  document.execCommand(cmd, false, value);
}

export default function ReportEditor(props: Props) {
  const { valueHtml, onChangeHtml, disabled } = props;
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Magyar komment: csak akkor írjuk be, ha eltér (különben ugrál a kurzor)
    if (el.innerHTML !== valueHtml) {
      el.innerHTML = valueHtml || "";
    }
  }, [valueHtml]);

  function focusEditor() {
    ref.current?.focus();
  }

  function handleInput() {
    const html = ref.current?.innerHTML ?? "";
    onChangeHtml(html);
  }

  function handleBold() {
    focusEditor();
    exec("bold");
    handleInput();
  }

  function handleItalic() {
    focusEditor();
    exec("italic");
    handleInput();
  }

  function handleUnderline() {
    focusEditor();
    exec("underline");
    handleInput();
  }

  function handleUl() {
    focusEditor();
    exec("insertUnorderedList");
    handleInput();
  }

  function handleOl() {
    focusEditor();
    exec("insertOrderedList");
    handleInput();
  }

  function handleLink() {
    focusEditor();
    const url = prompt("Link (https://...):", "https://") ?? "";
    const u = url.trim();
    if (!u) return;

    // Magyar komment: XSS védelem - csak http/https URL-ek engedélyezettek
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        alert("Csak http:// vagy https:// kezdetű linkek engedélyezettek.");
        return;
      }
    } catch {
      alert("Érvénytelen URL formátum.");
      return;
    }

    exec("createLink", u);
    handleInput();
  }

  function handleUnlink() {
    focusEditor();
    exec("unlink");
    handleInput();
  }

  function handleImage() {
    focusEditor();
    const url = prompt("Kép URL (jpg/png/webp):", "https://") ?? "";
    const u = url.trim();
    if (!u) return;

    // Magyar komment: XSS védelem - csak http/https URL-ek engedélyezettek
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        alert("Csak http:// vagy https:// kezdetű kép URL-ek engedélyezettek.");
        return;
      }
    } catch {
      alert("Érvénytelen URL formátum.");
      return;
    }

    // Magyar komment: XSS védelem - HTML attribútum escapelés
    const escapedUrl = u.replace(/"/g, "&quot;").replace(/'/g, "&#39;");

    exec(
      "insertHTML",
      `<img src="${escapedUrl}" alt="kép" style="max-width:100%;height:auto;display:block;margin:8px 0;border:1px solid rgba(255,255,255,0.12);" />`
    );
    handleInput();
  }

  function handleClear() {
    focusEditor();
    exec("removeFormat");
    handleInput();
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button className="hpx-btn" onClick={handleBold} disabled={disabled}>
          <b>B</b>
        </button>
        <button className="hpx-btn" onClick={handleItalic} disabled={disabled}>
          <i>I</i>
        </button>
        <button className="hpx-btn" onClick={handleUnderline} disabled={disabled}>
          <u>U</u>
        </button>

        <button className="hpx-btn" onClick={handleUl} disabled={disabled}>• Lista</button>
        <button className="hpx-btn" onClick={handleOl} disabled={disabled}>1. Lista</button>

        <button className="hpx-btn" onClick={handleLink} disabled={disabled}>Link</button>
        <button className="hpx-btn" onClick={handleUnlink} disabled={disabled}>Link törlés</button>

        <button className="hpx-btn hpx-btnAccent" onClick={handleImage} disabled={disabled}>Kép</button>
        <button className="hpx-btn" onClick={handleClear} disabled={disabled}>Formázás törlés</button>
      </div>

      <div
        ref={ref}
        contentEditable={!disabled}
        onInput={handleInput}
        suppressContentEditableWarning={true}
        style={{
          minHeight: 240,
          padding: "10px 10px",
          borderRadius: 0,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.18)",
          color: "rgba(255,255,255,0.92)",
          outline: "none",
          overflow: "auto",
          lineHeight: 1.45,
        }}
      />
    </div>
  );
}
