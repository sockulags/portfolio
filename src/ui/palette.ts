export interface Command {
  id: string;
  label: string;
  group: string;
  hint?: string;
  run: () => void;
}

/**
 * Kommandopalett (Ctrl/Cmd+K): fuzzy-filter, piltangenter, Enter för att köra.
 * Kommandolistan byggs om vid varje öppning så språk/tema alltid är aktuellt.
 */
export class CommandPalette {
  private overlay: HTMLElement;
  private input: HTMLInputElement;
  private list: HTMLElement;
  private commands: Command[] = [];
  private filtered: Command[] = [];
  private selected = 0;
  private returnFocus: HTMLElement | null = null;
  private getCommands: () => Command[];
  private placeholder: () => string;
  private emptyText: () => string;

  constructor(opts: { getCommands: () => Command[]; placeholder: () => string; emptyText: () => string }) {
    this.getCommands = opts.getCommands;
    this.placeholder = opts.placeholder;
    this.emptyText = opts.emptyText;

    this.overlay = document.createElement("div");
    this.overlay.className = "palette-overlay";
    this.overlay.innerHTML = `
      <div class="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <input class="palette-input" type="text" spellcheck="false" autocomplete="off"
          role="combobox" aria-expanded="true" aria-controls="palette-listbox" aria-autocomplete="list" />
        <div class="palette-list" id="palette-listbox" role="listbox"></div>
      </div>`;
    document.body.append(this.overlay);
    this.input = this.overlay.querySelector(".palette-input")!;
    this.list = this.overlay.querySelector(".palette-list")!;

    this.overlay.addEventListener("pointerdown", (e) => {
      if (e.target === this.overlay) this.close();
    });
    this.input.addEventListener("input", () => this.filter());
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.select(this.selected + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.select(this.selected - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.runSelected();
      } else if (e.key === "Tab") {
        // fokusfälla: paletten är en modal med ett enda fokusmål
        e.preventDefault();
      }
    });
  }

  get isOpen(): boolean {
    return this.overlay.classList.contains("is-open");
  }

  open(): void {
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.commands = this.getCommands();
    this.input.placeholder = this.placeholder();
    this.input.value = "";
    this.overlay.classList.add("is-open");
    this.filter();
    this.input.focus();
  }

  close(): void {
    if (!this.isOpen) return;
    this.overlay.classList.remove("is-open");
    this.input.blur();
    this.returnFocus?.focus();
    this.returnFocus = null;
  }

  toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  private filter(): void {
    const q = this.input.value.trim().toLowerCase();
    this.filtered = q
      ? this.commands.filter((c) => {
          // enkel fuzzy: alla tecken i ordning
          let i = 0;
          const hay = (c.label + " " + c.group).toLowerCase();
          for (const ch of q) {
            i = hay.indexOf(ch, i);
            if (i === -1) return false;
            i++;
          }
          return true;
        })
      : [...this.commands];
    this.selected = 0;
    this.render();
  }

  private select(idx: number): void {
    if (this.filtered.length === 0) return;
    this.selected = (idx + this.filtered.length) % this.filtered.length;
    this.render();
    this.list.querySelector(".is-selected")?.scrollIntoView({ block: "nearest" });
  }

  private runSelected(): void {
    const cmd = this.filtered[this.selected];
    if (!cmd) return;
    this.close();
    cmd.run();
  }

  private render(): void {
    if (this.filtered.length === 0) {
      this.list.innerHTML = `<div class="palette-empty">${this.emptyText()}</div>`;
      return;
    }
    let html = "";
    let lastGroup = "";
    this.filtered.forEach((c, i) => {
      if (c.group !== lastGroup) {
        html += `<div class="palette-group">${c.group}</div>`;
        lastGroup = c.group;
      }
      html += `<button class="palette-item${i === this.selected ? " is-selected" : ""}" data-idx="${i}" id="palette-opt-${i}" role="option" aria-selected="${i === this.selected}" tabindex="-1">
        <span>${c.label}</span>${c.hint ? `<kbd>${c.hint}</kbd>` : ""}
      </button>`;
    });
    this.list.innerHTML = html;
    // skärmläsaren följer pilvalet via aria-activedescendant
    this.input.setAttribute("aria-activedescendant", this.filtered.length ? `palette-opt-${this.selected}` : "");
    this.list.querySelectorAll<HTMLButtonElement>(".palette-item").forEach((el) => {
      el.addEventListener("pointerenter", () => {
        this.selected = Number(el.dataset.idx);
        this.list.querySelectorAll(".palette-item").forEach((n, i) => n.classList.toggle("is-selected", i === this.selected));
      });
      el.addEventListener("click", () => {
        this.selected = Number(el.dataset.idx);
        this.runSelected();
      });
    });
  }
}
