import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useOverwritePrompt } from '../data/boardDisk.ts'

export function OverwriteDialog() {
  const prompt = useOverwritePrompt((s) => s.prompt)

  return (
    <Dialog open={!!prompt} onOpenChange={(open) => { if (!open) prompt?.choose('cancel') }}>
      <DialogContent>
        <DialogTitle>Board file changed on disk</DialogTitle>
        <DialogDescription>
          “{prompt?.name}” has changed since Lino last opened or saved it. Overwrite it or save to another file.
        </DialogDescription>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => prompt?.choose('save-as')}>Save as…</Button>
          <Button variant="destructive" onClick={() => prompt?.choose('overwrite')}>Overwrite</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
