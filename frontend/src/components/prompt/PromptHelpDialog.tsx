import { CircleQuestionMark } from 'lucide-react'
import { Dialog, DialogContent } from '../ui'

function Tag({ children }: { children: string }) {
  return (
    <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[10px] text-lime">{children}</code>
  )
}

export function PromptHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="How to write the prompt" className="max-w-lg">
        <div className="space-y-4 text-xs leading-6 text-text-2">
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-text">
              <CircleQuestionMark className="size-3.5 text-lime" /> Attachments are numbered in the order you add them
            </p>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>
                Images (up to 6) → <Tag>{'<Picture 1>'}</Tag> … <Tag>{'<Picture 6>'}</Tag>
              </li>
              <li>
                Audio (up to 3) → <Tag>{'<Audio 1>'}</Tag> … <Tag>{'<Audio 3>'}</Tag>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-medium text-text">FastH3 reference tags</p>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>
                <Tag>{'<Subject 1>'}</Tag> comes from <Tag>{'<Picture 1>'}</Tag>
              </li>
              <li>
                <Tag>{'<Audio 1>'}</Tag> is the voice for <Tag>{'<Subject 1> (S1)'}</Tag>
              </li>
              <li>…and so on for 2–6 (only 1–3 can have a voice reference).</li>
            </ul>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-medium text-text">Dialogue</p>
            <p>
              Write lines inline or on separate lines using <Tag>S1:</Tag> … <Tag>S6:</Tag>. They are converted to{' '}
              <Tag>{'<d>[English] …</d>'}</Tag> automatically.
            </p>
            <pre className="mt-1 overflow-x-auto rounded-lg border border-line bg-black/30 p-2 font-mono text-[10px] text-text-2">
{`S1: Hello there. S2: Hi, how are you?`}
            </pre>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-medium text-text">Example prompt</p>
            <pre className="overflow-x-auto rounded-lg border border-line bg-black/30 p-2 font-mono text-[10px] text-text-2">
{`A rainy café at night. S1: Hello there. S2: Hi, how are you?`}
            </pre>
          </div>

          <p className="text-[10px] text-text-3">
            Tip: if your prompt already contains a <Tag>subject_definitions:</Tag> section, it is used verbatim. Use the
            Auto Prompt Setup dialog for a guided builder.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
