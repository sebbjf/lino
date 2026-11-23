import {
  Add01Icon,
  ArrowDown01Icon,
  Delete02Icon,
  PencilEdit01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  createBoard,
  deleteBoard,
  renameBoard,
  switchBoard,
} from "../data/storage.ts";
import { useBoard } from "../board/store.ts";

/** Name of the board on screen; opens the list of boards to switch, rename, delete or add one. */
export function BoardsMenu() {
  const boards = useBoard((s) => s.boards);
  const boardId = useBoard((s) => s.boardId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const current = boards.find((b) => b.id === boardId);
  const doomed = boards.find((b) => b.id === deleting);

  const finish = (id: string, value: string) => {
    renameBoard(id, value);
    setEditing(null);
  };

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setEditing(null);
            setDeleting(null);
          }
        }}
      >
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={`Boards. Current: ${current?.name ?? 'Board'}`}
              className="flex max-w-[45vw] items-center gap-1.5 rounded-full border bg-card/90 py-1.5 pr-2.5 pl-3.5 text-sm shadow-soft backdrop-blur outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:max-w-64"
            />
          }
        >
          <span className="truncate">{current?.name ?? "Board"}</span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={14}
            strokeWidth={2}
            aria-hidden
          />
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={8}
          className="w-72 gap-1 p-2"
        >
          <ul className="flex max-h-[50vh] flex-col gap-0.5 overflow-y-auto">
            {boards.map((b) => (
              <li key={b.id} className="flex items-center gap-1">
                {editing === b.id ? (
                  <form
                    className="flex flex-1 items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      finish(
                        b.id,
                        new FormData(e.currentTarget).get("name") as string,
                      );
                    }}
                  >
                    <Input
                      name="name"
                      aria-label="Board name"
                      defaultValue={b.name}
                      maxLength={60}
                      autoFocus
                      onFocus={(e) => e.currentTarget.select()}
                      onBlur={(e) => finish(b.id, e.currentTarget.value)}
                      onKeyDown={(e) =>
                        e.key === "Escape" &&
                        (e.stopPropagation(), setEditing(null))
                      }
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Save name"
                    >
                      <HugeiconsIcon icon={Tick02Icon} strokeWidth={1.8} />
                    </Button>
                  </form>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      className="min-w-0 flex-1 justify-start rounded-xl px-3"
                      aria-current={b.id === boardId}
                      onClick={() => {
                        switchBoard(b.id);
                        setOpen(false);
                      }}
                    >
                      <span
                        className={`truncate ${b.id === boardId ? "font-semibold" : ""}`}
                      >
                        {b.name}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Rename ${b.name}`}
                      onClick={() => setEditing(b.id)}
                    >
                      <HugeiconsIcon
                        icon={PencilEdit01Icon}
                        strokeWidth={1.8}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${b.name}`}
                      onClick={() => {
                        setOpen(false);
                        setDeleting(b.id);
                      }}
                    >
                      <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.8} />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <Button
            variant="ghost"
            className="justify-start gap-2 rounded-xl px-3"
            onClick={() => {
              createBoard();
              setOpen(false);
            }}
          >
            <HugeiconsIcon icon={Add01Icon} strokeWidth={1.8} />
            New board
          </Button>
        </PopoverContent>
      </Popover>
      <Dialog open={!!doomed} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogTitle>Delete “{doomed?.name}”?</DialogTitle>
          <DialogDescription>
            Everything on this board will be gone. This cannot be undone.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (doomed) deleteBoard(doomed.id);
                setDeleting(null);
              }}
            >
              Delete board
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
