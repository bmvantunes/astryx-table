import { TextInput } from "@astryxdesign/core/TextInput";
export const search = <TextInput value="" label="Search" type="search" />;
export const length = <TextInput value="" label="Bounded text" maxLength={32} />;
export const decimal = <TextInput value="" label="Exact decimal" inputMode="decimal" />;
export const eventTarget = (
  <TextInput
    value=""
    label="Typed event"
    onChange={(_value, event) => {
      const input: HTMLInputElement = event.currentTarget;
      void input;
    }}
    onKeyDown={(event) => {
      const input: HTMLInputElement = event.currentTarget;
      void input;
    }}
  />
);
