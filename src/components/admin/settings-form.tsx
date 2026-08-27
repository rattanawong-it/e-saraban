"use client"

import { useActionState } from "react"
import { Loader2, Save } from "lucide-react"

import { COMMON, SETTINGS } from "@/constants"
import { YEAR_MODE_LABELS, YEAR_MODES, type SystemSettings } from "@/lib/settings/definitions"
import { Button } from "@/components/ui/button"
import { Checkbox, Label, Select, TextInput } from "@/components/ui/field"
import { Alert, Card, CardHeader } from "@/components/ui/primitives"
import { updateSettingsAction } from "@/server/actions/admin.actions"
import { IDLE_STATE } from "@/server/actions/types"

// หน้าตั้งค่าระบบ — ตาม project-ui/Admin Settings.dc.html
// ทุกค่าบันทึกพร้อมกันในทรานแซกชันเดียว และเขียน audit ทุกครั้ง

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "Word (.doc)",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word (.docx)",
  "application/vnd.ms-excel": "Excel (.xls)",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel (.xlsx)",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/tiff": "TIFF",
  "application/zip": "ZIP",
}

const ALL_MIME_TYPES = Object.keys(MIME_LABELS)

export function SettingsForm({ settings }: { settings: SystemSettings }) {
  const [state, formAction, pending] = useActionState(updateSettingsAction, IDLE_STATE)

  return (
    <form action={formAction} className="flex max-w-4xl flex-col gap-4">
      {state.status === "error" ? <Alert tone="danger" title={state.message} /> : null}
      {state.status === "success" ? <Alert tone="success" title={state.message} /> : null}

      <Card className="overflow-hidden">
        <CardHeader title={SETTINGS.numberingTitle} />
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-md min-w-0">
              <Label htmlFor="yearMode" className="mb-1">
                {SETTINGS.yearMode}
              </Label>
              <p className="text-micro leading-relaxed text-text-subtle">{SETTINGS.yearModeHint}</p>
            </div>
            <div className="w-64">
              <Select id="yearMode" name="yearMode" defaultValue={settings.numbering.yearMode}>
                {YEAR_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {YEAR_MODE_LABELS[mode]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-row-border pt-4">
            <div>
              <div className="text-label font-semibold text-text-strong">
                {SETTINGS.languageTitle}
              </div>
              <div className="mt-0.5 text-micro text-text-subtle">{SETTINGS.languageHint}</div>
            </div>
            <span className="rounded-full bg-secondary px-3.5 py-1.5 text-caption font-bold text-primary">
              {SETTINGS.languageValue}
            </span>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title={SETTINGS.fileTitle} />
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Label htmlFor="maxSizeMb" className="mb-1">
                {SETTINGS.maxSize}
              </Label>
              <p className="text-micro text-text-subtle">{SETTINGS.maxSizeHint}</p>
            </div>
            <div className="flex items-center gap-2.5">
              <TextInput
                id="maxSizeMb"
                name="maxSizeMb"
                type="number"
                min={1}
                max={200}
                defaultValue={settings.file.maxSizeMb}
                className="tabular w-24 text-center"
              />
              <span className="text-caption text-text-subtle">{SETTINGS.maxSizeUnit}</span>
            </div>
          </div>

          <div className="border-t border-row-border pt-4">
            <Label className="mb-2.5">{SETTINGS.allowedTypes}</Label>
            <div className="flex flex-wrap gap-2.5">
              {ALL_MIME_TYPES.map((mime) => (
                <label
                  key={mime}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-caption text-text-medium has-checked:border-primary has-checked:bg-secondary has-checked:text-primary"
                >
                  <Checkbox
                    name="allowedMimeTypes"
                    value={mime}
                    defaultChecked={settings.file.allowedMimeTypes.includes(mime)}
                    className="size-3.5"
                  />
                  {MIME_LABELS[mime]}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title={SETTINGS.passwordTitle} />
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="minLength" className="mb-0">
              {SETTINGS.minLength}
            </Label>
            <div className="flex items-center gap-2.5">
              <TextInput
                id="minLength"
                name="minLength"
                type="number"
                min={8}
                max={64}
                defaultValue={settings.password.minLength}
                className="tabular w-20 text-center"
              />
              <span className="text-caption whitespace-nowrap text-text-subtle">
                {SETTINGS.minLengthUnit}
              </span>
            </div>
          </div>

          <ToggleRow
            name="mustChangeOnFirstLogin"
            title={SETTINGS.mustChange}
            hint={SETTINGS.mustChangeHint}
            defaultChecked={settings.password.mustChangeOnFirstLogin}
          />

          <ToggleRow
            name="checkCommonPasswordList"
            title={SETTINGS.checkCommon}
            hint={SETTINGS.checkCommonHint}
            defaultChecked={settings.password.checkCommonPasswordList}
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title={SETTINGS.sessionTitle} />
        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              name="idleMinutes"
              label={SETTINGS.idleTimeout}
              unit={SETTINGS.idleUnit}
              defaultValue={settings.session.idleMinutes}
              min={5}
              max={480}
            />
            <NumberField
              name="absoluteHours"
              label={SETTINGS.absoluteTimeout}
              unit={SETTINGS.absoluteUnit}
              defaultValue={settings.session.absoluteHours}
              min={1}
              max={24}
            />
            <NumberField
              name="lockoutThreshold"
              label={SETTINGS.lockoutThreshold}
              unit={SETTINGS.lockoutThresholdUnit}
              defaultValue={settings.session.lockoutThreshold}
              min={3}
              max={20}
            />
            <NumberField
              name="lockoutBaseMinutes"
              label={SETTINGS.lockoutBase}
              unit={SETTINGS.lockoutBaseUnit}
              defaultValue={settings.session.lockoutBaseMinutes}
              min={1}
              max={120}
            />
          </div>

          <p className="mt-4 text-micro leading-relaxed text-text-subtle">{SETTINGS.lockoutHint}</p>
        </div>
      </Card>

      <div className="flex justify-end gap-2.5">
        <Button type="reset" variant="outline">
          {COMMON.cancel}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {COMMON.saveChanges}
        </Button>
      </div>
    </form>
  )
}

function ToggleRow({
  name,
  title,
  hint,
  defaultChecked,
}: {
  name: string
  title: string
  hint: string
  defaultChecked: boolean
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-row-border pt-4">
      <span>
        <span className="block text-label font-semibold text-text-strong">{title}</span>
        <span className="mt-0.5 block text-micro text-text-subtle">{hint}</span>
      </span>
      <Checkbox name={name} defaultChecked={defaultChecked} className="size-5" />
    </label>
  )
}

function NumberField({
  name,
  label,
  unit,
  defaultValue,
  min,
  max,
}: {
  name: string
  label: string
  unit: string
  defaultValue: number
  min: number
  max: number
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <div className="flex items-center gap-2.5">
        <TextInput
          id={name}
          name={name}
          type="number"
          min={min}
          max={max}
          defaultValue={defaultValue}
          className="tabular"
        />
        <span className="text-caption whitespace-nowrap text-text-subtle">{unit}</span>
      </div>
    </div>
  )
}
