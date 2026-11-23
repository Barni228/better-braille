<script lang="ts">
  interface Props {
    label: string
    value: number
    min: number
    max: number
  }

  let { label, value = $bindable(), min, max }: Props = $props()
  const id = $props.id()

  // Update live while the number is valid; fix it up (clamp) when the field is left.
  function onInput(event: Event & { currentTarget: HTMLInputElement }) {
    const v = event.currentTarget.valueAsNumber
    if (Number.isInteger(v) && v >= min && v <= max) value = v
  }

  function onChange(event: Event & { currentTarget: HTMLInputElement }) {
    const v = event.currentTarget.valueAsNumber
    if (Number.isFinite(v)) value = Math.min(max, Math.max(min, Math.round(v)))
    event.currentTarget.value = String(value)
  }
</script>

<div class="field">
  <label for={id}>{label}</label>
  <input {id} type="number" inputmode="numeric" {min} {max} step="1" {value} oninput={onInput} onchange={onChange} />
</div>

<style>
  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  label {
    font-size: 14px;
  }

  input {
    width: 76px;
    text-align: right;
  }
</style>
